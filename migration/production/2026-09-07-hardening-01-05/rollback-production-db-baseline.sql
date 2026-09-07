-- =====================================================================
-- PRODUCTION DB ROLLBACK-BASELINE – Hardening #1–#5
-- Stand: 2026-09-07 (vor Ausführung der vier Paket-Migrationen)
-- Quelle: read-only Abfragen der Production-Datenbank
--         (pg_proc / pg_get_functiondef / pg_class.relacl)
--
-- ZWECK: Wiederherstellung des exakten Vorher-Zustands der von den vier
--        Migrationen berührten Funktionen und Berechtigungen.
--
-- NICHT AUSGEFÜHRT. Diese Datei ist eine Sicherung, keine Migration.
--        Sie liegt bewusst NICHT unter drizzle/migrations oder
--        supabase/migrations und wird von keinem Migrator eingelesen.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A) FUNKTIONS-DEFINITIONEN (Vorher-Stand, unverändert exportiert)
-- ---------------------------------------------------------------------

-- A.1 promote_exclusive_drops(uuid) – Vorher-Stand (ohne Ownership-Prüfung)
CREATE OR REPLACE FUNCTION public.promote_exclusive_drops(_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  UPDATE public.slang_tag_library l
     SET is_permanent = true
   WHERE l.user_id = _user_id
     AND l.is_permanent = false
     AND l.revoked_at IS NULL
     AND l.lapsed_at IS NULL
     AND l.permanent_after IS NOT NULL
     AND l.permanent_after <= now()
     AND (
       public.has_active_creator_subscription(l.user_id, l.creator_id, 'sandbox')
       OR public.has_active_creator_subscription(l.user_id, l.creator_id, 'live')
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;


-- A.2 market_start_transaction(uuid, uuid, market_fulfillment_type, uuid)
--     Vorher-Stand (mit buy_now_enabled-Gate 'checkout_disabled')
CREATE OR REPLACE FUNCTION public.market_start_transaction(_item_id uuid, _buyer_id uuid, _fulfillment market_fulfillment_type, _offer_id uuid DEFAULT NULL::uuid)
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
$function$;


-- A.3 mark_conversation_read(uuid) – Vorher-Stand (COUNT + UPDATE)
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _now timestamptz := now();
  _last_read timestamptz;
  _last_message timestamptz;
  _unread int;
  _touched int := 0;
  _wrote boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT cm.last_read_at INTO _last_read
    FROM public.conversation_members cm
   WHERE cm.conversation_id = _conversation_id
     AND cm.user_id = _uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this conversation';
  END IF;

  SELECT c.last_message_at INTO _last_message
    FROM public.conversations c
   WHERE c.id = _conversation_id;

  SELECT count(*) INTO _unread
    FROM public.messages m
   WHERE m.conversation_id = _conversation_id
     AND m.read_at IS NULL
     AND m.sender_id <> _uid;

  IF _unread > 0 THEN
    UPDATE public.messages m
       SET read_at = _now
     WHERE m.conversation_id = _conversation_id
       AND m.read_at IS NULL
       AND m.sender_id <> _uid;
    _touched := _unread;
  END IF;

  -- Zeitstempel nur schreiben, wenn er wirklich veraltet ist.
  IF _touched > 0
     OR _last_read IS NULL
     OR (_last_message IS NOT NULL AND _last_read < _last_message)
  THEN
    UPDATE public.conversation_members cm
       SET last_read_at = _now
     WHERE cm.conversation_id = _conversation_id
       AND cm.user_id = _uid
       AND (cm.last_read_at IS NULL OR cm.last_read_at < _now);
    _wrote := true;
  END IF;

  RETURN jsonb_build_object(
    'conversation_id', _conversation_id,
    'last_read_at', CASE WHEN _wrote THEN _now ELSE _last_read END,
    'messages_marked', _touched,
    'wrote', _wrote
  );
END;
$function$;


-- ---------------------------------------------------------------------
-- B) FUNKTIONS-EXECUTE-RECHTE (Vorher-Stand)
-- ---------------------------------------------------------------------
-- Vorher-ACL laut pg_proc.proacl:
--   promote_exclusive_drops(uuid)      : postgres, authenticated, service_role
--   market_start_transaction(...)      : postgres, service_role
--   mark_conversation_read(uuid)       : postgres, service_role, authenticated
--   has_role / are_connected / is_following / can_view_post /
--   test_user_visible                  : postgres, anon, authenticated, service_role
--   guard_* / reserved_usernames_normalize (Trigger):
--                                        PUBLIC, postgres, anon, authenticated, service_role

GRANT EXECUTE ON FUNCTION public.promote_exclusive_drops(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.market_start_transaction(uuid, uuid, market_fulfillment_type, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated, service_role;

-- Von Migration #1 entzogene EXECUTE-Rechte (Wiederherstellung):
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.are_connected(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_following(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.test_user_visible(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.guard_connection_update() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_profile_identity() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_profile_internal_fields() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_reserved_username() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_slang_tag_identity() TO anon;
GRANT EXECUTE ON FUNCTION public.reserved_usernames_normalize() TO anon;


-- ---------------------------------------------------------------------
-- C) TABELLEN-RECHTE (Vorher-Stand, laut pg_class.relacl)
-- ---------------------------------------------------------------------
-- public.slang_tag_track_dedup
--   anon          : SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
--   authenticated : SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
--   service_role  : SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
-- public.comments
--   anon          : SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER
--   authenticated : SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
-- public.messages
--   anon          : SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER
--   authenticated : SELECT, INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER
-- (postgres und sandbox_exec sind Plattform-/Werkzeugrollen und werden von
--  den Migrationen nicht berührt.)

GRANT ALL ON public.slang_tag_track_dedup TO anon;
GRANT ALL ON public.slang_tag_track_dedup TO authenticated;
GRANT ALL ON public.slang_tag_track_dedup TO service_role;

GRANT SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.comments TO anon;
GRANT SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.messages TO anon;


-- ---------------------------------------------------------------------
-- D) NICHT ENTHALTEN / NICHT NÖTIG
-- ---------------------------------------------------------------------
-- - Keine Tabellenstruktur-, Policy- oder Datenänderung durch die vier
--   Migrationen -> keine entsprechende Rollback-Aussage nötig.
-- - RLS bleibt auf allen drei Tabellen aktiviert (relrowsecurity = true).
-- - Policies: comments 3, messages 5, slang_tag_track_dedup 0 (unverändert).
