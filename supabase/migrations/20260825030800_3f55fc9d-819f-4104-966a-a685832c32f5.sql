GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.test_user_visible(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.are_connected(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_following(uuid, uuid) TO anon;