REVOKE ALL ON FUNCTION public.channel_moderate_post(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.channel_owner_membership() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_channel_ban_on_post() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_channel_banned(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_channel_moderator(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_channel_owner(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.channel_moderate_post(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_channel_banned(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_channel_moderator(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_channel_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.channel_owner_membership() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_channel_ban_on_post() TO service_role;