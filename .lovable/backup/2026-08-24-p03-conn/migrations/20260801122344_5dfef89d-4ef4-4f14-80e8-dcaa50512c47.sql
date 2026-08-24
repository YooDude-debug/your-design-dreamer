DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Allow recipients to mark messages as delivered/read without editing content
CREATE POLICY messages_update_read_state ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) AND auth.uid() <> sender_id)
  WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()) AND auth.uid() <> sender_id);

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

  -- Own folder
  IF (storage.foldername(_object_name))[1] = uid::text THEN
    RETURN true;
  END IF;

  -- Derived image variants (…__t.webp / …__m.webp) map back to their original
  IF _object_name ~ '__(t|m)\.webp$' THEN
    stem := regexp_replace(_object_name, '__(t|m)\.webp$', '');
  ELSE
    stem := regexp_replace(_object_name, '\.[^./]+$', '');
  END IF;
  pattern := stem || '.%';

  -- Chat attachment: only members of that conversation
  IF EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversation_members cm
      ON cm.conversation_id = m.conversation_id AND cm.user_id = uid
    WHERE m.media_url = _object_name
  ) THEN
    RETURN true;
  END IF;

  -- Public profile media
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.avatar_url LIKE pattern OR p.cover_url LIKE pattern
       OR p.avatar_url = _object_name OR p.cover_url = _object_name
  ) THEN
    RETURN true;
  END IF;

  -- SlangTag audio (SlangTags are readable per their own RLS)
  IF EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE t.audio_url = _object_name OR t.audio_url LIKE pattern
  ) THEN
    RETURN true;
  END IF;

  -- Post media: only when the viewer may see the post
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

REVOKE ALL ON FUNCTION public.can_read_media(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_media(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_media(text) TO authenticated;