-- 1) Media: DM attachments only for conversation members
CREATE OR REPLACE FUNCTION public.can_read_media(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.messages m WHERE m.media_url = _object_name
  ) OR EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversation_members cm
      ON cm.conversation_id = m.conversation_id AND cm.user_id = auth.uid()
    WHERE m.media_url = _object_name
  )
$$;

REVOKE ALL ON FUNCTION public.can_read_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_media(text) TO authenticated;

DROP POLICY IF EXISTS "media_auth_read" ON storage.objects;
CREATE POLICY "media_auth_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.can_read_media(name)
  )
);

-- 2) Notifications: only to people the actor actually interacts with
CREATE OR REPLACE FUNCTION public.can_notify(_actor uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _actor IS NOT NULL
     AND _target IS NOT NULL
     AND _actor <> _target
     AND (
       EXISTS (
         SELECT 1 FROM public.connections c
         WHERE (c.requester_id = _actor AND c.addressee_id = _target)
            OR (c.requester_id = _target AND c.addressee_id = _actor)
       )
       OR EXISTS (
         SELECT 1
         FROM public.conversation_members a
         JOIN public.conversation_members b
           ON b.conversation_id = a.conversation_id
         WHERE a.user_id = _actor AND b.user_id = _target
       )
     )
$$;

REVOKE ALL ON FUNCTION public.can_notify(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_notify(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = actor_id
  AND public.can_notify(auth.uid(), user_id)
);

-- 3) Trigger-only SECURITY DEFINER functions must not be callable by API roles
REVOKE ALL ON FUNCTION public.sync_post_counter() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_tag_counter() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_comment_counts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_post_tag_uses() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_conversation_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;