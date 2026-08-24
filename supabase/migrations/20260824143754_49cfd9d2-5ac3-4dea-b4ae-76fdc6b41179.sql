ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS group_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_push_at timestamptz;

CREATE INDEX IF NOT EXISTS notifications_group_idx
  ON public.notifications (user_id, type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  owner uuid;
  existing uuid;
  pushed timestamptz;
  cnt int;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NULL OR owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT count(DISTINCT pl.user_id)::int INTO cnt
    FROM public.post_likes pl
   WHERE pl.post_id = NEW.post_id AND pl.user_id <> owner;

  SELECT n.id, n.last_push_at INTO existing, pushed
    FROM public.notifications n
   WHERE n.user_id = owner AND n.type = 'post_like' AND n.entity_id = NEW.post_id
     AND n.created_at > now() - interval '6 hours'
   ORDER BY n.created_at DESC
   LIMIT 1;

  IF existing IS NULL THEN
    INSERT INTO public.notifications
      (user_id, actor_id, type, title, body, entity_type, entity_id, link, group_count, last_push_at)
    VALUES (owner, NEW.user_id, 'post_like', 'Neues Like', 'hat deinen Beitrag geliked.',
            'post', NEW.post_id, '/p/' || NEW.post_id::text, GREATEST(cnt, 1), now());
  ELSE
    UPDATE public.notifications
       SET actor_id = NEW.user_id,
           group_count = GREATEST(cnt, 1),
           read = false,
           created_at = now(),
           last_push_at = CASE WHEN pushed IS NULL OR pushed < now() - interval '5 minutes'
                               THEN now() ELSE pushed END
     WHERE id = existing;

    IF pushed IS NULL OR pushed < now() - interval '5 minutes' THEN
      UPDATE public.notification_jobs
         SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL
       WHERE notification_id = existing;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unnotify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  owner uuid;
  cnt int;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = OLD.post_id;
  IF owner IS NULL OR owner = OLD.user_id THEN RETURN OLD; END IF;

  SELECT count(DISTINCT pl.user_id)::int INTO cnt
    FROM public.post_likes pl
   WHERE pl.post_id = OLD.post_id AND pl.user_id <> owner;

  IF cnt = 0 THEN
    DELETE FROM public.notifications
     WHERE user_id = owner AND type = 'post_like' AND entity_id = OLD.post_id;
  ELSE
    UPDATE public.notifications
       SET group_count = cnt,
           actor_id = CASE WHEN actor_id = OLD.user_id THEN (
             SELECT pl.user_id FROM public.post_likes pl
              WHERE pl.post_id = OLD.post_id AND pl.user_id <> owner
              ORDER BY pl.created_at DESC LIMIT 1)
           ELSE actor_id END
     WHERE user_id = owner AND type = 'post_like' AND entity_id = OLD.post_id;
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS post_likes_unnotify ON public.post_likes;
CREATE TRIGGER post_likes_unnotify AFTER DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.unnotify_post_like();

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
               n.entity_id, n.link, n.read, n.created_at, n.group_count
        FROM public.notifications n
        WHERE n.user_id = auth.uid()
        ORDER BY n.created_at DESC
        LIMIT 50
      ) x), '[]'::jsonb)
  ) END
$function$;