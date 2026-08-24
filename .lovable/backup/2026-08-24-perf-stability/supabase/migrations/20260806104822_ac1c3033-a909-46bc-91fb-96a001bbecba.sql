REVOKE ALL ON FUNCTION public.queue_counter_event() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_message_read_state_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.sender_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
      OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
      OR NEW.kind IS DISTINCT FROM OLD.kind
      OR NEW.body IS DISTINCT FROM OLD.body
      OR NEW.media_url IS DISTINCT FROM OLD.media_url
      OR NEW.slang_tag_id IS DISTINCT FROM OLD.slang_tag_id
      OR NEW.slang_tag_ids IS DISTINCT FROM OLD.slang_tag_ids
      OR NEW.chat_slang_tag_id IS DISTINCT FROM OLD.chat_slang_tag_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Only read/delivery timestamps may be updated by message recipients';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_message_read_state_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_message_read_state_update ON public.messages;
CREATE TRIGGER guard_message_read_state_update
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.guard_message_read_state_update();