ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ads_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.guard_profile_internal_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.verified := OLD.verified;
  NEW.level := OLD.level;
  NEW.xp := OLD.xp;
  NEW.is_test_bot := OLD.is_test_bot;
  NEW.ads_enabled := OLD.ads_enabled;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bootstrap_user_state()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN auth.uid() IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'user_id', auth.uid(),
    'liked_posts', COALESCE((SELECT jsonb_agg(post_id) FROM public.post_likes WHERE user_id = auth.uid()), '[]'::jsonb),
    'saved_posts', COALESCE((SELECT jsonb_agg(post_id) FROM public.post_saves WHERE user_id = auth.uid()), '[]'::jsonb),
    'shared_posts', COALESCE((SELECT jsonb_agg(post_id) FROM public.post_shares WHERE user_id = auth.uid()), '[]'::jsonb),
    'liked_tags', COALESCE((SELECT jsonb_agg(tag_id) FROM public.slang_tag_likes WHERE user_id = auth.uid()), '[]'::jsonb),
    'saved_tags', COALESCE((SELECT jsonb_agg(tag_id) FROM public.slang_tag_saves WHERE user_id = auth.uid()), '[]'::jsonb),
    'following', COALESCE((SELECT jsonb_agg(following_id) FROM public.follows WHERE follower_id = auth.uid()), '[]'::jsonb),
    'roles', COALESCE((SELECT jsonb_agg(role) FROM public.user_roles WHERE user_id = auth.uid()), '[]'::jsonb),
    'profile', COALESCE((SELECT to_jsonb(x) FROM (
        SELECT p.id, p.username, p.location, p.location_visibility, p.profile_visibility,
               p.verified, p.push_enabled, p.level, p.xp, p.ads_enabled
        FROM public.profiles p WHERE p.id = auth.uid()
      ) x), 'null'::jsonb),
    'test_bots_visible', COALESCE((SELECT s.enabled FROM public.test_bot_settings s WHERE s.id = true), false)
  ) END
$function$;