-- 1) Tuning-Parameter der Interest Engine nicht mehr für alle Angemeldeten lesbar.
--    Die Werte werden serverseitig mit erhöhten Rechten geladen; Administratoren
--    behalten über die bestehende ALL-Policy vollen Zugriff.
DROP POLICY IF EXISTS "config readable by authenticated" ON public.interest_engine_config;

CREATE POLICY "config readable by admins"
  ON public.interest_engine_config
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Interne Username-Sperrlistenprüfung ist kein öffentlicher API-Endpunkt.
--    Aufrufe erfolgen ausschließlich serverseitig (service_role), zusätzlich
--    erzwingt der Trigger auf public.profiles die Sperre.
REVOKE EXECUTE ON FUNCTION public.username_status(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_username_reserved(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.username_status(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_username_reserved(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_status(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_username_reserved(text) TO service_role;