ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirm_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;

ALTER TABLE public.newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_status_check;
ALTER TABLE public.newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_status_check CHECK (status IN ('pending','verified'));

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_confirm_token_key
  ON public.newsletter_subscribers (confirm_token) WHERE confirm_token IS NOT NULL;

-- Bestandsdaten gelten als bestätigt (wurden vor Double-Opt-in erfasst)
UPDATE public.newsletter_subscribers
  SET status = 'verified', confirmed_at = COALESCE(confirmed_at, consent_at, created_at)
  WHERE status = 'pending' AND confirm_token IS NULL;

-- Zugriff ausschließlich über Server-Code (service_role)
REVOKE ALL ON public.newsletter_subscribers FROM anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

CREATE TABLE IF NOT EXISTS public.ad_preferences (
  user_id uuid PRIMARY KEY,
  interests text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_preferences TO authenticated;
GRANT ALL ON public.ad_preferences TO service_role;
ALTER TABLE public.ad_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ad_preferences_own ON public.ad_preferences;
CREATE POLICY ad_preferences_own ON public.ad_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.travel_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  country text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS travel_plans_user_id_idx ON public.travel_plans (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_plans TO authenticated;
GRANT ALL ON public.travel_plans TO service_role;
ALTER TABLE public.travel_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS travel_plans_own ON public.travel_plans;
CREATE POLICY travel_plans_own ON public.travel_plans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS update_ad_preferences_updated_at ON public.ad_preferences;
CREATE TRIGGER update_ad_preferences_updated_at BEFORE UPDATE ON public.ad_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS update_travel_plans_updated_at ON public.travel_plans;
CREATE TRIGGER update_travel_plans_updated_at BEFORE UPDATE ON public.travel_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();