-- Block 1: InitPlan-Wrapping von auth.uid() -> (select auth.uid())
-- Semantisch identisch: auth.uid() ist STABLE und wird nur als Skalar bzw. Funktionsargument verwendet.

-- posts
ALTER POLICY "posts_select" ON public.posts
  USING (
    (((hidden_at IS NULL) OR (user_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))
     AND test_user_visible(user_id)
     AND ((visibility = 'public'::post_visibility)
          OR (user_id = (select auth.uid()))
          OR ((visibility = 'connections'::post_visibility) AND are_connected((select auth.uid()), user_id))
          OR ((visibility = 'following'::post_visibility) AND is_following(user_id, (select auth.uid())))))
  );
ALTER POLICY "posts_insert_own" ON public.posts WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "posts_update_own" ON public.posts USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "posts_delete_own" ON public.posts USING ((select auth.uid()) = user_id);
ALTER POLICY "channel team reads channel posts" ON public.posts
  USING ((channel_id IS NOT NULL) AND is_channel_moderator(channel_id, (select auth.uid())));

-- comments
ALTER POLICY "comments_select" ON public.comments
  USING ((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR (can_view_post(post_id) AND test_user_visible(user_id)));
ALTER POLICY "comments_insert_own" ON public.comments WITH CHECK (((select auth.uid()) = user_id) AND can_view_post(post_id));
ALTER POLICY "comments_delete_own" ON public.comments USING ((select auth.uid()) = user_id);

-- post_likes
ALTER POLICY "post_likes_select" ON public.post_likes USING ((select auth.uid()) = user_id);
ALTER POLICY "post_likes_select_post_owner" ON public.post_likes
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_likes.post_id AND p.user_id = (select auth.uid())));
ALTER POLICY "post_likes_insert_own" ON public.post_likes WITH CHECK (((select auth.uid()) = user_id) AND can_view_post(post_id));
ALTER POLICY "post_likes_delete_own" ON public.post_likes USING ((select auth.uid()) = user_id);

-- post_saves
ALTER POLICY "post_saves_select" ON public.post_saves USING ((select auth.uid()) = user_id);
ALTER POLICY "post_saves_insert_own" ON public.post_saves WITH CHECK (((select auth.uid()) = user_id) AND can_view_post(post_id));
ALTER POLICY "post_saves_delete_own" ON public.post_saves USING ((select auth.uid()) = user_id);

-- post_shares
ALTER POLICY "post_shares_select" ON public.post_shares
  USING ((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "post_shares_insert_own" ON public.post_shares WITH CHECK (((select auth.uid()) = user_id) AND can_view_post(post_id));
ALTER POLICY "post_shares_delete_own" ON public.post_shares USING ((select auth.uid()) = user_id);

-- post_views
ALTER POLICY "post_views_select" ON public.post_views USING ((select auth.uid()) = user_id);
ALTER POLICY "post_views_insert_own" ON public.post_views WITH CHECK (((select auth.uid()) = user_id) AND can_view_post(post_id));
ALTER POLICY "post_views_delete_own" ON public.post_views USING ((select auth.uid()) = user_id);

-- post_video_views
ALTER POLICY "post_video_views_select_own_or_post_owner" ON public.post_video_views
  USING (((select auth.uid()) = user_id)
         OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_video_views.post_id AND p.user_id = (select auth.uid()))
         OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "post_video_views_insert_own" ON public.post_video_views WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "post_video_views_delete_own" ON public.post_video_views USING ((select auth.uid()) = user_id);