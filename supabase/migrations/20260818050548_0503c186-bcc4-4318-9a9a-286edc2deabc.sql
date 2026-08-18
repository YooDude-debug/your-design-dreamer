REVOKE ALL ON FUNCTION public.activate_ad_pause(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_ad_pause(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.activate_ad_pause(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_ad_pause(text) TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.ad_test_settings FROM anon;
REVOKE ALL ON public.ad_test_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_test_settings TO authenticated;
GRANT ALL ON public.ad_test_settings TO service_role;

DROP POLICY IF EXISTS ad_test_settings_write_admin ON public.ad_test_settings;
CREATE POLICY ad_test_settings_insert_admin ON public.ad_test_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY ad_test_settings_update_admin ON public.ad_test_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY ad_test_settings_delete_admin ON public.ad_test_settings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));