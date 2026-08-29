ALTER POLICY "user_warnings_insert_admin" ON public.user_warnings
  WITH CHECK (((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) AND ((SELECT auth.uid()) = admin_id)));

ALTER POLICY "user_bans_insert_admin" ON public.user_bans
  WITH CHECK (((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) AND ((SELECT auth.uid()) = admin_id)));

ALTER POLICY "grants_delete_owner_or_grantee" ON public.slang_tag_grants
  USING (((owner_id = (SELECT auth.uid())) OR (grantee_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));

ALTER POLICY "share_requests_delete_involved" ON public.slang_tag_share_requests
  USING (((owner_id = (SELECT auth.uid())) OR (requester_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));

ALTER POLICY "share_requests_update_owner" ON public.slang_tag_share_requests
  USING (((owner_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))))
  WITH CHECK (((owner_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));

ALTER POLICY "slang_definitions_insert" ON public.slang_definitions
  WITH CHECK ((owns_slang_name(normalized_name) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));

ALTER POLICY "slang_definitions_update" ON public.slang_definitions
  USING ((owns_slang_name(normalized_name) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))))
  WITH CHECK ((owns_slang_name(normalized_name) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));

ALTER POLICY "slang_definition_translations_update" ON public.slang_definition_translations
  USING ((EXISTS ( SELECT 1 FROM public.slang_definitions d
    WHERE ((d.id = slang_definition_translations.definition_id) AND (owns_slang_name(d.normalized_name) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.slang_definitions d
    WHERE ((d.id = slang_definition_translations.definition_id) AND (owns_slang_name(d.normalized_name) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))))));

ALTER POLICY "slang_definition_translations_write" ON public.slang_definition_translations
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.slang_definitions d
    WHERE ((d.id = slang_definition_translations.definition_id) AND (owns_slang_name(d.normalized_name) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))))));