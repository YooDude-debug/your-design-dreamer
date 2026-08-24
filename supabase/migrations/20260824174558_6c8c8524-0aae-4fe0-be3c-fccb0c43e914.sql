-- ===== Enums =====
CREATE TYPE public.market_transaction_status AS ENUM (
  'pending','payment_pending','paid','processing','ready_for_pickup',
  'shipped','completed','cancelled','refunded','disputed'
);
CREATE TYPE public.market_payment_status AS ENUM (
  'unpaid','pending','paid','failed','refunded','partially_refunded','cancelled'
);
CREATE TYPE public.market_shipping_status AS ENUM (
  'not_required','awaiting_shipment','shipped','delivered'
);
CREATE TYPE public.market_fulfillment_type AS ENUM ('pickup','shipping');
CREATE TYPE public.market_refund_status AS ENUM ('requested','processing','completed','failed');
CREATE TYPE public.market_dispute_status AS ENUM ('open','in_review','resolved','rejected');

-- ===== Item extensions =====
ALTER TABLE public.market_items
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shipping_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buy_now_enabled boolean NOT NULL DEFAULT false;

-- ===== Fee settings (configurable, default 0) =====
CREATE TABLE public.market_fee_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  platform_fee_bps integer NOT NULL DEFAULT 0 CHECK (platform_fee_bps >= 0 AND platform_fee_bps <= 5000),
  platform_fee_fixed_cents integer NOT NULL DEFAULT 0 CHECK (platform_fee_fixed_cents >= 0),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.market_fee_settings (id) VALUES (true);
GRANT SELECT ON public.market_fee_settings TO authenticated;
GRANT ALL ON public.market_fee_settings TO service_role;
ALTER TABLE public.market_fee_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fee settings readable" ON public.market_fee_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins change fee settings" ON public.market_fee_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== Transactions =====
CREATE TABLE public.market_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  item_id uuid NOT NULL REFERENCES public.market_items(id) ON DELETE RESTRICT,
  offer_id uuid REFERENCES public.market_offers(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  currency text NOT NULL DEFAULT 'EUR',
  item_price_cents integer NOT NULL CHECK (item_price_cents >= 0),
  shipping_price_cents integer NOT NULL DEFAULT 0 CHECK (shipping_price_cents >= 0),
  platform_fee_cents integer NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  payment_fee_cents integer NOT NULL DEFAULT 0 CHECK (payment_fee_cents >= 0),
  seller_amount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  fulfillment_type public.market_fulfillment_type NOT NULL,
  status public.market_transaction_status NOT NULL DEFAULT 'pending',
  payment_status public.market_payment_status NOT NULL DEFAULT 'unpaid',
  shipping_status public.market_shipping_status NOT NULL DEFAULT 'not_required',
  paid_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);
CREATE INDEX idx_market_tx_buyer ON public.market_transactions(buyer_id, created_at DESC, id DESC);
CREATE INDEX idx_market_tx_seller ON public.market_transactions(seller_id, created_at DESC, id DESC);
CREATE INDEX idx_market_tx_item ON public.market_transactions(item_id);
CREATE INDEX idx_market_tx_status ON public.market_transactions(status, created_at DESC);
-- Only one live transaction per item (single-unit protection)
CREATE UNIQUE INDEX uniq_market_tx_open_item ON public.market_transactions(item_id)
  WHERE status IN ('pending','payment_pending','paid','processing','ready_for_pickup','shipped','disputed');

GRANT SELECT ON public.market_transactions TO authenticated;
GRANT ALL ON public.market_transactions TO service_role;
ALTER TABLE public.market_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read transactions" ON public.market_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));

-- ===== Event log (append-only, server managed) =====
CREATE TABLE public.market_transaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.market_transactions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_market_tx_events ON public.market_transaction_events(transaction_id, created_at);
GRANT SELECT ON public.market_transaction_events TO authenticated;
GRANT ALL ON public.market_transaction_events TO service_role;
ALTER TABLE public.market_transaction_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read events" ON public.market_transaction_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.market_transactions t
    WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- ===== Payment records (provider references only) =====
