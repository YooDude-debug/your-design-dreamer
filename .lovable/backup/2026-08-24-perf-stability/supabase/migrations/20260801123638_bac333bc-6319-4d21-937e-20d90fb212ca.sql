CREATE TABLE public.chat_slang_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  audio_url text,
  duration text NOT NULL DEFAULT '0:01',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.chat_slang_tags TO authenticated;
GRANT ALL ON public.chat_slang_tags TO service_role;

ALTER TABLE public.chat_slang_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_slang_tags_select_members" ON public.chat_slang_tags
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "chat_slang_tags_insert_own" ON public.chat_slang_tags
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid()));

CREATE INDEX chat_slang_tags_conversation_idx ON public.chat_slang_tags (conversation_id);

ALTER TABLE public.messages
  ADD COLUMN chat_slang_tag_id uuid REFERENCES public.chat_slang_tags(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.guard_message_content_edits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.sender_id THEN
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.media_url IS DISTINCT FROM OLD.media_url
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.slang_tag_id IS DISTINCT FROM OLD.slang_tag_id
       OR NEW.slang_tag_ids IS DISTINCT FROM OLD.slang_tag_ids
       OR NEW.chat_slang_tag_id IS DISTINCT FROM OLD.chat_slang_tag_id
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
      RAISE EXCEPTION 'Only the sender may edit message content';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_read_media(_object_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  stem text;
  pattern text;
BEGIN
  IF uid IS NULL OR _object_name IS NULL THEN
    RETURN false;
  END IF;

  IF (storage.foldername(_object_name))[1] = uid::text THEN
    RETURN true;
  END IF;

  IF _object_name ~ '__(t|m)\.webp$' THEN
    stem := regexp_replace(_object_name, '__(t|m)\.webp$', '');
  ELSE
    stem := regexp_replace(_object_name, '\.[^./]+$', '');
  END IF;
  pattern := stem || '.%';

  IF EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversation_members cm
      ON cm.conversation_id = m.conversation_id AND cm.user_id = uid
    WHERE m.media_url = _object_name
  ) THEN
    RETURN true;
  END IF;

  -- Private Chat-SlangTags: nur Mitglieder der jeweiligen Unterhaltung
  IF EXISTS (
    SELECT 1 FROM public.chat_slang_tags ct
    JOIN public.conversation_members cm
      ON cm.conversation_id = ct.conversation_id AND cm.user_id = uid
    WHERE ct.audio_url = _object_name OR ct.audio_url LIKE pattern
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.avatar_url LIKE pattern OR p.cover_url LIKE pattern
       OR p.avatar_url = _object_name OR p.cover_url = _object_name
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE t.audio_url = _object_name OR t.audio_url LIKE pattern
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.posts p
    WHERE (p.image_url = _object_name OR p.audio_url = _object_name
           OR p.image_url LIKE pattern OR p.audio_url LIKE pattern)
      AND p.hidden_at IS NULL
      AND (
        p.user_id = uid
        OR p.visibility = 'public'
        OR (p.visibility = 'connections' AND public.are_connected(uid, p.user_id))
        OR (p.visibility = 'following' AND public.is_following(uid, p.user_id))
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.can_read_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_media(text) TO authenticated, service_role;