-- 1) Nachrichten additiv um Market-Bezug erweitern
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS market_item_id uuid REFERENCES public.market_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS market_offer_id uuid REFERENCES public.market_offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_market_item_idx
  ON public.messages (conversation_id, created_at DESC)
  WHERE market_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS market_offers_item_status_idx
  ON public.market_offers (item_id, status);
CREATE INDEX IF NOT EXISTS market_offers_buyer_idx ON public.market_offers (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS market_offers_seller_idx ON public.market_offers (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS market_item_channels_channel_idx ON public.market_item_channels (channel_id, created_at DESC);

-- 2) Angebot: Statuswechsel serverseitig absichern
CREATE OR REPLACE FUNCTION public.guard_market_offer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF NEW.item_id <> OLD.item_id
     OR NEW.buyer_id <> OLD.buyer_id
     OR NEW.seller_id <> OLD.seller_id
     OR NEW.amount_cents <> OLD.amount_cents THEN
    RAISE EXCEPTION 'market_offer_immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'open' THEN
      RAISE EXCEPTION 'market_offer_closed';
    END IF;
    IF NEW.status = 'withdrawn' THEN
      IF actor IS NOT NULL AND actor <> OLD.buyer_id THEN
        RAISE EXCEPTION 'market_offer_not_buyer';
      END IF;
    ELSIF NEW.status IN ('accepted', 'declined') THEN
      IF actor IS NOT NULL AND actor <> OLD.seller_id THEN
        RAISE EXCEPTION 'market_offer_not_seller';
      END IF;
    ELSE
      RAISE EXCEPTION 'market_offer_bad_status';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_market_offer_update ON public.market_offers;
CREATE TRIGGER guard_market_offer_update
BEFORE UPDATE ON public.market_offers
FOR EACH ROW EXECUTE FUNCTION public.guard_market_offer_update();

-- 3) Annehmen transaktional (sperrt den Artikel, lehnt Konkurrenzangebote ab)
CREATE OR REPLACE FUNCTION public.market_accept_offer(_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  o public.market_offers;
  itm public.market_items;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO o FROM public.market_offers WHERE id = _offer_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'offer_not_found'; END IF;
  IF o.seller_id <> actor THEN RAISE EXCEPTION 'market_offer_not_seller'; END IF;

  -- Artikel sperren: verhindert gleichzeitige Annahme zweier Angebote
  SELECT * INTO itm FROM public.market_items WHERE id = o.item_id FOR UPDATE;
  IF itm.id IS NULL THEN RAISE EXCEPTION 'item_not_found'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.market_offers
    WHERE item_id = o.item_id AND status = 'accepted' AND id <> o.id
  ) THEN
    RAISE EXCEPTION 'market_offer_already_accepted';
  END IF;

  IF o.status <> 'open' THEN RAISE EXCEPTION 'market_offer_closed'; END IF;

  UPDATE public.market_offers SET status = 'accepted' WHERE id = o.id;
  UPDATE public.market_offers
     SET status = 'declined'
   WHERE item_id = o.item_id AND id <> o.id AND status = 'open';

  IF itm.status = 'active' THEN
    UPDATE public.market_items SET status = 'reserved' WHERE id = itm.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'offerId', o.id, 'itemStatus',
    CASE WHEN itm.status = 'active' THEN 'reserved' ELSE itm.status::text END);
END;
$$;

REVOKE ALL ON FUNCTION public.market_accept_offer(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.market_accept_offer(uuid) TO authenticated;

-- 4) Benachrichtigungen über die bestehende Infrastruktur
CREATE OR REPLACE FUNCTION public.notify_market_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.push_notify(NEW.seller_id, NEW.buyer_id, 'market_offer',
      'Neues Preisangebot', '', 'market_item', NEW.item_id, '/market/' || NEW.item_id::text);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted', 'declined') THEN
    title := CASE WHEN NEW.status = 'accepted' THEN 'Angebot angenommen' ELSE 'Angebot abgelehnt' END;
    PERFORM public.push_notify(NEW.buyer_id, NEW.seller_id, 'market_offer_' || NEW.status::text,
      title, '', 'market_item', NEW.item_id, '/market/' || NEW.item_id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_market_offer_ins ON public.market_offers;
CREATE TRIGGER notify_market_offer_ins
AFTER INSERT ON public.market_offers
FOR EACH ROW EXECUTE FUNCTION public.notify_market_offer();

DROP TRIGGER IF EXISTS notify_market_offer_upd ON public.market_offers;
CREATE TRIGGER notify_market_offer_upd
AFTER UPDATE ON public.market_offers
FOR EACH ROW EXECUTE FUNCTION public.notify_market_offer();