-- 1) Only self-join, or the conversation creator may invite others
DROP POLICY IF EXISTS conversation_members_insert ON public.conversation_members;
CREATE POLICY conversation_members_insert
  ON public.conversation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND (
       public.is_conversation_member(conversation_id, auth.uid())
       OR public.is_conversation_creator(conversation_id, auth.uid())
    ))
    OR public.is_conversation_creator(conversation_id, auth.uid())
  );

-- 2) Column-level restriction: non-content updates only for regular users
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (read_at, delivered_at) ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- Keep the trigger guard as defense in depth
DROP POLICY IF EXISTS messages_update_read_state ON public.messages;
CREATE POLICY messages_update_read_state
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) AND auth.uid() <> sender_id)
  WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()) AND auth.uid() <> sender_id);