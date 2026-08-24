-- 1) Standort in Profilen nicht mehr breit lesbar: Spaltenrechte statt Tabellenrecht
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, username, display_name, bio, language, avatar_url, cover_url,
  verified, level, xp, created_at, updated_at, last_seen_at, is_test_bot
) ON public.profiles TO authenticated;

-- Standort nur fuer eigenes Profil, Connections, gefolgte Profile und Admins
CREATE OR REPLACE FUNCTION public.profile_locations(_ids uuid[])
RETURNS TABLE(user_id uuid, location text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.location
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY(_ids)
    AND (
      p.id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.are_connected(auth.uid(), p.id)
      OR public.is_following(auth.uid(), p.id)
    )
$$;

REVOKE ALL ON FUNCTION public.profile_locations(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_locations(uuid[]) TO authenticated;

-- 2) Gutscheine/Rabattcodes/Telefon erst nach Freischaltung des SlangTags
CREATE OR REPLACE FUNCTION public.slang_tag_business_info(_tag_ids uuid[])
RETURNS TABLE(tag_id uuid, discount_code text, voucher text, phone text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.discount_code, t.voucher, t.phone
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
