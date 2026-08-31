-- 1. Preisgrenzen 2,99 € .. 99,99 €
ALTER TABLE public.creator_subscription_prices
  DROP CONSTRAINT IF EXISTS creator_subscription_prices_price_cents_check;
ALTER TABLE public.creator_subscription_prices
  DROP CONSTRAINT IF EXISTS creator_subscription_prices_min_price;
ALTER TABLE public.creator_subscription_prices
  ADD CONSTRAINT creator_subscription_prices_price_range
  CHECK (price_cents >= 299 AND price_cents <= 9999);

-- 2. Exclusive SlangDrops
CREATE TABLE IF NOT EXISTS public.slang_tag_drops (
  tag_id uuid PRIMARY KEY REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_claims integer CHECK (max_claims IS NULL OR max_claims > 0),
  claims_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slang_tag_drops TO authenticated;
GRANT ALL ON public.slang_tag_drops TO service_role;
ALTER TABLE public.slang_tag_drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drops_select_authenticated" ON public.slang_tag_drops
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "drops_insert_own" ON public.slang_tag_drops
  FOR INSERT TO authenticated WITH CHECK (creator_id = (select auth.uid()));
CREATE POLICY "drops_update_own" ON public.slang_tag_drops
  FOR UPDATE TO authenticated USING (creator_id = (select auth.uid()))
  WITH CHECK (creator_id = (select auth.uid()));
CREATE POLICY "drops_delete_own" ON public.slang_tag_drops
  FOR DELETE TO authenticated USING (creator_id = (select auth.uid()));

CREATE TRIGGER set_slang_tag_drops_updated_at
  BEFORE UPDATE ON public.slang_tag_drops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_slang_tag_drops_creator ON public.slang_tag_drops(creator_id);

-- 3. Bibliothek: dauerhaftes vs. vorlaeufiges Recht
ALTER TABLE public.slang_tag_library
  ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permanent_after timestamptz,
  ADD COLUMN IF NOT EXISTS lapsed_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

CREATE INDEX IF NOT EXISTS idx_slang_tag_library_pending
  ON public.slang_tag_library(user_id, creator_id) WHERE is_permanent = false;

-- 4. Rechte-Funktionen
CREATE OR REPLACE FUNCTION public.owns_slang_tag_permanently(_user_id uuid, _tag_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.slang_tag_library
    WHERE user_id = _user_id AND tag_id = _tag_id
      AND is_permanent = true AND revoked_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.has_pending_drop_entitlement(_user_id uuid, _tag_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.slang_tag_library l
    WHERE l.user_id = _user_id AND l.tag_id = _tag_id
      AND l.is_permanent = false AND l.revoked_at IS NULL AND l.lapsed_at IS NULL
      AND (
        public.has_active_creator_subscription(l.user_id, l.creator_id, 'sandbox')
        OR public.has_active_creator_subscription(l.user_id, l.creator_id, 'live')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_use_slang_tag(_tag_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_slang_tag_grant(_tag_id, _user_id)
      OR public.owns_slang_tag_permanently(_user_id, _tag_id)
      OR public.has_pending_drop_entitlement(_user_id, _tag_id)
$$;

-- 5. Reifung der 3-Monats-Regel
CREATE OR REPLACE FUNCTION public.promote_exclusive_drops(_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
$$;

-- 6. Abo endet -> nur noch nicht dauerhafte Drop-Rechte verfallen
CREATE OR REPLACE FUNCTION public.lapse_pending_drops_on_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_active_creator_subscription(NEW.subscriber_id, NEW.creator_id, NEW.environment) THEN
    UPDATE public.slang_tag_library
       SET lapsed_at = now()
     WHERE user_id = NEW.subscriber_id
       AND creator_id = NEW.creator_id
       AND is_permanent = false
       AND lapsed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lapse_pending_drops ON public.creator_subscriptions;
CREATE TRIGGER lapse_pending_drops
  AFTER INSERT OR UPDATE ON public.creator_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.lapse_pending_drops_on_subscription_change();

-- 7. Uebernahme inkl. Exclusive Drops
CREATE OR REPLACE FUNCTION public.claim_creator_slang_tag(_tag_id uuid, _environment text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  t public.slang_tags;
  d public.slang_tag_drops;
  allowed boolean := false;
  inserted integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _environment NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'invalid environment'; END IF;

  PERFORM public.promote_exclusive_drops(uid);

  IF public.owns_slang_tag_permanently(uid, _tag_id) THEN RETURN true; END IF;

  SELECT * INTO t FROM public.slang_tags WHERE id = _tag_id;
  IF NOT FOUND OR t.deleted_at IS NOT NULL THEN RETURN false; END IF;
  IF t.owner_id = uid OR t.creator_id = uid THEN RETURN false; END IF;
  IF t.moderation_status IS DISTINCT FROM 'approved' THEN RETURN false; END IF;

  SELECT * INTO d FROM public.slang_tag_drops WHERE tag_id = _tag_id;

  IF FOUND THEN
    IF NOT d.active THEN RAISE EXCEPTION 'drop_inactive'; END IF;
    IF d.starts_at IS NOT NULL AND now() < d.starts_at THEN RAISE EXCEPTION 'drop_not_started'; END IF;
    IF d.ends_at IS NOT NULL AND now() > d.ends_at THEN RAISE EXCEPTION 'drop_ended'; END IF;
    IF NOT public.has_active_creator_subscription(uid, t.owner_id, _environment) THEN
      RAISE EXCEPTION 'not_entitled';
    END IF;
    IF d.max_claims IS NOT NULL AND d.claims_count >= d.max_claims
       AND NOT EXISTS (SELECT 1 FROM public.slang_tag_library WHERE user_id = uid AND tag_id = _tag_id) THEN
      RAISE EXCEPTION 'drop_sold_out';
    END IF;

    INSERT INTO public.slang_tag_library (user_id, tag_id, creator_id, source, is_permanent, permanent_after)
    VALUES (uid, _tag_id, t.owner_id, 'exclusive_drop', false, now() + interval '3 months')
    ON CONFLICT (user_id, tag_id) DO NOTHING;
    GET DIAGNOSTICS inserted = ROW_COUNT;

    IF inserted > 0 THEN
      UPDATE public.slang_tag_drops SET claims_count = claims_count + 1 WHERE tag_id = _tag_id;
    ELSE
      UPDATE public.slang_tag_library
         SET lapsed_at = NULL, permanent_after = now() + interval '3 months'
       WHERE user_id = uid AND tag_id = _tag_id
         AND is_permanent = false AND revoked_at IS NULL AND lapsed_at IS NOT NULL;
    END IF;

    RETURN true;
  END IF;

  IF t.unlock_type = 'premium' THEN
    allowed := public.has_active_creator_subscription(uid, t.owner_id, _environment);
  ELSIF t.unlock_type = 'follow' OR t.follow_required THEN
    allowed := public.is_following(uid, t.owner_id);
  ELSE
    allowed := true;
  END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'not_entitled'; END IF;

  INSERT INTO public.slang_tag_library (user_id, tag_id, creator_id, source, is_permanent)
  VALUES (uid, _tag_id, t.owner_id,
          CASE WHEN t.unlock_type = 'premium' THEN 'creator_subscription' ELSE 'follow' END, true)
  ON CONFLICT (user_id, tag_id) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_exclusive_drops(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.lapse_pending_drops_on_subscription_change() FROM public, anon;
REVOKE ALL ON FUNCTION public.has_pending_drop_entitlement(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.promote_exclusive_drops(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_pending_drop_entitlement(uuid, uuid) TO authenticated, service_role;