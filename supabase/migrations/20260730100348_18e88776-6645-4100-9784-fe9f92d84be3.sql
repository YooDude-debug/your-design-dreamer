-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'Deutsch',
  avatar_url text,
  cover_url text,
  verified boolean NOT NULL DEFAULT false,
  level integer NOT NULL DEFAULT 1,
  xp integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ SLANG TAGS ============
CREATE TABLE public.slang_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  audio_url text,
  duration text NOT NULL DEFAULT '0:02',
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  region text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'Deutsch',
  meaning text NOT NULL DEFAULT '',
  examples text[] NOT NULL DEFAULT '{}',
  plays_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  uses_count integer NOT NULL DEFAULT 0,
  shares_count integer NOT NULL DEFAULT 0,
  saves_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX slang_tags_name_key ON public.slang_tags (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slang_tags TO authenticated;
GRANT ALL ON public.slang_tags TO service_role;
ALTER TABLE public.slang_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slang_tags_select" ON public.slang_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "slang_tags_insert_own" ON public.slang_tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "slang_tags_update_own" ON public.slang_tags FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "slang_tags_delete_own" ON public.slang_tags FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- ============ POSTS ============
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  hashtags text[] NOT NULL DEFAULT '{}',
  image_url text,
  audio_url text,
  duration text NOT NULL DEFAULT '0:02',
  placements jsonb NOT NULL DEFAULT '[]'::jsonb,
  slang_tag_ids uuid[] NOT NULL DEFAULT '{}',
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  shares_count integer NOT NULL DEFAULT 0,
  views_count integer NOT NULL DEFAULT 0,
  saves_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_created_at_idx ON public.posts (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ COMMENTS ============
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  slang_tag_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON public.comments (post_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ POST INTERACTIONS ============
CREATE TABLE public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE public.post_saves (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE public.post_shares (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE public.post_views (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- ============ SLANG TAG INTERACTIONS ============
CREATE TABLE public.slang_tag_likes (
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, user_id)
);
CREATE TABLE public.slang_tag_saves (
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, user_id)
);
CREATE TABLE public.slang_tag_shares (
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, user_id)
);
CREATE TABLE public.slang_tag_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX slang_tag_plays_idx ON public.slang_tag_plays (tag_id, user_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['post_likes','post_saves','post_shares','post_views','slang_tag_likes','slang_tag_saves','slang_tag_shares','slang_tag_plays']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_insert_own" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "%s_delete_own" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t, t);
  END LOOP;
END $$;

-- ============ COUNTER TRIGGERS ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER posts_touch BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER slang_tags_touch BEFORE UPDATE ON public.slang_tags FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.sync_post_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE col text := TG_ARGV[0];
BEGIN
  IF TG_OP = 'INSERT' THEN
    EXECUTE format('UPDATE public.posts SET %I = %I + 1 WHERE id = $1', col, col) USING NEW.post_id;
    RETURN NEW;
  ELSE
    EXECUTE format('UPDATE public.posts SET %I = GREATEST(0, %I - 1) WHERE id = $1', col, col) USING OLD.post_id;
    RETURN OLD;
  END IF;
END; $$;

CREATE TRIGGER post_likes_count AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.sync_post_counter('likes_count');
CREATE TRIGGER post_saves_count AFTER INSERT OR DELETE ON public.post_saves FOR EACH ROW EXECUTE FUNCTION public.sync_post_counter('saves_count');
CREATE TRIGGER post_shares_count AFTER INSERT OR DELETE ON public.post_shares FOR EACH ROW EXECUTE FUNCTION public.sync_post_counter('shares_count');
CREATE TRIGGER post_views_count AFTER INSERT OR DELETE ON public.post_views FOR EACH ROW EXECUTE FUNCTION public.sync_post_counter('views_count');

CREATE OR REPLACE FUNCTION public.sync_tag_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE col text := TG_ARGV[0];
BEGIN
  IF TG_OP = 'INSERT' THEN
    EXECUTE format('UPDATE public.slang_tags SET %I = %I + 1 WHERE id = $1', col, col) USING NEW.tag_id;
    RETURN NEW;
  ELSE
    EXECUTE format('UPDATE public.slang_tags SET %I = GREATEST(0, %I - 1) WHERE id = $1', col, col) USING OLD.tag_id;
    RETURN OLD;
  END IF;
END; $$;

CREATE TRIGGER slang_tag_likes_count AFTER INSERT OR DELETE ON public.slang_tag_likes FOR EACH ROW EXECUTE FUNCTION public.sync_tag_counter('likes_count');
CREATE TRIGGER slang_tag_saves_count AFTER INSERT OR DELETE ON public.slang_tag_saves FOR EACH ROW EXECUTE FUNCTION public.sync_tag_counter('saves_count');
CREATE TRIGGER slang_tag_shares_count AFTER INSERT OR DELETE ON public.slang_tag_shares FOR EACH ROW EXECUTE FUNCTION public.sync_tag_counter('shares_count');
CREATE TRIGGER slang_tag_plays_count AFTER INSERT ON public.slang_tag_plays FOR EACH ROW EXECUTE FUNCTION public.sync_tag_counter('plays_count');

CREATE OR REPLACE FUNCTION public.sync_comment_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    IF array_length(NEW.slang_tag_ids, 1) IS NOT NULL THEN
      UPDATE public.slang_tags SET comments_count = comments_count + 1
        WHERE id IN (SELECT DISTINCT unnest(NEW.slang_tag_ids));
    END IF;
    RETURN NEW;
  ELSE
    UPDATE public.posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
    IF array_length(OLD.slang_tag_ids, 1) IS NOT NULL THEN
      UPDATE public.slang_tags SET comments_count = GREATEST(0, comments_count - 1)
        WHERE id IN (SELECT DISTINCT unnest(OLD.slang_tag_ids));
    END IF;
    RETURN OLD;
  END IF;
END; $$;
CREATE TRIGGER comments_counts AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.sync_comment_counts();

CREATE OR REPLACE FUNCTION public.sync_post_tag_uses()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND array_length(NEW.slang_tag_ids, 1) IS NOT NULL THEN
    UPDATE public.slang_tags SET uses_count = uses_count + 1
      WHERE id IN (SELECT DISTINCT unnest(NEW.slang_tag_ids));
  ELSIF TG_OP = 'DELETE' AND array_length(OLD.slang_tag_ids, 1) IS NOT NULL THEN
    UPDATE public.slang_tags SET uses_count = GREATEST(0, uses_count - 1)
      WHERE id IN (SELECT DISTINCT unnest(OLD.slang_tag_ids));
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER posts_tag_uses AFTER INSERT OR DELETE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.sync_post_tag_uses();

-- ============ REALTIME ============
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.slang_tags REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.slang_tags;

-- ============ STORAGE POLICIES ============
CREATE POLICY "media_auth_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'media');
CREATE POLICY "media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);