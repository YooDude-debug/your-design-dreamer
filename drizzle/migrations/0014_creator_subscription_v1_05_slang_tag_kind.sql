CREATE OR REPLACE FUNCTION public.enforce_slang_tag_kind()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN NEW.owner_id := NEW.creator_id; END IF;

  IF NEW.kind = 'creator' THEN
    -- Exklusive $$-SlangTags: ausschliesslich Creator- oder Unternehmer-Status.
    -- Admin-Rechte oder ein Verifizierungs-Haekchen genuegen ausdruecklich NICHT.
    IF NOT (
      public.has_role(NEW.owner_id, 'creator')
      OR public.has_role(NEW.owner_id, 'business')
    ) THEN
      RAISE EXCEPTION 'Nur Creator- oder Unternehmer-Konten duerfen $$-SlangTags erstellen';
    END IF;
    NEW.owner_type := CASE WHEN NEW.owner_type = 'user' THEN 'creator'::public.slang_tag_owner_type ELSE NEW.owner_type END;
    NEW.verification_status := 'verified';
    -- Zugriffsstufe wird vom Creator gesetzt: 'open' (kostenlos), 'follow'
    -- (Follower) oder 'premium' (Creator-Abo). Konsistenzregel: follow_required
    -- gilt genau dann, wenn die Stufe 'follow' gewaehlt wurde.
    NEW.follow_required := (NEW.unlock_type = 'follow');
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
  END IF;

  RETURN NEW;
END;
$function$;