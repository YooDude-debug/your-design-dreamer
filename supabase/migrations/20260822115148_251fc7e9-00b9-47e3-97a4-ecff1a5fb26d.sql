CREATE OR REPLACE FUNCTION public.globe_vote_close_round(_round_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.globe_vote_rounds;
  best_up int := 0;
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

  -- Gewinnerkriterium: meiste Upvotes (0 Upvotes gewinnt nie).
  SELECT COALESCE(MAX(up_count), 0) INTO best_up FROM _tally;

  INSERT INTO public.globe_vote_results (round_id, tag_id, tag_name, up_count, down_count, ratio, winner)
  SELECT r.id, tag_id, tag_name, up_count, down_count,
         CASE WHEN up_count + down_count > 0 THEN up_count::numeric / (up_count + down_count) ELSE 0 END,
         (best_up > 0 AND up_count = best_up)
    FROM _tally
  ON CONFLICT (round_id, tag_id) DO NOTHING;

  INSERT INTO public.globe_entries (tag_id, normalized_name, region, language, round_id, up_count, down_count, ratio)
  SELECT tag_id, normalized_name, region, language, r.id, up_count, down_count,
         CASE WHEN up_count + down_count > 0 THEN up_count::numeric / (up_count + down_count) ELSE 0 END
    FROM _tally
   WHERE best_up > 0 AND up_count = best_up
  ON CONFLICT DO NOTHING;

  UPDATE public.slang_tags SET community_shared = false
   WHERE id IN (SELECT tag_id FROM _tally);

  UPDATE public.globe_vote_rounds SET closed_at = now() WHERE id = r.id;
END;
$function$;