-- 1) Trigger helper must not be callable through the API
REVOKE ALL ON FUNCTION public.sync_post_hashtags() FROM anon, authenticated, PUBLIC;

-- 2) Profiles: honor profile_visibility
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.can_view_profile(id)
);

-- 3) Arena challenges: end date must be in the future when set
CREATE OR REPLACE FUNCTION public.guard_arena_challenge_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ends_at IS NOT NULL THEN
    IF NEW.ends_at <= NEW.starts_at THEN
      RAISE EXCEPTION 'ends_at must be after starts_at';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.ends_at <= now() THEN
      RAISE EXCEPTION 'ends_at must be in the future';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_arena_challenge_dates() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS guard_arena_challenge_dates ON public.arena_challenges;
CREATE TRIGGER guard_arena_challenge_dates
BEFORE INSERT OR UPDATE ON public.arena_challenges
FOR EACH ROW EXECUTE FUNCTION public.guard_arena_challenge_dates();