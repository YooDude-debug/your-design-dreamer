-- 1) Sensible Unternehmensfelder nicht mehr direkt lesbar
REVOKE SELECT (location, opening_hours, company_url) ON public.slang_tags FROM authenticated;
REVOKE SELECT (location, opening_hours, company_url, phone, discount_code, voucher) ON public.slang_tags FROM anon;

-- 2) Kontrollierter Zugriff ueber Security-Definer-Funktion
DROP FUNCTION IF EXISTS public.slang_tag_business_info(uuid[]);
CREATE OR REPLACE FUNCTION public.slang_tag_business_info(_tag_ids uuid[])
RETURNS TABLE(tag_id uuid, discount_code text, voucher text, phone text, location text, opening_hours text, company_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.discount_code, t.voucher, t.phone, t.location, t.opening_hours, t.company_url
  FROM public.slang_tags t
  WHERE auth.uid() IS NOT NULL
    AND t.id = ANY(_tag_ids)
    AND t.deleted_at IS NULL
    AND (
      t.owner_id = auth.uid()
      OR t.creator_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR (
        t.owner_type = 'company'
        AND t.sponsored
        AND public.can_use_slang_tag(t.id, auth.uid())
      )
    )
$$;

REVOKE ALL ON FUNCTION public.slang_tag_business_info(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.slang_tag_business_info(uuid[]) TO authenticated;

-- 3) Trigger-Hilfsfunktion nicht oeffentlich aufrufbar
REVOKE ALL ON FUNCTION public.apply_share_request_decision() FROM PUBLIC, anon, authenticated;