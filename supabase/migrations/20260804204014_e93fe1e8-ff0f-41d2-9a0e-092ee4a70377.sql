-- SECURITY INVOKER, damit current_user die echte Aufrufer-Rolle ist
-- (in SECURITY DEFINER waere current_user immer der Funktionseigentuemer).
CREATE OR REPLACE FUNCTION public.guard_slang_tag_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  privileged boolean;
BEGIN
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

CREATE OR REPLACE FUNCTION public.guard_profile_internal_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
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