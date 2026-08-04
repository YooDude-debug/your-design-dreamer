-- 1) SlangTags: Spaltengenaue Update-Rechte statt tabellenweitem UPDATE
REVOKE UPDATE ON public.slang_tags FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.slang_tags FROM anon;

GRANT UPDATE (
  name, meaning, examples, region, language, description,
  audio_url, duration, logo_url, company,
  cta_type, cta_url, discount_code, voucher,
  location, opening_hours, phone, company_url
) ON public.slang_tags TO authenticated;

GRANT ALL ON public.slang_tags TO service_role;

-- 2) Profile: interne Felder (verified, level, xp, is_test_bot) sperren
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;

GRANT UPDATE (
  username, display_name, bio, location, location_visibility,
  language, avatar_url, cover_url
) ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;

-- 3) Kein Schreibzugriff fuer nicht angemeldete Besucher auf Inhaltstabellen
REVOKE INSERT, UPDATE, DELETE ON public.comments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.posts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.messages FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ad_campaigns FROM anon;

-- 4) Moderations-Trigger: nur Moderationssystem (service_role/postgres) und Admins
CREATE OR REPLACE FUNCTION public.guard_slang_tag_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  privileged boolean;
BEGIN
  -- Nur das serverseitige Moderationssystem (service_role/postgres) und
  -- Administratoren duerfen Moderationsergebnisse setzen.
  privileged := current_user IN ('postgres', 'service_role', 'supabase_admin')
                OR public.has_role(auth.uid(), 'admin');

  IF TG_OP = 'INSERT' THEN
    IF NOT privileged THEN
      NEW.moderation_status := 'pending';
      NEW.moderation_reason := '';
      NEW.moderation_labels := '{}';
      NEW.moderation_is_music := false;
      NEW.moderation_confidence := 0;
      NEW.moderation_ai := '{}'::jsonb;
      NEW.transcript := '';
      NEW.moderated_at := NULL;
      NEW.moderated_by := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT privileged THEN
    NEW.moderation_status := OLD.moderation_status;
    NEW.moderation_reason := OLD.moderation_reason;
    NEW.moderation_labels := OLD.moderation_labels;
    NEW.moderation_is_music := OLD.moderation_is_music;
    NEW.moderation_confidence := OLD.moderation_confidence;
    NEW.moderation_ai := OLD.moderation_ai;
    NEW.transcript := OLD.transcript;
    NEW.moderated_at := OLD.moderated_at;
    NEW.moderated_by := OLD.moderated_by;
    NEW.verification_status := OLD.verification_status;
    NEW.deleted_at := OLD.deleted_at;
    NEW.sponsored := OLD.sponsored;

    -- Neue Audiodatei => erneute Pruefung erforderlich.
    IF NEW.audio_url IS DISTINCT FROM OLD.audio_url THEN
      NEW.moderation_status := 'pending';
      NEW.moderation_reason := '';
      NEW.moderation_labels := '{}';
      NEW.moderation_ai := '{}'::jsonb;
      NEW.transcript := '';
      NEW.moderated_at := NULL;
      NEW.moderated_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 5) Profile: interne Felder zusaetzlich per Trigger absichern
CREATE OR REPLACE FUNCTION public.guard_profile_internal_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.verified := OLD.verified;
  NEW.level := OLD.level;
  NEW.xp := OLD.xp;
  NEW.is_test_bot := OLD.is_test_bot;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_guard_internal_fields ON public.profiles;
CREATE TRIGGER profiles_guard_internal_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_internal_fields();