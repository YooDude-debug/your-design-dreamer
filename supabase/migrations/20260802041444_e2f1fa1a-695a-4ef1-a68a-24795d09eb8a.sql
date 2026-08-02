DROP POLICY IF EXISTS conversation_members_insert ON public.conversation_members;

CREATE POLICY conversation_members_insert
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_conversation_member(conversation_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_members.conversation_id
      AND c.created_by = auth.uid()
  )
);