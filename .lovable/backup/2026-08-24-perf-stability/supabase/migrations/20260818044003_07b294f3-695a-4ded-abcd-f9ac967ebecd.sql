-- Aktivitäts-Zeitstempel des eingeloggten Nutzers aktualisieren (Heartbeat).
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.profiles
     SET last_seen_at = v_now
   WHERE id = auth.uid()
     AND (last_seen_at IS NULL OR last_seen_at < v_now - interval '30 seconds');
  RETURN v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated, service_role;