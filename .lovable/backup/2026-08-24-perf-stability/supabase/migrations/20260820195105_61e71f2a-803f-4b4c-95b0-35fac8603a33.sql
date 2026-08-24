REVOKE EXECUTE ON FUNCTION public.can_view_test_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_test_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.test_user_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.test_user_visible(uuid) TO authenticated;