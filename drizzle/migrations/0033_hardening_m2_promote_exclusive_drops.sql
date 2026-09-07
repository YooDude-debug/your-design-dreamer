CREATE OR REPLACE FUNCTION public.promote_exclusive_drops(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  -- Least privilege: angemeldete Aufrufer duerfen die Reifung ausschliesslich
  -- fuer das eigene Konto ausloesen. Serverseitige Laeufe (auth.uid() IS NULL,
  -- z. B. run_exclusive_drop_maturation) bleiben unveraendert moeglich.
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

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

REVOKE ALL ON FUNCTION public.promote_exclusive_drops(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_exclusive_drops(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.promote_exclusive_drops(uuid) TO authenticated, service_role;