
-- Wöchentliche Globe-Vote-Runden (serverseitige Zeitrechnung)
CREATE TABLE IF NOT EXISTS public.globe_vote_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_no integer NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS globe_vote_rounds_no_key ON public.globe_vote_rounds(round_no);

-- Teilnehmer einer Runde (eine Zeile je eingereichter Audio-Variante)
CREATE TABLE IF NOT EXISTS public.globe_vote_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.globe_vote_rounds(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, tag_id)
);

-- Archiv: Ergebnis je Variante und Runde
CREATE TABLE IF NOT EXISTS public.globe_vote_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.globe_vote_rounds(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL,
  tag_name text NOT NULL DEFAULT '',
  up_count integer NOT NULL DEFAULT 0,
  down_count integer NOT NULL DEFAULT 0,
  ratio numeric NOT NULL DEFAULT 0,
  winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, tag_id)
);

-- Globe-Datenbank: aufgenommene Gewinner (keine Doppelanlage)
CREATE TABLE IF NOT EXISTS public.globe_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  normalized_name text NOT NULL,
  region text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT '',
  round_id uuid REFERENCES public.globe_vote_rounds(id) ON DELETE SET NULL,
  up_count integer NOT NULL DEFAULT 0,
  down_count integer NOT NULL DEFAULT 0,
  ratio numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS globe_entries_name_region_key
  ON public.globe_entries(normalized_name, lower(region));

GRANT SELECT ON public.globe_vote_rounds TO authenticated, anon;
GRANT ALL ON public.globe_vote_rounds TO service_role;
GRANT SELECT ON public.globe_vote_entries TO authenticated;
GRANT ALL ON public.globe_vote_entries TO service_role;
GRANT SELECT ON public.globe_vote_results TO authenticated;
GRANT ALL ON public.globe_vote_results TO service_role;
GRANT SELECT ON public.globe_entries TO authenticated, anon;
GRANT ALL ON public.globe_entries TO service_role;

ALTER TABLE public.globe_vote_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.globe_vote_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.globe_vote_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.globe_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS globe_vote_rounds_read ON public.globe_vote_rounds;
CREATE POLICY globe_vote_rounds_read ON public.globe_vote_rounds FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS globe_vote_entries_read ON public.globe_vote_entries;
CREATE POLICY globe_vote_entries_read ON public.globe_vote_entries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS globe_vote_results_read ON public.globe_vote_results;
CREATE POLICY globe_vote_results_read ON public.globe_vote_results FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS globe_entries_read ON public.globe_entries;
CREATE POLICY globe_entries_read ON public.globe_entries FOR SELECT TO authenticated, anon USING (true);

-- Runde schließen: Ergebnisse archivieren, Gewinner in den Globe übernehmen,
-- übrige Einreichungen aus der aktiven Liste entfernen.
CREATE OR REPLACE FUNCTION public.globe_vote_close_round(_round_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r public.globe_vote_rounds;
  best numeric := -1;
BEGIN
  SELECT * INTO r FROM public.globe_vote_rounds WHERE id = _round_id FOR UPDATE;
  IF NOT FOUND OR r.closed_at IS NOT NULL OR r.ends_at > now() THEN
    RETURN;
  END IF;

  CREATE TEMP TABLE _tally ON COMMIT DROP AS
  SELECT e.tag_id,
         COALESCE(t.name, '') AS tag_name,
         COALESCE(t.normalized_name, '') AS normalized_name,
         COALESCE(t.region, '') AS region,
         COALESCE(t.language, '') AS language,
         COALESCE(SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END), 0)::int AS up_count,
         COALESCE(SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END), 0)::int AS down_count
    FROM public.globe_vote_entries e
    JOIN public.slang_tags t ON t.id = e.tag_id AND t.deleted_at IS NULL
    LEFT JOIN public.slang_tag_votes v
      ON v.tag_id = e.tag_id AND v.created_at >= r.starts_at AND v.created_at < r.ends_at
   WHERE e.round_id = r.id
   GROUP BY e.tag_id, t.name, t.normalized_name, t.region, t.language;

  SELECT COALESCE(MAX(CASE WHEN up_count + down_count > 0
                           THEN up_count::numeric / (up_count + down_count) ELSE 0 END), 0)
    INTO best
    FROM _tally
   WHERE up_count > 0;

  INSERT INTO public.globe_vote_results (round_id, tag_id, tag_name, up_count, down_count, ratio, winner)
  SELECT r.id, tag_id, tag_name, up_count, down_count,
         CASE WHEN up_count + down_count > 0 THEN up_count::numeric / (up_count + down_count) ELSE 0 END,
         (up_count > 0 AND best > 0
          AND up_count::numeric / (up_count + down_count) = best)
    FROM _tally
  ON CONFLICT (round_id, tag_id) DO NOTHING;

  -- Gewinner in die Globe-Datenbank (keine Doppelanlage)
  INSERT INTO public.globe_entries (tag_id, normalized_name, region, language, round_id, up_count, down_count, ratio)
  SELECT tag_id, normalized_name, region, language, r.id, up_count, down_count,
         up_count::numeric / (up_count + down_count)
    FROM _tally
   WHERE up_count > 0 AND best > 0
     AND up_count::numeric / (up_count + down_count) = best
  ON CONFLICT DO NOTHING;

  -- Aktive Globe-Vote-Liste leeren: alle Teilnehmer dieser Runde
  UPDATE public.slang_tags SET community_shared = false
   WHERE id IN (SELECT tag_id FROM _tally);

  UPDATE public.globe_vote_rounds SET closed_at = now() WHERE id = r.id;
END;
$$;

-- Aktuelle Runde (serverseitig): schließt fällige Runden, startet die nächste
-- und meldet neu eingereichte Varianten für die laufende Runde an.
CREATE OR REPLACE FUNCTION public.globe_vote_current_round()
RETURNS TABLE(id uuid, round_no integer, starts_at timestamptz, ends_at timestamptz, server_now timestamptz, entries integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  due uuid;
  cur public.globe_vote_rounds;
BEGIN
  FOR due IN SELECT r.id FROM public.globe_vote_rounds r
              WHERE r.closed_at IS NULL AND r.ends_at <= now() LOOP
    PERFORM public.globe_vote_close_round(due);
  END LOOP;

  SELECT * INTO cur FROM public.globe_vote_rounds
   WHERE closed_at IS NULL AND ends_at > now()
   ORDER BY starts_at DESC LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.globe_vote_rounds (round_no, starts_at, ends_at)
    VALUES (COALESCE((SELECT MAX(round_no) FROM public.globe_vote_rounds), 0) + 1,
            now(), now() + interval '7 days')
    RETURNING * INTO cur;
  END IF;

  INSERT INTO public.globe_vote_entries (round_id, tag_id)
  SELECT cur.id, t.id
    FROM public.slang_tags t
   WHERE t.community_shared = true AND t.deleted_at IS NULL
  ON CONFLICT (round_id, tag_id) DO NOTHING;

  RETURN QUERY
  SELECT cur.id, cur.round_no, cur.starts_at, cur.ends_at, now(),
         (SELECT COUNT(*)::int FROM public.globe_vote_entries e WHERE e.round_id = cur.id);
END;
$$;

REVOKE ALL ON FUNCTION public.globe_vote_close_round(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.globe_vote_close_round(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.globe_vote_current_round() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.globe_vote_current_round() TO authenticated, service_role;
