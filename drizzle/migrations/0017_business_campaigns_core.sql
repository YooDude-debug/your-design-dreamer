-- Business-Kampagnen V1: minimale Erweiterung der bestehenden Kampagnentabelle.
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS caption text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'development';

CREATE INDEX IF NOT EXISTS ad_campaigns_serving_idx
  ON public.ad_campaigns (status, environment, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS ad_campaigns_owner_idx
  ON public.ad_campaigns (owner_id, status);

-- Kampagnenlimit je Business-Stufe (einzige Wahrheitsquelle).
CREATE OR REPLACE FUNCTION public.business_campaign_limit(_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _tier WHEN 'business_pro' THEN 5 WHEN 'business' THEN 2 ELSE 0 END
$$;

REVOKE EXECUTE ON FUNCTION public.business_campaign_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_campaign_limit(text) TO authenticated, service_role;

-- Serverseitige Durchsetzung des Limits: greift auch bei direkter API-Manipulation.
CREATE OR REPLACE FUNCTION public.enforce_business_campaign_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tier text;
  _limit integer;
  _active integer;
  _env text := coalesce(NEW.environment, 'development');
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS NULL OR public.has_role(NEW.owner_id, 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND OLD.owner_id = NEW.owner_id
     AND coalesce(OLD.environment, 'development') = _env THEN
    RETURN NEW;
  END IF;
  IF NOT public.has_role(NEW.owner_id, 'business') THEN
    RAISE EXCEPTION 'business_role_required' USING ERRCODE = '42501';
  END IF;
  _tier := coalesce(public.business_plan_tier(NEW.owner_id, _env), 'free');
  _limit := public.business_campaign_limit(_tier);
  IF _limit = 0 THEN
    RAISE EXCEPTION 'business_subscription_required' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO _active
  FROM public.ad_campaigns
  WHERE owner_id = NEW.owner_id
    AND status = 'active'
    AND coalesce(environment, 'development') = _env
    AND id <> NEW.id;
  IF _active >= _limit THEN
    RAISE EXCEPTION 'campaign_limit_reached' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS enforce_business_campaign_limit_trg ON public.ad_campaigns;
CREATE TRIGGER enforce_business_campaign_limit_trg
  BEFORE INSERT OR UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_campaign_limit();

-- Eigentum der verwendeten SlangTags erzwingen (kein fremdes Werbemittel).
CREATE OR REPLACE FUNCTION public.enforce_campaign_slang_tag_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF NEW.slang_tag_id IS NULL OR NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(NEW.owner_id, 'admin') THEN
    RETURN NEW;
  END IF;
  SELECT owner_id INTO _owner FROM public.slang_tags WHERE id = NEW.slang_tag_id;
  IF _owner IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'slang_tag_not_owned' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS enforce_campaign_slang_tag_owner_trg ON public.ad_campaigns;
CREATE TRIGGER enforce_campaign_slang_tag_owner_trg
  BEFORE INSERT OR UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_slang_tag_owner();

-- Eigene Kampagnen: nur echte Unternehmerkonten, nur eigene Datensätze.
DROP POLICY IF EXISTS ad_campaigns_insert_own ON public.ad_campaigns;
CREATE POLICY ad_campaigns_insert_own ON public.ad_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()), 'business')
  );

DROP POLICY IF EXISTS ad_campaigns_update_own ON public.ad_campaigns;
CREATE POLICY ad_campaigns_update_own ON public.ad_campaigns
  FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()), 'business')
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()), 'business')
  );

DROP POLICY IF EXISTS ad_campaigns_delete_own ON public.ad_campaigns;
CREATE POLICY ad_campaigns_delete_own ON public.ad_campaigns
  FOR DELETE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()), 'business')
  );