CREATE OR REPLACE FUNCTION public.age_status_of(_birthday date)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _birthday IS NULL THEN 'UNKNOWN'
    WHEN _birthday > (current_date - INTERVAL '14 years') THEN 'BLOCKED'
    WHEN _birthday > (current_date - INTERVAL '18 years') THEN 'MINOR_14_17'
    ELSE 'ADULT_18_PLUS'
  END
$$;

REVOKE ALL ON FUNCTION public.age_status_of(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.age_status_of(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.age_status_of(date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_age_status()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.age_status_of(p.birthday)
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.my_age_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_age_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_age_status() TO authenticated, service_role;

COMMENT ON FUNCTION public.my_age_status() IS 'Altersstatus des angemeldeten Kontos (BLOCKED/MINOR_14_17/ADULT_18_PLUS/UNKNOWN). Das Geburtsdatum selbst wird nicht zurueckgegeben.';