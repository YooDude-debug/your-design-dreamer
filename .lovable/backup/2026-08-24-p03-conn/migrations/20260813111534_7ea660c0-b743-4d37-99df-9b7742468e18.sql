ALTER TABLE public.slang_tag_grants
  ADD COLUMN IF NOT EXISTS requires_follow boolean NOT NULL DEFAULT false;

-- Gueltigkeit einer Freigabe: Drop aktiv + (falls follow-gebunden) aktives Folgen
CREATE OR REPLACE FUNCTION public.is_slang_tag_grant_active(_grant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.slang_tag_grants g
      JOIN public.slang_tags t ON t.id = g.tag_id
     WHERE g.id = _grant_id
       AND t.deleted_at IS NULL
       AND (t.drop_expires IS NULL OR t.drop_expires > now())
       AND (
         NOT (g.requires_follow OR COALESCE(t.follow_required, false))
         OR public.is_following(g.grantee_id, g.owner_id)
       )
  )
$$;

CREATE OR REPLACE FUNCTION public.has_slang_tag_grant(_tag_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE t.id = _tag_id AND (t.owner_id = _user_id OR t.creator_id = _user_id)
  ) OR EXISTS (
    SELECT 1
      FROM public.slang_tag_grants g
      JOIN public.slang_tags t ON t.id = g.tag_id
     WHERE g.tag_id = _tag_id
       AND g.grantee_id = _user_id
       AND t.deleted_at IS NULL
       AND (t.drop_expires IS NULL OR t.drop_expires > now())
       AND (
         NOT (g.requires_follow OR COALESCE(t.follow_required, false))
         OR public.is_following(g.grantee_id, g.owner_id)
       )
  )
$$;

-- SlangBox-Bootstrap liefert nur aktuell gueltige Drops
CREATE OR REPLACE FUNCTION public.bootstrap_user_state()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN auth.uid() IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'user_id', auth.uid(),
    'liked_posts', COALESCE((SELECT jsonb_agg(post_id) FROM public.post_likes WHERE user_id = auth.uid()), '[]'::jsonb),
    'saved_posts', COALESCE((SELECT jsonb_agg(post_id) FROM public.post_saves WHERE user_id = auth.uid()), '[]'::jsonb),
    'shared_posts', COALESCE((SELECT jsonb_agg(post_id) FROM public.post_shares WHERE user_id = auth.uid()), '[]'::jsonb),
    'liked_tags', COALESCE((SELECT jsonb_agg(tag_id) FROM public.slang_tag_likes WHERE user_id = auth.uid()), '[]'::jsonb),
    'saved_tags', COALESCE((SELECT jsonb_agg(tag_id) FROM public.slang_tag_saves WHERE user_id = auth.uid()), '[]'::jsonb),
    'following', COALESCE((SELECT jsonb_agg(following_id) FROM public.follows WHERE follower_id = auth.uid()), '[]'::jsonb),
    'roles', COALESCE((SELECT jsonb_agg(role) FROM public.user_roles WHERE user_id = auth.uid()), '[]'::jsonb),
    'profile', COALESCE((SELECT to_jsonb(x) FROM (
        SELECT p.id, p.username, p.location, p.location_visibility, p.profile_visibility,
               p.verified, p.push_enabled, p.level, p.xp, p.ads_enabled
        FROM public.profiles p WHERE p.id = auth.uid()
      ) x), 'null'::jsonb),
    'granted_tag_ids', COALESCE((
        SELECT jsonb_agg(g.tag_id)
          FROM public.slang_tag_grants g
         WHERE g.grantee_id = auth.uid()
           AND public.has_slang_tag_grant(g.tag_id, auth.uid())
      ), '[]'::jsonb),
    'ad_pauses', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT a.id, a.local_date, a.ends_at, a.month_key
        FROM public.ad_pauses a
        WHERE a.user_id = auth.uid() AND a.local_date >= (CURRENT_DATE - 40)
        ORDER BY a.local_date
      ) x), '[]'::jsonb),
    'connections', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT c.id, c.requester_id, c.addressee_id, c.status, c.created_at, c.updated_at
        FROM public.connections c
        WHERE c.requester_id = auth.uid() OR c.addressee_id = auth.uid()
        ORDER BY c.created_at DESC
      ) x), '[]'::jsonb),
    'conversations', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT co.id, co.kind, co.title, co.created_by, co.last_message_at,
               (SELECT COALESCE(jsonb_agg(m2.user_id), '[]'::jsonb)
                  FROM public.conversation_members m2 WHERE m2.conversation_id = co.id) AS members,
               mine.last_read_at
        FROM public.conversations co
        JOIN public.conversation_members mine
          ON mine.conversation_id = co.id AND mine.user_id = auth.uid()
        ORDER BY co.last_message_at DESC
      ) x), '[]'::jsonb),
    'unread_counts', COALESCE((SELECT jsonb_object_agg(x.cid, x.n) FROM (
        SELECT m.conversation_id::text AS cid, COUNT(*)::int AS n
        FROM public.messages m
        JOIN public.conversation_members cm
          ON cm.conversation_id = m.conversation_id AND cm.user_id = auth.uid()
        WHERE m.sender_id <> auth.uid() AND m.read_at IS NULL
        GROUP BY m.conversation_id
      ) x), '{}'::jsonb),
    'notifications', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT n.id, n.user_id, n.actor_id, n.type, n.title, n.body, n.entity_type,
               n.entity_id, n.link, n.read, n.created_at
        FROM public.notifications n
        WHERE n.user_id = auth.uid()
        ORDER BY n.created_at DESC
        LIMIT 50
      ) x), '[]'::jsonb)
  ) END
$function$;