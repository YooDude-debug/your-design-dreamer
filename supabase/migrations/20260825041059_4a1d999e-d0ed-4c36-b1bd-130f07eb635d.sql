-- 1) Abos
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_env_idx
  ON public.subscriptions (user_id, environment, created_at DESC);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Zahlungsfelder für Hervorhebungen
ALTER TABLE public.market_promotions
  ADD COLUMN IF NOT EXISTS payment_status public.market_payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS provider_session_id text,
  ADD COLUMN IF NOT EXISTS provider_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS paid_amount_cents integer,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS environment text;

CREATE UNIQUE INDEX IF NOT EXISTS market_promotions_session_idx
  ON public.market_promotions (provider_session_id)
  WHERE provider_session_id IS NOT NULL;

-- 3) Abostatus-Hilfsfunktionen
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid, _environment text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND environment = _environment
      AND (
        (status IN ('active','trialing','past_due')
          AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  )
$$;

REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.business_plan_tier(_user_id uuid, _environment text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN price_id IN ('business_pro_monthly','business_pro_yearly') THEN 'business_pro'
    WHEN price_id IN ('business_monthly','business_yearly') THEN 'business'
    ELSE 'free'
  END
  FROM public.subscriptions
  WHERE user_id = _user_id
    AND environment = _environment
    AND (
      (status IN ('active','trialing','past_due')
        AND (current_period_end IS NULL OR current_period_end > now()))
      OR (status = 'canceled' AND current_period_end > now())
    )
  ORDER BY
    CASE WHEN price_id IN ('business_pro_monthly','business_pro_yearly') THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.business_plan_tier(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_plan_tier(uuid, text) TO authenticated, service_role;

-- 4) Abgelaufene Hervorhebungen automatisch beenden
CREATE OR REPLACE FUNCTION public.market_expire_promotions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.market_promotions
     SET status = 'expired'
   WHERE status = 'active'
     AND ends_at IS NOT NULL
     AND ends_at <= now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.market_expire_promotions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_expire_promotions() TO service_role;