CREATE TABLE public.market_payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.market_transactions(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  provider_session_id text,
  provider_payment_intent_id text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_market_payment_session ON public.market_payment_records(provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;
CREATE INDEX idx_market_payment_tx ON public.market_payment_records(transaction_id);
GRANT SELECT ON public.market_payment_records TO authenticated;
GRANT ALL ON public.market_payment_records TO service_role;
ALTER TABLE public.market_payment_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read payment records" ON public.market_payment_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.market_transactions t
    WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- ===== Webhook idempotency =====
CREATE TABLE public.market_payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  event_id text NOT NULL,
  event_type text NOT NULL,
  transaction_id uuid REFERENCES public.market_transactions(id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
GRANT ALL ON public.market_payment_webhook_events TO service_role;
ALTER TABLE public.market_payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- ===== Shipping =====
CREATE TABLE public.market_shipping (
  transaction_id uuid PRIMARY KEY REFERENCES public.market_transactions(id) ON DELETE CASCADE,
  method text,
  carrier text,
  tracking_number text,
  cost_cents integer NOT NULL DEFAULT 0,
  address jsonb,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_shipping TO authenticated;
GRANT ALL ON public.market_shipping TO service_role;
ALTER TABLE public.market_shipping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read shipping" ON public.market_shipping
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.market_transactions t
    WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- ===== Pickup secrets (buyer only) =====
CREATE TABLE public.market_transaction_secrets (
  transaction_id uuid PRIMARY KEY REFERENCES public.market_transactions(id) ON DELETE CASCADE,
  pickup_code text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_transaction_secrets TO authenticated;
GRANT ALL ON public.market_transaction_secrets TO service_role;
ALTER TABLE public.market_transaction_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyer reads pickup code" ON public.market_transaction_secrets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.market_transactions t
    WHERE t.id = transaction_id AND t.buyer_id = auth.uid()
  ));

-- ===== Refunds =====
CREATE TABLE public.market_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.market_transactions(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  reason text,
  status public.market_refund_status NOT NULL DEFAULT 'requested',
  requested_by uuid NOT NULL,
  decided_by uuid,
  provider_refund_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_market_refunds_tx ON public.market_refunds(transaction_id);
CREATE UNIQUE INDEX uniq_market_refund_provider ON public.market_refunds(provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;
GRANT SELECT ON public.market_refunds TO authenticated;
GRANT ALL ON public.market_refunds TO service_role;
ALTER TABLE public.market_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read refunds" ON public.market_refunds
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.market_transactions t
    WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- ===== Disputes =====
CREATE TABLE public.market_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.market_transactions(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL,
  reason_code text NOT NULL,
  details text,
  status public.market_dispute_status NOT NULL DEFAULT 'open',
  resolution text,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_market_disputes_tx ON public.market_disputes(transaction_id);
CREATE INDEX idx_market_disputes_status ON public.market_disputes(status, created_at DESC);
GRANT SELECT ON public.market_disputes TO authenticated;
GRANT ALL ON public.market_disputes TO service_role;
ALTER TABLE public.market_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read disputes" ON public.market_disputes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.market_transactions t
    WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- ===== updated_at triggers =====
CREATE TRIGGER trg_market_tx_updated BEFORE UPDATE ON public.market_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_market_payment_updated BEFORE UPDATE ON public.market_payment_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_market_shipping_updated BEFORE UPDATE ON public.market_shipping
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_market_refunds_updated BEFORE UPDATE ON public.market_refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_market_disputes_updated BEFORE UPDATE ON public.market_disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_market_fee_updated BEFORE UPDATE ON public.market_fee_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Event log immutability for normal users =====
CREATE OR REPLACE FUNCTION public.guard_transaction_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'transaction events are append-only';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_transaction_events() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_market_tx_events_immutable
  BEFORE UPDATE OR DELETE ON public.market_transaction_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_transaction_events();

-- ===== Atomic purchase start =====
CREATE OR REPLACE FUNCTION public.market_start_transaction(
  _item_id uuid,
  _buyer_id uuid,
  _fulfillment public.market_fulfillment_type,
  _offer_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.market_items%ROWTYPE;
  v_amount integer;
  v_shipping integer := 0;
  v_fee_bps integer := 0;
  v_fee_fixed integer := 0;
  v_platform_fee integer := 0;
  v_total integer;
  v_tx_id uuid;
  v_ref text;
  v_code text;
BEGIN
  SELECT * INTO v_item FROM public.market_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found'; END IF;
  IF v_item.seller_id = _buyer_id THEN RAISE EXCEPTION 'own_item'; END IF;
  IF v_item.status <> 'active' THEN RAISE EXCEPTION 'item_not_available'; END IF;
  IF NOT v_item.buy_now_enabled THEN RAISE EXCEPTION 'checkout_disabled'; END IF;

  IF _fulfillment = 'pickup' AND v_item.delivery = 'shipping' THEN
    RAISE EXCEPTION 'fulfillment_not_available';
  END IF;
  IF _fulfillment = 'shipping' AND v_item.delivery = 'pickup' THEN
    RAISE EXCEPTION 'fulfillment_not_available';
  END IF;

  -- Price snapshot: accepted offer of this buyer, otherwise list price
  IF _offer_id IS NOT NULL THEN
    SELECT amount_cents INTO v_amount
    FROM public.market_offers
    WHERE id = _offer_id
      AND item_id = _item_id
      AND buyer_id = _buyer_id
      AND status = 'accepted';
    IF v_amount IS NULL THEN RAISE EXCEPTION 'offer_invalid'; END IF;
  ELSE
    v_amount := v_item.price_cents;
  END IF;

  IF _fulfillment = 'shipping' THEN
    v_shipping := COALESCE(v_item.shipping_price_cents, 0);
  END IF;

  SELECT platform_fee_bps, platform_fee_fixed_cents
    INTO v_fee_bps, v_fee_fixed
  FROM public.market_fee_settings WHERE id = true;

  v_total := v_amount + v_shipping;
  v_platform_fee := ((v_amount * COALESCE(v_fee_bps, 0)) / 10000) + COALESCE(v_fee_fixed, 0);

  v_ref := 'YD-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  INSERT INTO public.market_transactions (
    reference, item_id, offer_id, seller_id, buyer_id, quantity, currency,
    item_price_cents, shipping_price_cents, platform_fee_cents, seller_amount_cents,
    total_cents, fulfillment_type, status, payment_status, shipping_status
  ) VALUES (
    v_ref, _item_id, _offer_id, v_item.seller_id, _buyer_id, 1, v_item.currency,
    v_amount, v_shipping, v_platform_fee, GREATEST(v_total - v_platform_fee, 0),
    v_total, _fulfillment, 'pending', 'unpaid',
    CASE WHEN _fulfillment = 'shipping' THEN 'awaiting_shipment'::public.market_shipping_status
         ELSE 'not_required'::public.market_shipping_status END
  ) RETURNING id INTO v_tx_id;

  INSERT INTO public.market_transaction_secrets (transaction_id, pickup_code)
  VALUES (v_tx_id, v_code);

  IF _fulfillment = 'shipping' THEN
    INSERT INTO public.market_shipping (transaction_id, cost_cents) VALUES (v_tx_id, v_shipping);
  END IF;

  INSERT INTO public.market_transaction_events (transaction_id, event_type, actor_id, meta)
  VALUES (v_tx_id, 'transaction_created', _buyer_id,
          jsonb_build_object('amount_cents', v_amount, 'shipping_cents', v_shipping, 'fulfillment', _fulfillment));

  UPDATE public.market_items SET status = 'reserved', updated_at = now() WHERE id = _item_id;

  RETURN v_tx_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.market_start_transaction(uuid, uuid, public.market_fulfillment_type, uuid) FROM PUBLIC, anon, authenticated;

-- ===== Favorites: notify on sold =====
CREATE OR REPLACE FUNCTION public.notify_favorites_item_sold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.status = 'sold' AND OLD.status IS DISTINCT FROM 'sold' THEN
    FOR r IN SELECT user_id FROM public.market_favorites WHERE item_id = NEW.id LOOP
      IF r.user_id <> NEW.seller_id THEN
        PERFORM public.push_notify(
          r.user_id, NEW.seller_id, 'market_item_sold',
          'Artikel verkauft', NEW.title, 'market_item', NEW.id, '/market/' || NEW.id::text
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_favorites_item_sold() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_market_item_sold_favorites
  AFTER UPDATE OF status ON public.market_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_favorites_item_sold();