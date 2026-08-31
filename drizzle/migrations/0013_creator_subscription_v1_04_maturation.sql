CREATE OR REPLACE FUNCTION public.run_exclusive_drop_maturation()
RETURNS TABLE(lapsed integer, promoted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  l integer := 0;
  p integer := 0;
BEGIN
  UPDATE public.slang_tag_library l0
     SET lapsed_at = now()
   WHERE l0.is_permanent = false
     AND l0.revoked_at IS NULL
     AND l0.lapsed_at IS NULL
     AND l0.permanent_after IS NOT NULL
     AND l0.creator_id IS NOT NULL
     AND NOT (
       public.has_active_creator_subscription(l0.user_id, l0.creator_id, 'sandbox')
       OR public.has_active_creator_subscription(l0.user_id, l0.creator_id, 'live')
     );
  GET DIAGNOSTICS l = ROW_COUNT;

  UPDATE public.slang_tag_library l1
     SET is_permanent = true
   WHERE l1.is_permanent = false
     AND l1.revoked_at IS NULL
     AND l1.lapsed_at IS NULL
     AND l1.permanent_after IS NOT NULL
     AND l1.permanent_after <= now()
     AND (
       public.has_active_creator_subscription(l1.user_id, l1.creator_id, 'sandbox')
       OR public.has_active_creator_subscription(l1.user_id, l1.creator_id, 'live')
     );
  GET DIAGNOSTICS p = ROW_COUNT;

  RETURN QUERY SELECT l, p;
END;
$function$;

REVOKE ALL ON FUNCTION public.run_exclusive_drop_maturation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_exclusive_drop_maturation() FROM anon;
REVOKE ALL ON FUNCTION public.run_exclusive_drop_maturation() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_exclusive_drop_maturation() TO service_role;