-- Nur Server-Zugriff (service_role); Client-Rollen ausdrücklich verboten.
GRANT ALL ON public.beta_launch_notifications TO service_role;
GRANT ALL ON public.beta_launch_state TO service_role;
GRANT ALL ON public.notification_jobs TO service_role;

REVOKE ALL ON public.beta_launch_notifications FROM anon, authenticated;
REVOKE ALL ON public.beta_launch_state FROM anon, authenticated;
REVOKE ALL ON public.notification_jobs FROM anon, authenticated;

ALTER TABLE public.beta_launch_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_launch_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['beta_launch_notifications','beta_launch_state','notification_jobs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_no_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_no_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_no_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_no_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (false)', t || '_no_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (false)', t || '_no_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false)', t || '_no_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO anon, authenticated USING (false)', t || '_no_delete', t);
  END LOOP;
END $$;