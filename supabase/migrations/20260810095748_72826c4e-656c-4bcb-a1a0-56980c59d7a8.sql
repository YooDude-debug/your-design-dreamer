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
    'test_bots_visible', COALESCE((SELECT s.enabled FROM public.test_bot_settings s WHERE s.id = true), false),
    -- Freigegebene fremde SlangTags (Grants)
    'granted_tag_ids', COALESCE((SELECT jsonb_agg(tag_id) FROM public.slang_tag_grants WHERE grantee_id = auth.uid()), '[]'::jsonb),
    -- Werbepausen der letzten 40 Tage (Monatsfilter erfolgt lokal in der App)
    'ad_pauses', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT a.id, a.local_date, a.ends_at, a.month_key
        FROM public.ad_pauses a
        WHERE a.user_id = auth.uid() AND a.local_date >= (CURRENT_DATE - 40)
        ORDER BY a.local_date
      ) x), '[]'::jsonb),
    -- Verbindungen (eigene Anfragen und an mich gerichtete)
    'connections', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT c.id, c.requester_id, c.addressee_id, c.status, c.created_at, c.updated_at
        FROM public.connections c
        WHERE c.requester_id = auth.uid() OR c.addressee_id = auth.uid()
        ORDER BY c.created_at DESC
      ) x), '[]'::jsonb),
    -- Chats des Kontos inklusive Mitgliederliste und eigenem Lesestand
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
    -- Ungelesene Nachrichten je Chat (ohne Inhalte)
    'unread_counts', COALESCE((SELECT jsonb_object_agg(x.conversation_id, x.n) FROM (
        SELECT m.conversation_id, COUNT(*)::int AS n
        FROM public.messages m
        JOIN public.conversation_members cm
          ON cm.conversation_id = m.conversation_id AND cm.user_id = auth.uid()
        WHERE m.sender_id <> auth.uid() AND m.read_at IS NULL
        GROUP BY m.conversation_id
      ) x), '{}'::jsonb),
    -- Letzte 50 Benachrichtigungen
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