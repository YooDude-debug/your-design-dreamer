-- Feste Wochenlogik für das Globe-Voting: Ende jeder Vote-Woche ist
-- Sonntag 18:00 Uhr Europe/Berlin (Sommer-/Winterzeit automatisch korrekt).
CREATE OR REPLACE FUNCTION public.globe_vote_week_end(_at timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH l AS (SELECT (_at AT TIME ZONE 'Europe/Berlin') AS lt),
  b AS (
    SELECT date_trunc('day', lt)
           + make_interval(days => ((7 - EXTRACT(dow FROM lt)::int) % 7))
           + interval '18 hours' AS cand,
           lt
      FROM l
  )
  SELECT (CASE WHEN cand <= lt THEN cand + interval '7 days' ELSE cand END)
         AT TIME ZONE 'Europe/Berlin'
    FROM b;
$$;

REVOKE EXECUTE ON FUNCTION public.globe_vote_week_end(timestamptz) FROM anon;

-- Interner Runden-Ensurer: schließt fällige Runden und startet die nächste
-- Wochenrunde. Advisory-Lock + closed_at-Prüfung machen den Wochenwechsel
-- idempotent, auch wenn viele Clients gleichzeitig 18:00 erreichen.
CREATE OR REPLACE FUNCTION public.globe_vote_ensure_round()
RETURNS public.globe_vote_rounds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_due uuid;
  v_row public.globe_vote_rounds;
  v_end timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('globe_vote_round'));

  FOR v_due IN SELECT r.id FROM public.globe_vote_rounds r
                WHERE r.closed_at IS NULL AND r.ends_at <= now()
                ORDER BY r.starts_at LOOP
    PERFORM public.globe_vote_close_round(v_due);
  END LOOP;

  SELECT r.* INTO v_row FROM public.globe_vote_rounds r
   WHERE r.closed_at IS NULL AND r.ends_at > now()
   ORDER BY r.starts_at DESC LIMIT 1;

  IF v_row.id IS NULL THEN
    v_end := public.globe_vote_week_end(now());
    INSERT INTO public.globe_vote_rounds AS t (round_no, starts_at, ends_at)
    VALUES (COALESCE((SELECT MAX(r.round_no) FROM public.globe_vote_rounds r), 0) + 1,
            v_end - interval '7 days', v_end)
    RETURNING t.* INTO v_row;
  END IF;

  INSERT INTO public.globe_vote_entries AS e (round_id, tag_id)
  SELECT v_row.id, t.id
    FROM public.slang_tags t
   WHERE t.community_shared = true AND t.deleted_at IS NULL
  ON CONFLICT (round_id, tag_id) DO NOTHING;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.globe_vote_ensure_round() FROM anon, authenticated;

-- Öffentliche RPC: nur Auth-Prüfung + Ausgabe. Die frühere Fassung benutzte
-- OUT-Parameter mit den Namen der Tabellenspalten (ends_at, starts_at ...),
-- weshalb PostgreSQL die Runden-Abfrage mit 42702 ("column reference
-- ends_at is ambiguous") abbrach – der Client bekam nie eine Runde und
-- zeigte dauerhaft 00:00:00.
CREATE OR REPLACE FUNCTION public.globe_vote_current_round()
RETURNS TABLE(id uuid, round_no integer, starts_at timestamptz, ends_at timestamptz, server_now timestamptz, entries integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.globe_vote_rounds;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_row := public.globe_vote_ensure_round();

  RETURN QUERY
  SELECT v_row.id, v_row.round_no, v_row.starts_at, v_row.ends_at, now(),
         (SELECT COUNT(*)::int FROM public.globe_vote_entries e WHERE e.round_id = v_row.id);
END;
$$;