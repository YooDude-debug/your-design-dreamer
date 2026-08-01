CREATE OR REPLACE FUNCTION public.guard_message_content_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.sender_id THEN
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.media_url IS DISTINCT FROM OLD.media_url
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.slang_tag_id IS DISTINCT FROM OLD.slang_tag_id
       OR NEW.slang_tag_ids IS DISTINCT FROM OLD.slang_tag_ids
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
      RAISE EXCEPTION 'Only the sender may edit message content';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_guard_content_edits ON public.messages;
CREATE TRIGGER messages_guard_content_edits
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_content_edits();