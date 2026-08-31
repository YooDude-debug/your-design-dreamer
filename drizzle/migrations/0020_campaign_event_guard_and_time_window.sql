-- F1: Schutz gegen manipulierbare Kampagnen-Zähler ------------------------
CREATE TABLE IF NOT EXISTS public.ad_campaign_event_guard (
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  bucket timestamptz NOT NULL,
  PRIMARY KEY (campaign_id, user_id, kind, bucket)
);

GRANT ALL ON public.ad_campaign_event_guard TO service_role;
ALTER TABLE public.ad_campaign_event_guard ENABLE ROW LEVEL SECURITY;

-- Bewusst ohne Policies: ausschliesslich der Serverdienst (service_role)
-- schreibt hier. Weder anon noch authenticated erhalten Rechte.

DROP FUNCTION IF EXISTS public.increment_campaign_metric(uuid, text);

CREATE OR REPLACE FUNCTION public.increment_campaign_metric(
  _id uuid,
  _kind text,
  _actor uuid,
  _environment text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c record;
  _bucket timestamptz := date_trunc('hour', now());
  _fresh boolean;
BEGIN
  IF _kind NOT IN ('impression', 'click') THEN
    RAISE EXCEPTION 'invalid_event_kind' USING ERRCODE = '22023';
  END IF;
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT id, owner_id, status, environment, starts_at, ends_at
    INTO c FROM public.ad_campaigns WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = '42704';
  END IF;

  -- Nur tatsaechlich auslieferbare Kampagnen duerfen Ereignisse erhalten.
  IF c.status <> 'active' THEN RETURN false; END IF;
  IF _environment IS NOT NULL
     AND coalesce(c.environment, 'development') <> _environment THEN
    RETURN false;
  END IF;
  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN RETURN false; END IF;
  IF c.ends_at IS NOT NULL AND c.ends_at <= now() THEN RETURN false; END IF;
  -- Eigenmessung des Kampagnenbetreibers zaehlt nicht.
  IF c.owner_id IS NOT NULL AND c.owner_id = _actor THEN RETURN false; END IF;

  DELETE FROM public.ad_campaign_event_guard
   WHERE campaign_id = _id AND bucket < now() - interval '2 days';

  INSERT INTO public.ad_campaign_event_guard(campaign_id, user_id, kind, bucket)
  VALUES (_id, _actor, _kind, _bucket)
  ON CONFLICT DO NOTHING
  RETURNING true INTO _fresh;

  -- Wiederholte Ereignisse derselben Person im selben Zeitfenster zaehlen nicht.
  IF _fresh IS NOT TRUE THEN RETURN false; END IF;

  IF _kind = 'click' THEN
    UPDATE public.ad_campaigns SET clicks = clicks + 1, updated_at = now() WHERE id = _id;
  ELSE
    UPDATE public.ad_campaigns SET impressions = impressions + 1, updated_at = now() WHERE id = _id;
  END IF;
  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION public.increment_campaign_metric(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_campaign_metric(uuid, text, uuid, text) TO service_role;

-- F5: Zeitfenster-Plausibilitaet in der Datenbank --------------------------
ALTER TABLE public.ad_campaigns
  DROP CONSTRAINT IF EXISTS ad_campaigns_time_window_chk;
ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_time_window_chk
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);