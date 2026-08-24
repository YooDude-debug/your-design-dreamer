DROP POLICY IF EXISTS ad_test_settings_select_authenticated ON public.ad_test_settings;
CREATE POLICY ad_test_settings_select_admin ON public.ad_test_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS post_video_views_select ON public.post_video_views;
CREATE POLICY post_video_views_select_own_or_post_owner ON public.post_video_views
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_video_views.post_id AND p.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS slang_tag_video_uses_select ON public.slang_tag_video_uses;
CREATE POLICY slang_tag_video_uses_select_own_or_tag_owner ON public.slang_tag_video_uses
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.slang_tags t WHERE t.id = slang_tag_video_uses.tag_id AND (t.owner_id = auth.uid() OR t.creator_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );