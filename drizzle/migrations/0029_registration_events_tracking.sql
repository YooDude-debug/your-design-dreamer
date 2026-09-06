-- Datenschutzkonforme technische Ereignisse des Registrierungsvorgangs.
-- Es werden ausschliesslich Ereignisnamen, Fehlerursachen und eine
-- zufaellige Versuchs-ID gespeichert. Keine E-Mails, Passwoerter, Tokens,
-- IP-Adressen oder sonstige personenbezogenen Inhalte.
CREATE TABLE IF NOT EXISTS public.registration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN (
    'registration_started',
    'registration_submitted',
    'turnstile_loaded',
    'turnstile_completed',
    'turnstile_failed',
    'validation_failed',
    'auth_failed',
    'profile_creation_failed',
    'email_confirmation_pending',
    'registration_completed'
  )),
  cause text CHECK (cause IN ('turnstile','validation','auth','database','profile_creation','unknown')),
  detail text CHECK (detail IS NULL OR length(detail) <= 60),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registration_events_created_at_idx
  ON public.registration_events (created_at DESC);
CREATE INDEX IF NOT EXISTS registration_events_attempt_idx
  ON public.registration_events (attempt_id, created_at);
CREATE INDEX IF NOT EXISTS registration_events_event_idx
  ON public.registration_events (event, created_at DESC);

-- Schreiben erfolgt ausschliesslich serverseitig (service_role).
-- Lesen nur fuer Admins (RLS-Policy), Anonyme haben keinen Zugriff.
GRANT SELECT ON public.registration_events TO authenticated;
GRANT ALL ON public.registration_events TO service_role;

ALTER TABLE public.registration_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read registration events" ON public.registration_events;
CREATE POLICY "Admins can read registration events"
ON public.registration_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));