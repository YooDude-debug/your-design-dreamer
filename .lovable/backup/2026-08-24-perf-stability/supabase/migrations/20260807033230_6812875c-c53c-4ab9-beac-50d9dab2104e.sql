REVOKE EXECUTE ON FUNCTION public.is_arena_challenge_visible(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_see_arena_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_arena_challenge_visible(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_arena_submission(uuid) TO authenticated, service_role;