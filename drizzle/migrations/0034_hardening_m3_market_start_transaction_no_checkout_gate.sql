CREATE OR REPLACE FUNCTION public.market_start_transaction(
  _item_id uuid,
  _buyer_id uuid,
  _fulfillment market_fulfillment_type,
  _offer_id uuid DEFAULT NULL::uuid
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Kein Checkout-Gate mehr: Kaeufer und Verkaeufer wickeln selbst ab.

  IF _fulfillment = 'pickup' AND v_item.delivery = 'shipping' THEN
    RAISE EXCEPTION 'fulfillment_not_available';
  END IF;
  IF _fulfillment = 'shipping' AND v_item.delivery = 'pickup' THEN
    RAISE EXCEPTION 'fulfillment_not_available';
  END IF;

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
$function$;

REVOKE ALL ON FUNCTION public.market_start_transaction(uuid, uuid, market_fulfillment_type, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.market_start_transaction(uuid, uuid, market_fulfillment_type, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.market_start_transaction(uuid, uuid, market_fulfillment_type, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.market_start_transaction(uuid, uuid, market_fulfillment_type, uuid) TO service_role;