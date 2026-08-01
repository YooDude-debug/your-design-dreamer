CREATE OR REPLACE FUNCTION public.track_slang_tag_click(_tag_id uuid, _conversion boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.slang_tags
     SET clicks_count = clicks_count + 1,
         conversion_count = conversion_count + CASE WHEN _conversion THEN 1 ELSE 0 END
   WHERE id = _tag_id AND owner_type = 'company';
END $function$;

REVOKE ALL ON FUNCTION public.track_slang_tag_click(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_slang_tag_click(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.track_slang_tag_reach(_tag_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.slang_tags
     SET reach_count = reach_count + 1
   WHERE id = _tag_id AND owner_type = 'company';
END $function$;

REVOKE ALL ON FUNCTION public.track_slang_tag_reach(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_slang_tag_reach(uuid) TO authenticated, service_role;