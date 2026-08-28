DROP POLICY IF EXISTS market_offers_insert_buyer ON public.market_offers;
CREATE POLICY market_offers_insert_buyer ON public.market_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND buyer_id <> seller_id
    AND (
      conversation_id IS NULL
      OR public.is_conversation_member(conversation_id, auth.uid())
    )
  );