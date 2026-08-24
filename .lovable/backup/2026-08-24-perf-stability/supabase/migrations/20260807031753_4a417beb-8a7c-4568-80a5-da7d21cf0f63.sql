REVOKE ALL ON public.account_security_events FROM anon;
REVOKE ALL ON public.account_security_events FROM authenticated;
GRANT ALL ON public.account_security_events TO service_role;

ALTER TABLE public.account_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_security_events_select" ON public.account_security_events;
DROP POLICY IF EXISTS "account_security_events_insert" ON public.account_security_events;
DROP POLICY IF EXISTS "account_security_events_update" ON public.account_security_events;
DROP POLICY IF EXISTS "account_security_events_delete" ON public.account_security_events;

CREATE POLICY "account_security_events_select"
  ON public.account_security_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "account_security_events_no_insert"
  ON public.account_security_events FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "account_security_events_no_update"
  ON public.account_security_events FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "account_security_events_no_delete"
  ON public.account_security_events FOR DELETE TO authenticated
  USING (false);