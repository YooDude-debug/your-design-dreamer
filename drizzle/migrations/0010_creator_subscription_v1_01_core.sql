-- =====================================================================
-- Creator-Abo + dauerhafte SlangTag-Bibliothek
-- =====================================================================

CREATE TABLE public.creator_subscription_prices (
  creator_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  price_cents integer NOT NULL CHECK (price_cents >= 499),
  currency text NOT NULL DEFAULT 'eur',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.creator_subscription_prices TO authenticated;
GRANT ALL ON public.creator_subscription_prices TO service_role;
ALTER TABLE public.creator_subscription_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_prices_select_authenticated"
  ON public.creator_subscription_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "creator_prices_insert_own"
  ON public.creator_subscription_prices FOR INSERT TO authenticated
  WITH CHECK (creator_id = (select auth.uid()));
CREATE POLICY "creator_prices_update_own"
  ON public.creator_subscription_prices FOR UPDATE TO authenticated
  USING (creator_id = (select auth.uid()))
  WITH CHECK (creator_id = (select auth.uid()));

CREATE TRIGGER creator_prices_updated_at
  BEFORE UPDATE ON public.creator_subscription_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.creator_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'incomplete',
  price_cents integer,
  currency text NOT NULL DEFAULT 'eur',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  stripe_subscription_id text,
  stripe_customer_id text,
  environment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_subscriptions_env_check CHECK (environment IN ('sandbox','live')),
  CONSTRAINT creator_subscriptions_unique UNIQUE (subscriber_id, creator_id, environment),
  CONSTRAINT creator_subscriptions_no_self CHECK (subscriber_id <> creator_id)
);

CREATE UNIQUE INDEX creator_subscriptions_stripe_id_idx
  ON public.creator_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX creator_subscriptions_creator_idx ON public.creator_subscriptions (creator_id);

GRANT SELECT ON public.creator_subscriptions TO authenticated;
GRANT ALL ON public.creator_subscriptions TO service_role;
ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_subs_select_involved"
  ON public.creator_subscriptions FOR SELECT TO authenticated
  USING (subscriber_id = (select auth.uid()) OR creator_id = (select auth.uid()));

CREATE TRIGGER creator_subscriptions_updated_at
  BEFORE UPDATE ON public.creator_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.slang_tag_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'creator_subscription',
  acquired_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slang_tag_library_unique UNIQUE (user_id, tag_id)
);

CREATE INDEX slang_tag_library_tag_idx ON public.slang_tag_library (tag_id);

GRANT SELECT ON public.slang_tag_library TO authenticated;
GRANT ALL ON public.slang_tag_library TO service_role;
ALTER TABLE public.slang_tag_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slang_tag_library_select_own"
  ON public.slang_tag_library FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.has_active_creator_subscription(
  _subscriber uuid, _creator uuid, _environment text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.creator_subscriptions
    WHERE subscriber_id = _subscriber
      AND creator_id = _creator
      AND environment = _environment
      AND (
        (status IN ('active','trialing','past_due')
          AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.owns_slang_tag_permanently(_user_id uuid, _tag_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.slang_tag_library
    WHERE user_id = _user_id AND tag_id = _tag_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_use_slang_tag(_tag_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_slang_tag_grant(_tag_id, _user_id)
      OR public.owns_slang_tag_permanently(_user_id, _tag_id)
$$;

CREATE OR REPLACE FUNCTION public.claim_creator_slang_tag(_tag_id uuid, _environment text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.slang_tags;
  allowed boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _environment NOT IN ('sandbox','live') THEN
    RAISE EXCEPTION 'invalid environment';
  END IF;

  IF public.owns_slang_tag_permanently(uid, _tag_id) THEN
    RETURN true;
  END IF;

  SELECT * INTO t FROM public.slang_tags WHERE id = _tag_id;
  IF NOT FOUND OR t.deleted_at IS NOT NULL THEN
    RETURN false;
  END IF;
  IF t.owner_id = uid OR t.creator_id = uid THEN
    RETURN false;
  END IF;
  IF t.moderation_status IS DISTINCT FROM 'approved' THEN
    RETURN false;
  END IF;

  IF t.unlock_type = 'premium' THEN
    allowed := public.has_active_creator_subscription(uid, t.owner_id, _environment);
  ELSIF t.unlock_type = 'follow' OR t.follow_required THEN
    allowed := public.is_following(uid, t.owner_id);
  ELSE
    allowed := true;
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'not_entitled';
  END IF;

  INSERT INTO public.slang_tag_library (user_id, tag_id, creator_id, source)
  VALUES (uid, _tag_id, t.owner_id,
          CASE WHEN t.unlock_type = 'premium' THEN 'creator_subscription' ELSE 'follow' END)
  ON CONFLICT (user_id, tag_id) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_creator_slang_tag(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_creator_slang_tag(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_owned_slang_tag_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.slang_tag_library WHERE tag_id = OLD.id) THEN
    UPDATE public.slang_tags
       SET deleted_at = COALESCE(deleted_at, now())
     WHERE id = OLD.id;
    RETURN NULL;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER slang_tags_protect_owned_delete
  BEFORE DELETE ON public.slang_tags
  FOR EACH ROW EXECUTE FUNCTION public.protect_owned_slang_tag_delete();