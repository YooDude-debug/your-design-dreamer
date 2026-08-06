GRANT EXECUTE ON FUNCTION public.compute_connection_suggestions(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_stale_connection_suggestions(integer) TO service_role;