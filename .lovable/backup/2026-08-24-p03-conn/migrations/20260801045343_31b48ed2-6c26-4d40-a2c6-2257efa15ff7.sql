DROP POLICY IF EXISTS posts_select ON public.posts;

CREATE POLICY posts_select ON public.posts
FOR SELECT TO authenticated
USING (
  visibility = 'public'
  OR user_id = auth.uid()
  OR (visibility = 'connections' AND public.are_connected(auth.uid(), user_id))
  OR (visibility = 'following' AND public.is_following(user_id, auth.uid()))
);