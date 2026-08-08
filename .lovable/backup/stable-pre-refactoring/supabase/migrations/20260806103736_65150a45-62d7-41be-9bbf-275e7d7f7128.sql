-- 1) Indizes für häufige Zustandsabfragen ---------------------------------
CREATE INDEX IF NOT EXISTS post_likes_user_idx ON public.post_likes (user_id);
CREATE INDEX IF NOT EXISTS post_saves_user_idx ON public.post_saves (user_id);
CREATE INDEX IF NOT EXISTS post_shares_user_idx ON public.post_shares (user_id);
CREATE INDEX IF NOT EXISTS post_views_user_idx ON public.post_views (user_id);
CREATE INDEX IF NOT EXISTS post_views_post_idx ON public.post_views (post_id);
CREATE INDEX IF NOT EXISTS slang_tag_likes_user_idx ON public.slang_tag_likes (user_id);
CREATE INDEX IF NOT EXISTS slang_tag_saves_user_idx ON public.slang_tag_saves (user_id);
CREATE INDEX IF NOT EXISTS slang_tag_shares_user_idx ON public.slang_tag_shares (user_id);
CREATE INDEX IF NOT EXISTS slang_tag_plays_user_idx ON public.slang_tag_plays (user_id);
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS comments_user_idx ON public.comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_created_idx ON public.posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS connections_addressee_idx ON public.connections (addressee_id, status);
CREATE INDEX IF NOT EXISTS connections_requester_idx ON public.connections (requester_id, status);

-- 2) Bootstrap: alle persönlichen Zustände in einem Aufruf ----------------
CREATE OR REPLACE FUNCTION public.bootstrap_user_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
               p.verified, p.push_enabled, p.level, p.xp
        FROM public.profiles p WHERE p.id = auth.uid()
      ) x), 'null'::jsonb),
    'test_bots_visible', COALESCE((SELECT s.enabled FROM public.test_bot_settings s WHERE s.id = true), false)
  ) END
$$;

REVOKE ALL ON FUNCTION public.bootstrap_user_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_user_state() TO authenticated;

-- 3) Zähler entkoppeln: Sammel-Warteschlange -----------------------------
CREATE TABLE IF NOT EXISTS public.counter_events (
  id bigserial PRIMARY KEY,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  field text NOT NULL,
  delta integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS counter_events_pending_idx ON public.counter_events (entity, entity_id, field);

GRANT ALL ON public.counter_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.counter_events_id_seq TO service_role;
ALTER TABLE public.counter_events ENABLE ROW LEVEL SECURITY;
-- Nur der Server (service_role) verarbeitet die Warteschlange; Nutzer haben
-- keinen direkten Zugriff. Einträge entstehen ausschließlich über Trigger.
CREATE POLICY "counter_events admin read" ON public.counter_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.queue_counter_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity text := TG_ARGV[0];
  v_field text := TG_ARGV[1];
  v_col text := TG_ARGV[2];
BEGIN
  IF TG_OP = 'INSERT' THEN
    EXECUTE format('INSERT INTO public.counter_events (entity, entity_id, field, delta) VALUES ($1, ($2).%I, $3, 1)', v_col)
      USING v_entity, NEW, v_field;
    RETURN NEW;
  ELSE
    EXECUTE format('INSERT INTO public.counter_events (entity, entity_id, field, delta) VALUES ($1, ($2).%I, $3, -1)', v_col)
      USING v_entity, OLD, v_field;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS post_views_count ON public.post_views;
CREATE TRIGGER post_views_queue AFTER INSERT OR DELETE ON public.post_views
  FOR EACH ROW EXECUTE FUNCTION public.queue_counter_event('post', 'views_count', 'post_id');

DROP TRIGGER IF EXISTS slang_tag_plays_count ON public.slang_tag_plays;
CREATE TRIGGER slang_tag_plays_queue AFTER INSERT ON public.slang_tag_plays
  FOR EACH ROW EXECUTE FUNCTION public.queue_counter_event('slang_tag', 'plays_count', 'tag_id');

DROP TRIGGER IF EXISTS arena_plays_count ON public.arena_plays;
CREATE TRIGGER arena_plays_queue AFTER INSERT ON public.arena_plays
  FOR EACH ROW EXECUTE FUNCTION public.queue_counter_event('arena_submission', 'plays_count', 'submission_id');

-- Gebündelte Verarbeitung: aggregiert alle offenen Ereignisse und schreibt
-- pro Zeile genau ein UPDATE (weniger Zeilensperren, keine Rollback-Ketten).
CREATE OR REPLACE FUNCTION public.flush_counter_events(_max integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH batch AS (
    DELETE FROM public.counter_events
    WHERE id IN (SELECT id FROM public.counter_events ORDER BY id LIMIT greatest(_max, 1))
    RETURNING entity, entity_id, field, delta
  ),
  agg AS (
    SELECT entity, entity_id, field, sum(delta)::int AS delta
    FROM batch GROUP BY entity, entity_id, field
  ),
  p AS (
    UPDATE public.posts t SET views_count = GREATEST(0, t.views_count + a.delta)
    FROM agg a WHERE a.entity = 'post' AND a.field = 'views_count' AND t.id = a.entity_id
    RETURNING 1
  ),
  s AS (
    UPDATE public.slang_tags t SET plays_count = GREATEST(0, t.plays_count + a.delta)
    FROM agg a WHERE a.entity = 'slang_tag' AND a.field = 'plays_count' AND t.id = a.entity_id
    RETURNING 1
  ),
  ar AS (
    UPDATE public.arena_submissions t SET plays_count = GREATEST(0, t.plays_count + a.delta)
    FROM agg a WHERE a.entity = 'arena_submission' AND a.field = 'plays_count' AND t.id = a.entity_id
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM agg;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.flush_counter_events(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flush_counter_events(integer) TO service_role;