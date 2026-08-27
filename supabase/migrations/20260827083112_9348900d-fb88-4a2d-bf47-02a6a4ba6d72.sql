CREATE OR REPLACE FUNCTION public.ops_rpc_probe()
RETURNS TABLE(server_now timestamptz, reachable boolean, probe_rows integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT now(), true, (SELECT COUNT(*)::int FROM (SELECT 1 FROM public.profiles LIMIT 1) s);
END;
$function$;

REVOKE ALL ON FUNCTION public.ops_rpc_probe() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_rpc_probe() FROM anon;
REVOKE ALL ON FUNCTION public.ops_rpc_probe() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ops_rpc_probe() TO service_role;

COMMENT ON FUNCTION public.ops_rpc_probe() IS 'Technischer RPC-Health-Check der Systemueberwachung. Bewusst ohne Auth-Kontext (Service-Role only), da der Probe die RPC-Infrastruktur prueft und keinen Nutzer-Request simuliert.';