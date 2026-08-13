-- 1. Nutzungserfassung verallgemeinern (Foto + Video), Tabelle bleibt erhalten
ALTER TABLE public.slang_tag_video_uses
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'video';

DO $$ BEGIN
  ALTER TABLE public.slang_tag_video_uses
    ADD CONSTRAINT slang_tag_video_uses_media_type_check
    CHECK (media_type IN ('image','video'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS slang_tag_video_uses_user_idx
  ON public.slang_tag_video_uses (user_id, year);
CREATE INDEX IF NOT EXISTS slang_tag_video_uses_media_idx
  ON public.slang_tag_video_uses (media_type, year);

-- 2. Nutzungsdatensaetze zentral in der DB pflegen
CREATE OR REPLACE FUNCTION public.sync_slang_tag_uses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.slang_tag_video_uses WHERE post_id = OLD.id;
    RETURN OLD;
  END IF;

  v_type := CASE WHEN NEW.video_url IS NOT NULL THEN 'video' ELSE 'image' END;

  DELETE FROM public.slang_tag_video_uses u
   WHERE u.post_id = NEW.id
     AND NOT (u.tag_id = ANY(COALESCE(NEW.slang_tag_ids, '{}'::uuid[])));

  INSERT INTO public.slang_tag_video_uses (tag_id, post_id, user_id, region, year, media_type)
  SELECT DISTINCT t, NEW.id, NEW.user_id, COALESCE(NEW.region, ''),
         EXTRACT(year FROM NEW.created_at)::int, v_type
    FROM unnest(COALESCE(NEW.slang_tag_ids, '{}'::uuid[])) t
  ON CONFLICT (post_id, tag_id) DO UPDATE
    SET region = EXCLUDED.region,
        media_type = EXCLUDED.media_type; -- Jahr bleibt unveraendert (Archiv-Schutz)

  RETURN NEW;
END $$;

-- 3. Zaehler ausschliesslich aus den Nutzungsdatensaetzen ableiten
CREATE OR REPLACE FUNCTION public.sync_slang_tag_use_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.slang_tags
       SET uses_count = uses_count + 1,
           video_uses_count = video_uses_count
             + CASE WHEN NEW.media_type = 'video' THEN 1 ELSE 0 END
     WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.media_type IS DISTINCT FROM OLD.media_type THEN
      UPDATE public.slang_tags
         SET video_uses_count = GREATEST(0, video_uses_count
               + CASE WHEN NEW.media_type = 'video' THEN 1 ELSE -1 END)
       WHERE id = NEW.tag_id;
    END IF;
    RETURN NEW;
  ELSE
    UPDATE public.slang_tags
       SET uses_count = GREATEST(0, uses_count - 1),
           video_uses_count = GREATEST(0, video_uses_count
             - CASE WHEN OLD.media_type = 'video' THEN 1 ELSE 0 END)
     WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
END $$;

DROP TRIGGER IF EXISTS posts_tag_uses ON public.posts;
DROP TRIGGER IF EXISTS slang_tag_video_uses_count ON public.slang_tag_video_uses;
DROP TRIGGER IF EXISTS posts_sync_slang_tag_uses ON public.posts;
DROP TRIGGER IF EXISTS slang_tag_uses_counters ON public.slang_tag_video_uses;

CREATE TRIGGER posts_sync_slang_tag_uses
AFTER INSERT OR UPDATE OF slang_tag_ids, region, video_url OR DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.sync_slang_tag_uses();

CREATE TRIGGER slang_tag_uses_counters
AFTER INSERT OR UPDATE OR DELETE ON public.slang_tag_video_uses
FOR EACH ROW EXECUTE FUNCTION public.sync_slang_tag_use_counters();

-- 4. Einmaliges Nachtragen bestehender Beitraege (keine Daten werden geloescht)
INSERT INTO public.slang_tag_video_uses (tag_id, post_id, user_id, region, year, media_type)
SELECT DISTINCT t, p.id, p.user_id, COALESCE(p.region, ''),
       EXTRACT(year FROM p.created_at)::int,
       CASE WHEN p.video_url IS NOT NULL THEN 'video' ELSE 'image' END
  FROM public.posts p, unnest(COALESCE(p.slang_tag_ids, '{}'::uuid[])) t
 WHERE EXISTS (SELECT 1 FROM public.slang_tags s WHERE s.id = t)
ON CONFLICT (post_id, tag_id) DO NOTHING;

-- 5. Zaehler exakt neu berechnen
UPDATE public.slang_tags s
   SET uses_count = c.total,
       video_uses_count = c.videos
  FROM (
    SELECT s2.id,
           COUNT(u.tag_id)::int AS total,
           COUNT(u.tag_id) FILTER (WHERE u.media_type = 'video')::int AS videos
      FROM public.slang_tags s2
      LEFT JOIN public.slang_tag_video_uses u ON u.tag_id = s2.id
     GROUP BY s2.id
  ) c
 WHERE c.id = s.id
   AND (s.uses_count <> c.total OR s.video_uses_count <> c.videos);

-- 6. Performance-Indizes fuer Feed, SlangTag- und Standortabfragen
CREATE INDEX IF NOT EXISTS posts_slang_tag_ids_gin
  ON public.posts USING gin (slang_tag_ids);
CREATE INDEX IF NOT EXISTS posts_feed_idx
  ON public.posts (moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_video_idx
  ON public.posts (created_at DESC) WHERE video_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS slang_definitions_geo_idx
  ON public.slang_definitions (country, region_name, city);