CREATE OR REPLACE FUNCTION public.flag_test_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_email text;
BEGIN
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = NEW.id;
  IF v_email IS NOT NULL AND (
       v_email LIKE '%@y-dude.test'
    OR v_email LIKE '%@testaccount.y-dude.com'
    OR v_email LIKE '%@example.com'
    OR v_email LIKE '%@ydude-qacheck.dev'
  ) THEN
    NEW.is_test_user := true;
  END IF;
  RETURN NEW;
END;
$function$;