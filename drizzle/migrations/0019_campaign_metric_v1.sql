CREATE OR REPLACE FUNCTION public.increment_campaign_metric(_id uuid, _kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _kind = 'click' THEN
    UPDATE public.ad_campaigns SET clicks = clicks + 1, updated_at = now() WHERE id = _id;
  ELSE
    UPDATE public.ad_campaigns SET impressions = impressions + 1, updated_at = now() WHERE id = _id;
  END IF;
END
$$;

REVOKE EXECUTE ON FUNCTION public.increment_campaign_metric(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_campaign_metric(uuid, text) TO service_role;