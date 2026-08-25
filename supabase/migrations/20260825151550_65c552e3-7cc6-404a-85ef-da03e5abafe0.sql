REVOKE ALL ON FUNCTION public.market_expire_promotions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.market_expire_promotions() TO service_role;

REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.business_plan_tier(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_plan_tier(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated, service_role;