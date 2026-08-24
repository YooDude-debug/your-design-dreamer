GRANT EXECUTE ON FUNCTION public.are_connected(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_notify(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_media(text) TO authenticated;