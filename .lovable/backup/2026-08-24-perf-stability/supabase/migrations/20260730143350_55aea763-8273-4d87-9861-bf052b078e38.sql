DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP FUNCTION IF EXISTS public.can_notify(uuid, uuid);

CREATE OR REPLACE FUNCTION public.can_notify(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND _target IS NOT NULL
     AND auth.uid() <> _target
     AND (
       EXISTS (
         SELECT 1 FROM public.connections c
         WHERE (c.requester_id = auth.uid() AND c.addressee_id = _target)
            OR (c.requester_id = _target AND c.addressee_id = auth.uid())
       )
       OR EXISTS (
         SELECT 1
         FROM public.conversation_members a
         JOIN public.conversation_members b
           ON b.conversation_id = a.conversation_id
         WHERE a.user_id = auth.uid() AND b.user_id = _target
       )
     )
$$;

REVOKE ALL ON FUNCTION public.can_notify(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_notify(uuid) TO authenticated;

CREATE POLICY "notifications_insert" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = actor_id
  AND public.can_notify(user_id)
);