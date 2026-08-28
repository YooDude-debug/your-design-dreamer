DROP VIEW IF EXISTS public.market_seller_profiles_public;

-- Oeffentliche Verkaeuferangaben fuer den Marktplatz.
-- Sicherheitsannahme: nur bewusst veroeffentlichte Felder; keine Kontakt-,
-- Zahlungs- oder Verwaltungsdaten. Nur fuer angemeldete Nutzer aufrufbar.
CREATE OR REPLACE FUNCTION public.market_public_seller_profile(_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  seller_type text,
  business_name text,
  logo_path text,
  description text,
  website text,
  verified_business boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.seller_type, p.business_name, p.logo_path,
         p.description, p.website, p.verified_business
  FROM public.market_seller_profiles p
  WHERE p.user_id = _user_id
    AND auth.uid() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.market_public_seller_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_public_seller_profile(uuid) TO authenticated, service_role;
