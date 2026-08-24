REVOKE ALL ON public.market_payment_webhook_events FROM anon, authenticated;
GRANT ALL ON public.market_payment_webhook_events TO service_role;

REVOKE ALL ON public.market_transaction_secrets FROM anon, authenticated;
GRANT SELECT ON public.market_transaction_secrets TO authenticated;
GRANT ALL ON public.market_transaction_secrets TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.hashtags FROM anon, authenticated;
GRANT SELECT ON public.hashtags TO authenticated;
GRANT ALL ON public.hashtags TO service_role;

REVOKE ALL ON FUNCTION public.guard_market_offer_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_market_offer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_accept_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_accept_offer(uuid) TO authenticated;