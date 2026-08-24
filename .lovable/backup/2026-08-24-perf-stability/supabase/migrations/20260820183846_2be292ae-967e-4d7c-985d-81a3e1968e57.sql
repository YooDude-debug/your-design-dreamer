-- Harden message updates: non-senders may only touch read/delivery timestamps.
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (read_at, delivered_at) ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

DROP POLICY IF EXISTS messages_update_read_state ON public.messages;
CREATE POLICY messages_update_read_state ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) AND auth.uid() <> sender_id)
  WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()) AND auth.uid() <> sender_id);

COMMENT ON POLICY messages_update_read_state ON public.messages IS
  'Recipients may only update read_at/delivered_at. Column-level UPDATE privileges (read_at, delivered_at only) plus the BEFORE UPDATE triggers guard_message_read_state_update and messages_guard_content_edits make every other column immutable for all non-service roles.';

CREATE OR REPLACE FUNCTION public.guard_message_read_state_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user in ('service_role', 'supabase_admin', 'postgres') THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.body IS DISTINCT FROM OLD.body
    OR NEW.media_url IS DISTINCT FROM OLD.media_url
    OR NEW.slang_tag_id IS DISTINCT FROM OLD.slang_tag_id
    OR NEW.slang_tag_ids IS DISTINCT FROM OLD.slang_tag_ids
    OR NEW.chat_slang_tag_id IS DISTINCT FROM OLD.chat_slang_tag_id
    OR NEW.source_language IS DISTINCT FROM OLD.source_language
    OR NEW.transcript IS DISTINCT FROM OLD.transcript
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only read/delivery timestamps may be updated on messages';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_message_read_state_update ON public.messages;
CREATE TRIGGER guard_message_read_state_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_read_state_update();

REVOKE ALL ON FUNCTION public.guard_message_read_state_update() FROM PUBLIC, anon;

DROP TABLE IF EXISTS public._sec_test;