-- Newsletter-Tabelle: kein direkter Data-API-Zugriff mehr (nur Server/service_role)
REVOKE ALL ON public.newsletter_subscribers FROM anon;
REVOKE ALL ON public.newsletter_subscribers FROM authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Öffentlicher Insert direkt aus dem Browser wird entfernt;
-- Anmeldung läuft serverseitig (Turnstile + Cooldown + Double-Opt-in).
DROP POLICY IF EXISTS "newsletter_insert" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_select_admin" ON public.newsletter_subscribers;

-- Explizite Verbote: kein Lesen/Schreiben/Ändern/Löschen über die Data API
CREATE POLICY "newsletter_no_select" ON public.newsletter_subscribers
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "newsletter_no_insert" ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "newsletter_no_update" ON public.newsletter_subscribers
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "newsletter_no_delete" ON public.newsletter_subscribers
  FOR DELETE TO anon, authenticated USING (false);

-- Doppelte Anmeldungen bleiben ausgeschlossen
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_key2
  ON public.newsletter_subscribers (lower(email));