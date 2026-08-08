CREATE OR REPLACE FUNCTION public.enforce_slang_tag_kind()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN NEW.owner_id := NEW.creator_id; END IF;

  IF NEW.kind = 'creator' THEN
    IF NOT (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.owner_id AND p.verified)
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(NEW.owner_id, 'admin')
    ) THEN
      RAISE EXCEPTION 'Nur verifizierte Creator, Unternehmen oder Administratoren duerfen Creator-SlangTags erstellen';
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