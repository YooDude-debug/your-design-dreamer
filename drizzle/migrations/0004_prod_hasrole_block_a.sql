-- Y-Dude – has_role Variante B, Block A
-- Nur Auswertungszeitpunkt (InitPlan), keine Semantikänderung.

ALTER POLICY "posts_select" ON public.posts
  USING (
    ((hidden_at IS NULL) OR (user_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
    AND public.test_user_visible(user_id)
    AND ((visibility = 'public'::post_visibility)
      OR (user_id = (SELECT auth.uid()))
      OR ((visibility = 'connections'::post_visibility) AND public.are_connected((SELECT auth.uid()), user_id))
      OR ((visibility = 'following'::post_visibility) AND public.is_following(user_id, (SELECT auth.uid()))))
  );

ALTER POLICY "comments_select" ON public.comments
  USING (
    (user_id = (SELECT auth.uid()))
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
    OR (public.can_view_post(post_id) AND public.test_user_visible(user_id))
  );

ALTER POLICY "profiles_select" ON public.profiles
  USING (
    ((SELECT auth.uid()) = id)
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
    OR public.can_view_profile(id)
  );

ALTER POLICY "slang_tags_select" ON public.slang_tags
  USING (
    ((SELECT auth.uid()) = owner_id)
    OR ((SELECT auth.uid()) = creator_id)
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
    OR ((deleted_at IS NULL) AND (moderation_status = 'approved'::moderation_status)
        AND public.test_user_visible(creator_id) AND public.test_user_visible(owner_id))
  );

ALTER POLICY "post_shares_select" ON public.post_shares
  USING (
    (user_id = (SELECT auth.uid()))
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
  );

ALTER POLICY "post_video_views_select_own_or_post_owner" ON public.post_video_views
  USING (
    ((SELECT auth.uid()) = user_id)
    OR (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_video_views.post_id AND p.user_id = (SELECT auth.uid())))
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
  );