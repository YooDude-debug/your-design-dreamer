CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() = _profile_id THEN true
    WHEN NOT public.test_user_visible(_profile_id) THEN false
    ELSE COALESCE((
      SELECT CASE p.profile_visibility
        WHEN 'public' THEN true
        WHEN 'connections' THEN public.are_connected(auth.uid(), p.id)
        ELSE false
      END
      FROM public.profiles p
      WHERE p.id = _profile_id
    ), false)
    OR public.are_connected(auth.uid(), _profile_id)
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.addressee_id = auth.uid()
        AND c.requester_id = _profile_id
        AND c.status = 'pending'
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.can_notify(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND _target IS NOT NULL
     AND auth.uid() <> _target
     AND (
       public.are_connected(auth.uid(), _target)
       OR EXISTS (
         SELECT 1 FROM public.connections c
         WHERE c.requester_id = auth.uid()
           AND c.addressee_id = _target
           AND c.status = 'pending'
       )
       OR EXISTS (
         SELECT 1
         FROM public.conversation_members a
         JOIN public.conversation_members b
           ON b.conversation_id = a.conversation_id
         WHERE a.user_id = auth.uid() AND b.user_id = _target
       )
     )
$function$;

REVOKE EXECUTE ON FUNCTION public.owns_moderation_action(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_moderation_action(uuid, uuid) TO anon, authenticated, service_role;