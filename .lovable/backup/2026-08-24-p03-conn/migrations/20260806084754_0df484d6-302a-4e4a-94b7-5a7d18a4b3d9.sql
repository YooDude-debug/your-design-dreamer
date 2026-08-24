DO $$ BEGIN
  CREATE TYPE public.profile_visibility AS ENUM ('public', 'connections', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_visibility public.profile_visibility NOT NULL DEFAULT 'public';

CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() = _profile_id THEN true
    ELSE COALESCE((
      SELECT CASE p.profile_visibility
        WHEN 'public' THEN true
        WHEN 'connections' THEN public.are_connected(auth.uid(), p.id)
        ELSE false
      END
      FROM public.profiles p
      WHERE p.id = _profile_id
    ), false)
  END
$$;

REVOKE ALL ON FUNCTION public.can_view_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid) TO authenticated;