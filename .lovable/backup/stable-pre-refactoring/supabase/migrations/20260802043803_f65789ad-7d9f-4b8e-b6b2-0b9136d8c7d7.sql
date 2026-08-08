DROP POLICY IF EXISTS posts_select ON public.posts;

CREATE POLICY posts_select ON public.posts
FOR SELECT
TO authenticated
USING (
  ((hidden_at IS NULL) OR (user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  AND (
    (visibility = 'public'::post_visibility)
    OR (user_id = auth.uid())
    OR ((visibility = 'connections'::post_visibility) AND are_connected(auth.uid(), user_id))
    OR ((visibility = 'following'::post_visibility) AND is_following(user_id, auth.uid()))
  )
);

REVOKE SELECT ON public.posts FROM anon;