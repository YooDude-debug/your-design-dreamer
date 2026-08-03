CREATE OR REPLACE FUNCTION public.is_conversation_creator(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND c.created_by = _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_conversation_creator(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_creator(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS conversation_members_insert ON public.conversation_members;
CREATE POLICY conversation_members_insert ON public.conversation_members
FOR INSERT TO authenticated
WITH CHECK (
  public.is_conversation_member(conversation_id, auth.uid())
  OR public.is_conversation_creator(conversation_id, auth.uid())
);