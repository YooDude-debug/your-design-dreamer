-- 1) Protokoll der automatischen Inhaltsprüfung (Bild, Text, Audio)
CREATE TABLE IF NOT EXISTS public.content_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  content_type text NOT NULL,
  content_id uuid,
  decision text NOT NULL,
  labels text[] NOT NULL DEFAULT '{}',
  flags text[] NOT NULL DEFAULT '{}',
  confidence numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  crisis boolean NOT NULL DEFAULT false,
  ai jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_moderation_log TO authenticated;
GRANT ALL ON public.content_moderation_log TO service_role;

ALTER TABLE public.content_moderation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_moderation_log_admin_select ON public.content_moderation_log;
CREATE POLICY content_moderation_log_admin_select
  ON public.content_moderation_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS content_moderation_log_created_idx
  ON public.content_moderation_log (created_at DESC);

-- 2) Beiträge nur noch über den geprüften Serverweg anlegen
REVOKE INSERT ON public.posts FROM authenticated;

-- 3) Moderationsfelder von SlangTags gegen Manipulation aus dem Browser schützen
CREATE OR REPLACE FUNCTION public.guard_slang_tag_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  privileged boolean;
BEGIN
  -- Serverseitige Aufrufe (Service-Rolle, kein Nutzerkontext) und Administratoren
  -- dürfen Moderationsergebnisse setzen. Alle anderen nicht.
  privileged := auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin');

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
    -- Bestehende Prüfergebnisse bleiben unverändert.
    NEW.moderation_status := OLD.moderation_status;
    NEW.moderation_reason := OLD.moderation_reason;
    NEW.moderation_labels := OLD.moderation_labels;
    NEW.moderation_is_music := OLD.moderation_is_music;
    NEW.moderation_confidence := OLD.moderation_confidence;
    NEW.moderation_ai := OLD.moderation_ai;
    NEW.transcript := OLD.transcript;
    NEW.moderated_at := OLD.moderated_at;
    NEW.moderated_by := OLD.moderated_by;

    -- Neue Audiodatei => erneute Prüfung erforderlich.
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
$$;

DROP TRIGGER IF EXISTS guard_slang_tag_moderation_trg ON public.slang_tags;
CREATE TRIGGER guard_slang_tag_moderation_trg
  BEFORE INSERT OR UPDATE ON public.slang_tags
  FOR EACH ROW EXECUTE FUNCTION public.guard_slang_tag_moderation();