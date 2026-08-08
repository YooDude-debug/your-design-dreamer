REVOKE EXECUTE ON FUNCTION public.sync_post_counter() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_tag_counter() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_comment_counts() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_post_tag_uses() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;