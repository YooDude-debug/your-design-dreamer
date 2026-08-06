-- 1) Hashtag-Stammtabelle -------------------------------------------------
CREATE TABLE public.hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  posts_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hashtags_tag_pattern_idx ON public.hashtags (tag text_pattern_ops);
CREATE INDEX hashtags_posts_count_idx ON public.hashtags (posts_count DESC);
GRANT SELECT ON public.hashtags TO authenticated;
GRANT ALL ON public.hashtags TO service_role;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hashtags_select_authenticated" ON public.hashtags
  FOR SELECT TO authenticated USING (true);

-- 2) Zuordnung Beitrag <-> Hashtag ---------------------------------------
CREATE TABLE public.post_hashtags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, hashtag_id)
);
CREATE INDEX post_hashtags_hashtag_idx ON public.post_hashtags (hashtag_id, created_at DESC);
GRANT SELECT ON public.post_hashtags TO authenticated;
GRANT ALL ON public.post_hashtags TO service_role;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_hashtags_select_visible" ON public.post_hashtags
  FOR SELECT TO authenticated USING (public.can_view_post(post_id));

-- 3) Gefolgte Hashtags ---------------------------------------------------
CREATE TABLE public.hashtag_follows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hashtag_id)
);
CREATE INDEX hashtag_follows_user_idx ON public.hashtag_follows (user_id);
GRANT SELECT, INSERT, DELETE ON public.hashtag_follows TO authenticated;
GRANT ALL ON public.hashtag_follows TO service_role;
ALTER TABLE public.hashtag_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hashtag_follows_select_own" ON public.hashtag_follows
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "hashtag_follows_insert_own" ON public.hashtag_follows
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "hashtag_follows_delete_own" ON public.hashtag_follows
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4) Automatische Indexpflege -------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_post_hashtags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_tags text[];
  t text;
  hid uuid;
  affected uuid[] := '{}';
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT coalesce(array_agg(hashtag_id), '{}') INTO affected
      FROM public.post_hashtags WHERE post_id = OLD.id;
    DELETE FROM public.post_hashtags WHERE post_id = OLD.id;
  ELSE
    SELECT coalesce(array_agg(DISTINCT lower(btrim(regexp_replace(x, '^#+', '')))), '{}')
      INTO norm_tags
      FROM unnest(coalesce(NEW.hashtags, '{}'::text[])) AS x
     WHERE btrim(regexp_replace(x, '^#+', '')) <> '';

    SELECT coalesce(array_agg(hashtag_id), '{}') INTO affected
      FROM public.post_hashtags WHERE post_id = NEW.id;

    DELETE FROM public.post_hashtags ph
     WHERE ph.post_id = NEW.id
       AND ph.hashtag_id NOT IN (
         SELECT id FROM public.hashtags WHERE tag = ANY(norm_tags)
       );

    FOREACH t IN ARRAY norm_tags LOOP
      INSERT INTO public.hashtags (tag, label, last_used_at)
      VALUES (t, t, now())
      ON CONFLICT (tag) DO UPDATE SET last_used_at = now()
      RETURNING id INTO hid;

      INSERT INTO public.post_hashtags (post_id, hashtag_id)
      VALUES (NEW.id, hid)
      ON CONFLICT DO NOTHING;

      affected := affected || hid;
    END LOOP;
  END IF;

  IF array_length(affected, 1) IS NOT NULL THEN
    UPDATE public.hashtags h
       SET posts_count = (
             SELECT count(*) FROM public.post_hashtags ph WHERE ph.hashtag_id = h.id
           )
     WHERE h.id = ANY(affected);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER posts_sync_hashtags_ins
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.sync_post_hashtags();

CREATE TRIGGER posts_sync_hashtags_upd
AFTER UPDATE OF hashtags ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.sync_post_hashtags();

CREATE TRIGGER posts_sync_hashtags_del
AFTER DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.sync_post_hashtags();

-- 5) Backfill bestehender Beiträge --------------------------------------
INSERT INTO public.hashtags (tag, label, last_used_at)
SELECT DISTINCT lower(btrim(regexp_replace(x, '^#+', ''))), lower(btrim(regexp_replace(x, '^#+', ''))), now()
  FROM public.posts p, unnest(coalesce(p.hashtags, '{}'::text[])) AS x
 WHERE btrim(regexp_replace(x, '^#+', '')) <> ''
ON CONFLICT (tag) DO NOTHING;

INSERT INTO public.post_hashtags (post_id, hashtag_id)
SELECT p.id, h.id
  FROM public.posts p,
       unnest(coalesce(p.hashtags, '{}'::text[])) AS x
  JOIN public.hashtags h ON h.tag = lower(btrim(regexp_replace(x, '^#+', '')))
 WHERE btrim(regexp_replace(x, '^#+', '')) <> ''
ON CONFLICT DO NOTHING;

UPDATE public.hashtags h
   SET posts_count = (SELECT count(*) FROM public.post_hashtags ph WHERE ph.hashtag_id = h.id);

-- 6) Suche und Trends ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_hashtags(_q text DEFAULT '', _limit integer DEFAULT 20)
RETURNS TABLE(tag text, posts_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (SELECT lower(btrim(regexp_replace(coalesce(_q, ''), '^#+', ''))) AS needle)
  SELECT h.tag, h.posts_count
    FROM public.hashtags h, q
   WHERE auth.uid() IS NOT NULL
     AND h.posts_count > 0
     AND (q.needle = '' OR h.tag LIKE '%' || q.needle || '%')
   ORDER BY (h.tag = (SELECT needle FROM q)) DESC, h.posts_count DESC, h.tag
   LIMIT greatest(1, least(coalesce(_limit, 20), 50))
$$;

CREATE OR REPLACE FUNCTION public.trending_hashtags(_days integer DEFAULT 7, _limit integer DEFAULT 10)
RETURNS TABLE(tag text, posts_count integer, recent_posts integer, engagement integer, score numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.tag,
         h.posts_count,
         count(p.id)::int AS recent_posts,
         coalesce(sum(p.likes_count + p.comments_count * 2 + p.shares_count * 2), 0)::int AS engagement,
         round(count(p.id) * 3
               + coalesce(sum(p.likes_count + p.comments_count * 2 + p.shares_count * 2), 0) * 0.5, 3)::numeric AS score
    FROM public.hashtags h
    JOIN public.post_hashtags ph ON ph.hashtag_id = h.id
    JOIN public.posts p ON p.id = ph.post_id
   WHERE auth.uid() IS NOT NULL
     AND p.hidden_at IS NULL
     AND p.visibility = 'public'
     AND p.moderation_status <> 'blocked'
     AND p.created_at > now() - (greatest(1, least(coalesce(_days, 7), 90)) || ' days')::interval
   GROUP BY h.id, h.tag, h.posts_count
   ORDER BY score DESC, recent_posts DESC
   LIMIT greatest(1, least(coalesce(_limit, 10), 50))
$$;

REVOKE ALL ON FUNCTION public.search_hashtags(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trending_hashtags(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_hashtags(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trending_hashtags(integer, integer) TO authenticated, service_role;