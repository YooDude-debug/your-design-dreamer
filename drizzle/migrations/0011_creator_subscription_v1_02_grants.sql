REVOKE ALL ON FUNCTION public.has_active_creator_subscription(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_active_creator_subscription(uuid, uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.owns_slang_tag_permanently(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.owns_slang_tag_permanently(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_creator_slang_tag(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_creator_slang_tag(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.protect_owned_slang_tag_delete() FROM public, anon, authenticated;