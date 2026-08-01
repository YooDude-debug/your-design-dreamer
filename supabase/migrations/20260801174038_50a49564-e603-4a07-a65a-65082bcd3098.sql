-- 1) slang_tags: sensible Geschäftskontaktdaten nicht mehr breit lesbar
REVOKE SELECT ON public.slang_tags FROM authenticated;
REVOKE SELECT ON public.slang_tags FROM anon;
GRANT SELECT (
  id,name,audio_url,duration,creator_id,region,language,meaning,examples,
  plays_count,likes_count,uses_count,shares_count,saves_count,comments_count,
  created_at,updated_at,kind,owner_id,owner_type,company,verification_status,
  unlock_type,follow_required,released_at,drop_release_date,drop_limit,
  drop_expires,drop_rarity,deleted_at,sponsored,logo_url,description,
  cta_type,cta_url,location,opening_hours,company_url,
  clicks_count,conversion_count,reach_count
) ON public.slang_tags TO authenticated;

CREATE OR REPLACE FUNCTION public.slang_tag_business_info(_tag_ids uuid[])
RETURNS TABLE(tag_id uuid, discount_code text, voucher text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.discount_code, t.voucher, t.phone
  FROM public.slang_tags t
  WHERE auth.uid() IS NOT NULL
    AND t.id = ANY(_tag_ids)
    AND t.deleted_at IS NULL
    AND (
      (t.owner_type = 'company' AND t.sponsored)
      OR t.owner_id = auth.uid()
      OR t.creator_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    )
$$;

REVOKE ALL ON FUNCTION public.slang_tag_business_info(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.slang_tag_business_info(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.slang_tag_business_info(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.slang_tag_business_info(uuid[]) TO service_role;

-- 2) test_bot_settings: nur Admins duerfen die Konfiguration lesen
DROP POLICY IF EXISTS test_bot_settings_select_authenticated ON public.test_bot_settings;
CREATE POLICY test_bot_settings_select_admin
  ON public.test_bot_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.test_bots_visible()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT s.enabled FROM public.test_bot_settings s WHERE s.id = true), false)
$$;

REVOKE ALL ON FUNCTION public.test_bots_visible() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_bots_visible() FROM anon;
GRANT EXECUTE ON FUNCTION public.test_bots_visible() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_bots_visible() TO service_role;

-- 3) content_categories: Kategorien nur fuer eigene Inhalte
CREATE OR REPLACE FUNCTION public.enforce_content_category_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM uid AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Kategorien koennen nur fuer eigene Inhalte gesetzt werden';
  END IF;

  IF public.has_role(uid, 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.content_type = 'post' THEN
    IF NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = NEW.content_id AND p.user_id = uid) THEN
      RAISE EXCEPTION 'Beitrag gehoert nicht zum angemeldeten Nutzer';
    END IF;
  ELSIF NEW.content_type = 'slang_tag' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.slang_tags t
      WHERE t.id = NEW.content_id AND (t.owner_id = uid OR t.creator_id = uid)
    ) THEN
      RAISE EXCEPTION 'SlangTag gehoert nicht zum angemeldeten Nutzer';
    END IF;
  ELSIF NEW.content_type = 'profile' THEN
    IF NEW.content_id IS DISTINCT FROM uid THEN
      RAISE EXCEPTION 'Profil gehoert nicht zum angemeldeten Nutzer';
    END IF;
  ELSE
    RAISE EXCEPTION 'Kategorien fuer diesen Inhaltstyp sind nicht erlaubt';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_categories_ownership ON public.content_categories;
CREATE TRIGGER content_categories_ownership
  BEFORE INSERT OR UPDATE ON public.content_categories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_category_ownership();