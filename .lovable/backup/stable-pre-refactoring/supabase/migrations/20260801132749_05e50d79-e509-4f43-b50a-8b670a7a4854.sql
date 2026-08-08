ALTER TABLE public.slang_tags
  ADD COLUMN IF NOT EXISTS sponsored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_type text,
  ADD COLUMN IF NOT EXISTS cta_url text,
  ADD COLUMN IF NOT EXISTS discount_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS voucher text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS opening_hours text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS clicks_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reach_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.enforce_slang_tag_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN NEW.owner_id := NEW.creator_id; END IF;

  IF NEW.kind = 'creator' THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.owner_id AND p.verified) THEN
      RAISE EXCEPTION 'Nur verifizierte Creator oder Unternehmen duerfen Creator-SlangTags erstellen';
    END IF;
    NEW.owner_type := CASE WHEN NEW.owner_type = 'user' THEN 'creator'::public.slang_tag_owner_type ELSE NEW.owner_type END;
    NEW.verification_status := 'verified';
    NEW.unlock_type := CASE WHEN NEW.unlock_type = 'open' THEN 'follow'::public.slang_tag_unlock_type ELSE NEW.unlock_type END;
    NEW.follow_required := true;
  ELSE
    NEW.owner_type := 'user';
    NEW.unlock_type := 'open';
    NEW.follow_required := false;
  END IF;

  -- Nur Unternehmens-SlangTags duerfen gesponsert sein
  IF NEW.owner_type <> 'company' THEN
    NEW.sponsored := false;
    NEW.cta_type := NULL;
    NEW.cta_url := NULL;
    NEW.discount_code := '';
    NEW.voucher := '';
    NEW.opening_hours := '';
    NEW.phone := '';
    NEW.company_url := '';
  END IF;

  IF NEW.cta_type IS NOT NULL AND NEW.cta_type NOT IN ('website','offer','booking','info','route') THEN
    RAISE EXCEPTION 'Ungueltiger Call-to-Action-Typ: %', NEW.cta_type;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS enforce_slang_tag_kind_trg ON public.slang_tags;
CREATE TRIGGER enforce_slang_tag_kind_trg
BEFORE INSERT OR UPDATE ON public.slang_tags
FOR EACH ROW EXECUTE FUNCTION public.enforce_slang_tag_kind();

CREATE OR REPLACE FUNCTION public.is_community_tag(_tag_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE t.id = _tag_id AND t.kind = 'community'
  )
$function$;

REVOKE ALL ON FUNCTION public.is_community_tag(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_community_tag(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "slang_tag_votes_insert" ON public.slang_tag_votes;
CREATE POLICY "slang_tag_votes_insert" ON public.slang_tag_votes
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_community_tag(tag_id)
  AND NOT public.owns_slang_tag(tag_id)
);

DROP POLICY IF EXISTS "slang_tag_votes_update" ON public.slang_tag_votes;
CREATE POLICY "slang_tag_votes_update" ON public.slang_tag_votes
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND public.is_community_tag(tag_id)
  AND NOT public.owns_slang_tag(tag_id)
);