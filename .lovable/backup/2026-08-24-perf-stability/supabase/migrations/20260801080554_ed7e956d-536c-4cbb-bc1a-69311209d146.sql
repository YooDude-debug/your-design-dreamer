CREATE POLICY "post_likes_select_post_owner" ON public.post_likes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_likes.post_id AND p.user_id = auth.uid()
  ));