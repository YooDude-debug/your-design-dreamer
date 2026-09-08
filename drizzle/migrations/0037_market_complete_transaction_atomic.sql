-- Atomarer Verkaufsabschluss: Vorgang auf `completed` und Artikel auf `sold`
-- in EINER Transaktion. Verhindert, dass ein Artikel nach bestätigter
-- Übergabe als `reserved` haengen bleibt, und verhindert doppelte Ausfuehrung.
CREATE OR REPLACE FUNCTION public.market_complete_transaction(_tx_id uuid, _seller_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item uuid;
  v_status market_transaction_status;
  v_item_status market_item_status;
  v_changed boolean := false;
BEGIN
  SELECT item_id, status INTO v_item, v_status
    FROM public.market_transactions
   WHERE id = _tx_id AND seller_id = _seller_id
   FOR UPDATE;

  IF v_item IS NULL THEN
    RAISE EXCEPTION 'transaction_not_found';
  END IF;

  IF v_status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'cancelled';
  END IF;

  SELECT status INTO v_item_status FROM public.market_items WHERE id = v_item FOR UPDATE;

  -- Bereits vollstaendig abgeschlossen: kein zweiter Handover.
  IF v_status = 'completed' AND v_item_status = 'sold' THEN
    RAISE EXCEPTION 'already_sold';
  END IF;

  IF v_status <> 'completed' THEN
    UPDATE public.market_transactions
       SET status = 'completed', completed_at = COALESCE(completed_at, now())
     WHERE id = _tx_id;
    v_changed := true;
  END IF;

  IF v_item_status <> 'sold' THEN
    UPDATE public.market_items SET status = 'sold' WHERE id = v_item;
    v_changed := true;
  END IF;

  SELECT status INTO v_item_status FROM public.market_items WHERE id = v_item;

  RETURN jsonb_build_object('changed', v_changed, 'item_id', v_item, 'item_status', v_item_status);
END;
$$;

REVOKE ALL ON FUNCTION public.market_complete_transaction(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_complete_transaction(uuid, uuid) TO service_role;