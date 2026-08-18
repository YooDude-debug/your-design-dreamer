-- 1) Dedup store for SlangTag reach/click tracking (minimal data, no PII beyond user reference)
CREATE TABLE IF NOT EXISTS public.slang_tag_track_dedup (
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reach','click','conversion')),
  window_start timestamptz NOT NULL,
  PRIMARY KEY (tag_id, user_id, kind, window_start)
);

GRANT ALL ON public.slang_tag_track_dedup TO service_role;
ALTER TABLE public.slang_tag_track_dedup ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: only SECURITY DEFINER tracking functions touch this table.

CREATE INDEX IF NOT EXISTS slang_tag_track_dedup_window_idx
  ON public.slang_tag_track_dedup (window_start);

CREATE OR REPLACE FUNCTION public.track_slang_tag_reach(_tag_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  bucket timestamptz := date_trunc('hour', now()) + (floor(date_part('minute', now()) / 30) * interval '30 minutes');
  fresh boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.slang_tag_track_dedup (tag_id, user_id, kind, window_start)
  VALUES (_tag_id, uid, 'reach', bucket)
  ON CONFLICT DO NOTHING;
  fresh := FOUND;

  IF NOT fresh THEN
    RETURN;
  END IF;

  UPDATE public.slang_tags
     SET reach_count = reach_count + 1
   WHERE id = _tag_id AND owner_type = 'company';

  DELETE FROM public.slang_tag_track_dedup WHERE window_start < now() - interval '30 days';
END $function$;

CREATE OR REPLACE FUNCTION public.track_slang_tag_click(_tag_id uuid, _conversion boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  bucket timestamptz := date_trunc('hour', now());
  new_click boolean := false;
  new_conv boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.slang_tag_track_dedup (tag_id, user_id, kind, window_start)
  VALUES (_tag_id, uid, 'click', bucket)
  ON CONFLICT DO NOTHING;
  new_click := FOUND;

  IF _conversion THEN
    INSERT INTO public.slang_tag_track_dedup (tag_id, user_id, kind, window_start)
    VALUES (_tag_id, uid, 'conversion', date_trunc('day', now()))
    ON CONFLICT DO NOTHING;
    new_conv := FOUND;
  END IF;

  IF NOT new_click AND NOT new_conv THEN
    RETURN;
  END IF;

  UPDATE public.slang_tags
     SET clicks_count = clicks_count + CASE WHEN new_click THEN 1 ELSE 0 END,
         conversion_count = conversion_count + CASE WHEN new_conv THEN 1 ELSE 0 END
   WHERE id = _tag_id AND owner_type = 'company';
END $function$;

-- 2) Freeze slang_tags ownership / authorship
CREATE OR REPLACE FUNCTION public.guard_slang_tag_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  NEW.owner_id := OLD.owner_id;
  NEW.creator_id := OLD.creator_id;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS guard_slang_tag_identity ON public.slang_tags;
CREATE TRIGGER guard_slang_tag_identity
  BEFORE UPDATE ON public.slang_tags
  FOR EACH ROW EXECUTE FUNCTION public.guard_slang_tag_identity();

-- 3) Server-side ad pause activation
REVOKE INSERT ON public.ad_pauses FROM authenticated;
DROP POLICY IF EXISTS "Users can create their own ad pauses" ON public.ad_pauses;

CREATE OR REPLACE FUNCTION public.activate_ad_pause(_timezone text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  tz text;
  local_now timestamp;
  l_date date;
  m_key text;
  ends timestamptz;
  used int;
  quota int := 3;
  existing public.ad_pauses;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Client may only propose a timezone name; anything unknown falls back to UTC.
  tz := 'UTC';
  IF _timezone IS NOT NULL AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = _timezone) THEN
    tz := _timezone;
  END IF;

  local_now := now() AT TIME ZONE tz;
  l_date := local_now::date;
  m_key := to_char(l_date, 'YYYY-MM');
  -- Pause always ends at the next local midnight, capped at 24h.
  ends := ((l_date + 1)::timestamp) AT TIME ZONE tz;

  SELECT * INTO existing FROM public.ad_pauses
   WHERE user_id = uid AND local_date = l_date
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'already_active', true, 'id', existing.id,
      'ends_at', existing.ends_at, 'local_date', existing.local_date,
      'month_key', existing.month_key,
      'used', (SELECT count(*) FROM public.ad_pauses WHERE user_id = uid AND month_key = m_key),
      'quota', quota
    );
  END IF;

  SELECT count(*) INTO used FROM public.ad_pauses
   WHERE user_id = uid AND month_key = m_key;

  IF used >= quota THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quota_exhausted', 'used', used, 'quota', quota);
  END IF;

  INSERT INTO public.ad_pauses (user_id, local_date, month_key, timezone, ends_at)
  VALUES (uid, l_date, m_key, tz, ends)
  RETURNING * INTO existing;

  RETURN jsonb_build_object(
    'ok', true, 'already_active', false, 'id', existing.id,
    'ends_at', existing.ends_at, 'local_date', existing.local_date,
    'month_key', existing.month_key, 'used', used + 1, 'quota', quota
  );
END $function$;

REVOKE ALL ON FUNCTION public.activate_ad_pause(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_ad_pause(text) TO authenticated;