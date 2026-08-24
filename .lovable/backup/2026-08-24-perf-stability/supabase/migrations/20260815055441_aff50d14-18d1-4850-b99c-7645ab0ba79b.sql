CREATE OR REPLACE FUNCTION public.feed_viewer_context()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN auth.uid() IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'user_id', auth.uid(),
    'interests', COALESCE((SELECT to_jsonb(a.interests) FROM public.ad_preferences a WHERE a.user_id = auth.uid()), '[]'::jsonb),
    'location', (SELECT p.location FROM public.profiles p WHERE p.id = auth.uid()),
    'language', (SELECT p.language FROM public.profiles p WHERE p.id = auth.uid()),
    'following', COALESCE((SELECT jsonb_agg(f.following_id) FROM (
        SELECT following_id FROM public.follows WHERE follower_id = auth.uid() LIMIT 1000
      ) f), '[]'::jsonb),
    'learned_weights', COALESCE((SELECT jsonb_object_agg(w.key, w.weight)
        FROM public.feed_learned_weights w WHERE w.user_id = auth.uid()), '{}'::jsonb),
    'hashtags', COALESCE((SELECT jsonb_agg(t.tag) FROM (
        SELECT h.tag FROM public.hashtag_follows hf
          JOIN public.hashtags h ON h.id = hf.hashtag_id
         WHERE hf.user_id = auth.uid() LIMIT 200
      ) t), '[]'::jsonb),
    'connection_ids', COALESCE((SELECT jsonb_agg(DISTINCT x.other_id) FROM (
        SELECT CASE WHEN c.requester_id = auth.uid() THEN c.addressee_id ELSE c.requester_id END AS other_id
          FROM public.connections c
         WHERE c.status = 'accepted'
           AND (c.requester_id = auth.uid() OR c.addressee_id = auth.uid())
         LIMIT 1000
      ) x), '[]'::jsonb)
  ) END
$function$;

REVOKE ALL ON FUNCTION public.feed_viewer_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_viewer_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_viewer_context() TO service_role;