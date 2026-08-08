-- Undo the temporary broad table-level access; this project uses column-level grants
REVOKE SELECT, INSERT, UPDATE ON public.profiles FROM authenticated;

-- Column-level grants for the new visibility field (missing grant caused 42501)
GRANT SELECT (profile_visibility), UPDATE (profile_visibility) ON public.profiles TO authenticated;