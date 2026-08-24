-- ===== Y-Dude Market Phase 4 =====

-- 1) Promotionsarten
DO $$ BEGIN
  CREATE TYPE public.market_promotion_type AS ENUM ('standard','featured','channel_boost','local_boost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.market_promotion_status AS ENUM ('requested','active','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) market_items erweitern
ALTER TABLE public.market_items
  ADD COLUMN IF NOT EXISTS promotion_type public.market_promotion_type NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS promotion_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS promotion_radius_km integer,
  ADD COLUMN IF NOT EXISTS promotion_disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS promotion_disabled_by uuid;

CREATE INDEX IF NOT EXISTS market_items_promoted_idx
  ON public.market_items (promoted_until DESC)
  WHERE promoted_until IS NOT NULL AND promotion_disabled_at IS NULL;

CREATE INDEX IF NOT EXISTS market_items_seller_status_idx
  ON public.market_items (seller_id, status, created_at DESC);

-- 3) Promotion-Pakete (Preisliste, keine Zahlung)
CREATE TABLE IF NOT EXISTS public.market_promotion_plans (
  code text PRIMARY KEY,
  promotion_type public.market_promotion_type NOT NULL DEFAULT 'featured',
  duration_days integer NOT NULL CHECK (duration_days > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_promotion_plans TO authenticated;
GRANT ALL ON public.market_promotion_plans TO service_role;
ALTER TABLE public.market_promotion_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans readable" ON public.market_promotion_plans;
CREATE POLICY "plans readable" ON public.market_promotion_plans
  FOR SELECT TO authenticated USING (active);

INSERT INTO public.market_promotion_plans (code, promotion_type, duration_days, price_cents, sort_order)
VALUES ('featured_3', 'featured', 3, 299, 1),
       ('featured_7', 'featured', 7, 599, 2),
       ('featured_30','featured',30, 1999, 3)
ON CONFLICT (code) DO NOTHING;

-- 4) Promotion-Anfragen (ohne Zahlungsdaten)
CREATE TABLE IF NOT EXISTS public.market_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.market_items(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  plan_code text REFERENCES public.market_promotion_plans(code),
  promotion_type public.market_promotion_type NOT NULL DEFAULT 'featured',
  duration_days integer NOT NULL DEFAULT 3,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status public.market_promotion_status NOT NULL DEFAULT 'requested',
  radius_km integer,
  starts_at timestamptz,
  ends_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.market_promotions TO authenticated;
GRANT ALL ON public.market_promotions TO service_role;
ALTER TABLE public.market_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own promotions read" ON public.market_promotions;
CREATE POLICY "own promotions read" ON public.market_promotions
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "own promotions insert" ON public.market_promotions;
CREATE POLICY "own promotions insert" ON public.market_promotions
  FOR INSERT TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.market_items i WHERE i.id = item_id AND i.seller_id = auth.uid())
  );

