REVOKE EXECUTE ON FUNCTION public.can_see_profile_field(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_use_extended_audio(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_slang_tag_grant_active(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.track_slang_tag_click(uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.track_slang_tag_reach(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.globe_vote_current_round()
 RETURNS TABLE(id uuid, round_no integer, starts_at timestamp with time zone, ends_at timestamp with time zone, server_now timestamp with time zone, entries integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  due uuid;
  cur public.globe_vote_rounds;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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
$function$;