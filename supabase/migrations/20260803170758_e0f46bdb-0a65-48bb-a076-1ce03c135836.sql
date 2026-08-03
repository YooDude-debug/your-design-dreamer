CREATE OR REPLACE FUNCTION public.can_use_extended_audio(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'creator')
      OR public.has_role(_user_id, 'business')
      OR COALESCE((SELECT p.verified FROM public.profiles p WHERE p.id = _user_id), false)
$$;

REVOKE ALL ON FUNCTION public.can_use_extended_audio(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_use_extended_audio(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_slang_tag_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  secs integer;
  max_secs integer;
BEGIN
  -- Community-SlangTags sind immer auf 5 Sekunden begrenzt. Nur Creator-/
  -- Unternehmer-SlangTags berechtigter Konten duerfen bis 10 Sekunden lang sein.
  IF NEW.kind = 'creator'
     AND (public.can_use_extended_audio(COALESCE(NEW.owner_id, NEW.creator_id))
          OR public.has_role(auth.uid(), 'admin')) THEN
    max_secs := 10;
  ELSE
    max_secs := 5;
  END IF;

  BEGIN
    secs := split_part(NEW.duration, ':', 2)::integer
            + COALESCE(NULLIF(split_part(NEW.duration, ':', 1), '')::integer, 0) * 60;
  EXCEPTION WHEN others THEN
    secs := NULL;
  END;

  IF secs IS NOT NULL AND secs > max_secs THEN
    RAISE EXCEPTION 'SlangTag duration % exceeds limit of % seconds for this tag type', NEW.duration, max_secs;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_slang_tag_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN NEW.owner_id := NEW.creator_id; END IF;

  IF NEW.kind = 'creator' THEN
    -- Creator-/Unternehmer-SlangTags duerfen Administratoren sowie Konten mit
    -- Creator- oder Unternehmer-Rolle anlegen.
    IF TG_OP = 'INSERT' OR OLD.kind IS DISTINCT FROM 'creator' THEN
      IF NOT (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'creator')
        OR public.has_role(auth.uid(), 'business')
        OR public.has_role(NEW.owner_id, 'admin')
        OR public.has_role(NEW.owner_id, 'creator')
        OR public.has_role(NEW.owner_id, 'business')
      ) THEN
        RAISE EXCEPTION 'Creator-/Unternehmer-SlangTags koennen nur von berechtigten Konten erstellt werden';
      END IF;
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
END;
$$;