DROP POLICY IF EXISTS "own promotions update" ON public.market_promotions;
CREATE POLICY "own promotions update" ON public.market_promotions
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS market_promotions_item_idx ON public.market_promotions (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS market_promotions_seller_idx ON public.market_promotions (seller_id, created_at DESC);

DROP TRIGGER IF EXISTS market_promotions_updated_at ON public.market_promotions;
CREATE TRIGGER market_promotions_updated_at
  BEFORE UPDATE ON public.market_promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Verkäuferprofil (privat / Unternehmen) – ergänzt profiles, ersetzt sie nicht
CREATE TABLE IF NOT EXISTS public.market_seller_profiles (
  user_id uuid PRIMARY KEY,
  seller_type text NOT NULL DEFAULT 'private' CHECK (seller_type IN ('private','business','professional')),
  business_name text,
  logo_path text,
  description text,
  website text,
  verified_business boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.market_seller_profiles TO authenticated;
GRANT ALL ON public.market_seller_profiles TO service_role;
ALTER TABLE public.market_seller_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller profiles readable" ON public.market_seller_profiles;
CREATE POLICY "seller profiles readable" ON public.market_seller_profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "seller profile insert own" ON public.market_seller_profiles;
CREATE POLICY "seller profile insert own" ON public.market_seller_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "seller profile update own" ON public.market_seller_profiles;
CREATE POLICY "seller profile update own" ON public.market_seller_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS market_seller_profiles_updated_at ON public.market_seller_profiles;
CREATE TRIGGER market_seller_profiles_updated_at
  BEFORE UPDATE ON public.market_seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Unternehmen dürfen sich nicht selbst als geprüft markieren
CREATE OR REPLACE FUNCTION public.guard_market_seller_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.verified_business := COALESCE(OLD.verified_business, false);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_market_seller_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS market_seller_profile_guard ON public.market_seller_profiles;
CREATE TRIGGER market_seller_profile_guard
  BEFORE INSERT OR UPDATE ON public.market_seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_market_seller_profile();

-- 6) Produkt-Analytics (wenige, klar definierte Ereignisse, keine Freitexte)
CREATE TABLE IF NOT EXISTS public.market_analytics_events (
  id bigserial PRIMARY KEY,
  event text NOT NULL CHECK (event IN (
    'market_item_view','market_item_favorite','market_contact_seller',
    'market_offer_created','market_offer_accepted','market_search',
    'market_item_promoted','market_channel_click','market_slangtag_play')),
  item_id uuid REFERENCES public.market_items(id) ON DELETE CASCADE,
  seller_id uuid,
  actor_id uuid,
  category_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT, SELECT ON public.market_analytics_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.market_analytics_events_id_seq TO authenticated;
GRANT ALL ON public.market_analytics_events TO service_role;
GRANT ALL ON SEQUENCE public.market_analytics_events_id_seq TO service_role;
ALTER TABLE public.market_analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics insert own" ON public.market_analytics_events;
CREATE POLICY "analytics insert own" ON public.market_analytics_events
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "analytics read own scope" ON public.market_analytics_events;
CREATE POLICY "analytics read own scope" ON public.market_analytics_events
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS market_analytics_item_idx ON public.market_analytics_events (item_id, event, created_at DESC);
CREATE INDEX IF NOT EXISTS market_analytics_seller_idx ON public.market_analytics_events (seller_id, event, created_at DESC);
CREATE INDEX IF NOT EXISTS market_analytics_event_idx ON public.market_analytics_events (event, created_at DESC);

-- 7) Werbekampagnen: reine Architekturvorbereitung, noch nicht aktiv
CREATE TABLE IF NOT EXISTS public.market_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL,
  title text NOT NULL,
  slang_tag_id uuid,
  target_channel_id uuid,
  target_lat double precision,
  target_lon double precision,
  target_radius_km integer,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','scheduled','active','paused','ended')),
  budget_cents integer,
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.market_ad_campaigns TO authenticated;
GRANT ALL ON public.market_ad_campaigns TO service_role;
ALTER TABLE public.market_ad_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns own" ON public.market_ad_campaigns;
CREATE POLICY "campaigns own" ON public.market_ad_campaigns
  FOR SELECT TO authenticated
  USING (advertiser_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "campaigns insert own" ON public.market_ad_campaigns;
CREATE POLICY "campaigns insert own" ON public.market_ad_campaigns
  FOR INSERT TO authenticated WITH CHECK (advertiser_id = auth.uid());

DROP POLICY IF EXISTS "campaigns update own" ON public.market_ad_campaigns;
CREATE POLICY "campaigns update own" ON public.market_ad_campaigns
  FOR UPDATE TO authenticated
  USING (advertiser_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (advertiser_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS market_ad_campaigns_updated_at ON public.market_ad_campaigns;
CREATE TRIGGER market_ad_campaigns_updated_at
  BEFORE UPDATE ON public.market_ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8) Verkäuferstatistik
CREATE OR REPLACE FUNCTION public.market_seller_stats(_seller uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _seller IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin')
      THEN '{}'::jsonb
    ELSE jsonb_build_object(
      'activeItems', (SELECT count(*) FROM public.market_items WHERE seller_id = _seller AND status = 'active'),
      'reservedItems', (SELECT count(*) FROM public.market_items WHERE seller_id = _seller AND status = 'reserved'),
      'soldItems', (SELECT count(*) FROM public.market_items WHERE seller_id = _seller AND status = 'sold'),
      'promotedItems', (SELECT count(*) FROM public.market_items
                          WHERE seller_id = _seller AND status = 'active'
                            AND promoted_until > now() AND promotion_disabled_at IS NULL),
      'views', (SELECT COALESCE(sum(views_count),0) FROM public.market_items WHERE seller_id = _seller),
      'favorites', (SELECT count(*) FROM public.market_favorites f
                      JOIN public.market_items i ON i.id = f.item_id WHERE i.seller_id = _seller),
      'contacts', (SELECT count(*) FROM public.market_analytics_events
                     WHERE seller_id = _seller AND event = 'market_contact_seller'),
      'offers', (SELECT count(*) FROM public.market_offers WHERE seller_id = _seller),
      'offersOpen', (SELECT count(*) FROM public.market_offers WHERE seller_id = _seller AND status = 'open')
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.market_seller_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_seller_stats(uuid) TO authenticated;

-- 9) Duplikaterkennung (regelbasiert, nur protokollieren)
CREATE OR REPLACE FUNCTION public.market_flag_duplicate_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dupes int;
BEGIN
  SELECT count(*) INTO dupes
  FROM public.market_items i
  WHERE i.seller_id = NEW.seller_id
    AND i.id <> NEW.id
    AND i.status <> 'deleted'
    AND i.created_at > now() - interval '24 hours'
    AND lower(btrim(i.title)) = lower(btrim(NEW.title));

  IF dupes >= 2 THEN
    INSERT INTO public.content_moderation_log (user_id, content_type, content_id, decision, reason, flags, ai)
    VALUES (NEW.seller_id, 'post', NEW.id, 'flagged',
            'market_duplicate_item', jsonb_build_array('market','duplicate'), false);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.market_flag_duplicate_item() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS market_items_duplicate_guard ON public.market_items;
CREATE TRIGGER market_items_duplicate_guard
  AFTER INSERT ON public.market_items
  FOR EACH ROW EXECUTE FUNCTION public.market_flag_duplicate_item();

-- 10) Tempolimits (bestehende Infrastruktur wiederverwenden)
DROP TRIGGER IF EXISTS market_items_rate_limit ON public.market_items;
CREATE TRIGGER market_items_rate_limit
  BEFORE INSERT ON public.market_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit('seller_id', '15', '60');

DROP TRIGGER IF EXISTS market_offers_rate_limit ON public.market_offers;
CREATE TRIGGER market_offers_rate_limit
  BEFORE INSERT ON public.market_offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit('buyer_id', '30', '60');

DROP TRIGGER IF EXISTS market_promotions_rate_limit ON public.market_promotions;
CREATE TRIGGER market_promotions_rate_limit
  BEFORE INSERT ON public.market_promotions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit('seller_id', '20', '60');

-- 11) Meldungen: Market-Ziele ergänzen
ALTER TYPE public.report_target_type ADD VALUE IF NOT EXISTS 'market_item';
ALTER TYPE public.report_target_type ADD VALUE IF NOT EXISTS 'market_seller';