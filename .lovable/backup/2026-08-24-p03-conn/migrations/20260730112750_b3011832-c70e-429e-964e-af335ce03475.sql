-- 1. Restrict private interaction history to the owning user
DROP POLICY IF EXISTS post_likes_select ON public.post_likes;
CREATE POLICY post_likes_select ON public.post_likes FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS post_saves_select ON public.post_saves;
CREATE POLICY post_saves_select ON public.post_saves FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS post_views_select ON public.post_views;
CREATE POLICY post_views_select ON public.post_views FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS slang_tag_plays_select ON public.slang_tag_plays;
CREATE POLICY slang_tag_plays_select ON public.slang_tag_plays FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS slang_tag_saves_select ON public.slang_tag_saves;
CREATE POLICY slang_tag_saves_select ON public.slang_tag_saves FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Newsletter: admin-only reads, validated inserts (no more blanket WITH CHECK (true))
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY newsletter_insert ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'
    AND length(email) <= 254
    AND (language IS NULL OR length(language) <= 16)
  );
CREATE POLICY newsletter_select_admin ON public.newsletter_subscribers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Hide last_seen_at from other users (column-level)
REVOKE SELECT (last_seen_at) ON public.profiles FROM authenticated, anon;

-- 4. Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.sync_post_counter() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_tag_counter() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_comment_counts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_post_tag_uses() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_conversation_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.are_connected(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;