CREATE TABLE public.channel_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  parent_category_id uuid REFERENCES public.channel_categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.channel_categories TO anon, authenticated;
GRANT ALL ON public.channel_categories TO service_role;
ALTER TABLE public.channel_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories readable" ON public.channel_categories
  FOR SELECT USING (is_active);
CREATE POLICY "admins manage categories" ON public.channel_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_channel_categories_parent ON public.channel_categories(parent_category_id, sort_order);
CREATE INDEX idx_channel_categories_active ON public.channel_categories(is_active, sort_order);
CREATE INDEX idx_channel_categories_name ON public.channel_categories(lower(name));

CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  image_url text,
  category_id uuid REFERENCES public.channel_categories(id) ON DELETE SET NULL,
  owner_id uuid,
  region text,
  followers_count integer NOT NULL DEFAULT 0,
  posts_count integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.channels TO anon, authenticated;
GRANT INSERT, UPDATE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public channels readable" ON public.channels
  FOR SELECT USING (is_active AND is_public);
CREATE POLICY "owners read own channels" ON public.channels
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "admins read all channels" ON public.channels
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users create own channels" ON public.channels
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update own channels" ON public.channels
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "admins update channels" ON public.channels
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_channels_category ON public.channels(category_id, sort_order);
CREATE INDEX idx_channels_active ON public.channels(is_active, is_public, followers_count DESC);
CREATE INDEX idx_channels_owner ON public.channels(owner_id);
CREATE INDEX idx_channels_region ON public.channels(region) WHERE region IS NOT NULL;
CREATE INDEX idx_channels_name ON public.channels(lower(name));

CREATE TRIGGER trg_channels_updated_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_channel_categories_updated_at BEFORE UPDATE ON public.channel_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.channel_follows (
  user_id uuid NOT NULL,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

GRANT SELECT, INSERT, DELETE ON public.channel_follows TO authenticated;
GRANT ALL ON public.channel_follows TO service_role;
ALTER TABLE public.channel_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own follows readable" ON public.channel_follows
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own follows insert" ON public.channel_follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own follows delete" ON public.channel_follows
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_channel_follows_channel ON public.channel_follows(channel_id);

ALTER TABLE public.posts
  ADD COLUMN channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  ADD COLUMN channel_category_id uuid REFERENCES public.channel_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_posts_channel ON public.posts(channel_id, created_at DESC) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_posts_channel_category ON public.posts(channel_category_id, created_at DESC) WHERE channel_category_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_channel_followers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.channels SET followers_count = followers_count + 1 WHERE id = NEW.channel_id;
  ELSE
    UPDATE public.channels SET followers_count = greatest(followers_count - 1, 0) WHERE id = OLD.channel_id;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_channel_followers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_channel_followers() FROM anon;
REVOKE ALL ON FUNCTION public.sync_channel_followers() FROM authenticated;

CREATE TRIGGER trg_channel_follows_count
  AFTER INSERT OR DELETE ON public.channel_follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_channel_followers();

CREATE OR REPLACE FUNCTION public.search_channels(_q text DEFAULT '', _limit integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  icon text,
  category_id uuid,
  category_name text,
  category_slug text,
  followers_count integer,
  posts_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH term AS (SELECT lower(btrim(coalesce(_q, ''))) AS q)
  SELECT c.id, c.name, c.slug, c.icon, c.category_id,
         cat.name, cat.slug, c.followers_count, c.posts_count
  FROM public.channels c
  LEFT JOIN public.channel_categories cat ON cat.id = c.category_id
  CROSS JOIN term
  WHERE c.is_active AND c.is_public
    AND (
      term.q = ''
      OR lower(c.name) LIKE '%' || term.q || '%'
      OR c.slug LIKE '%' || term.q || '%'
      OR lower(coalesce(cat.name, '')) LIKE '%' || term.q || '%'
      OR coalesce(cat.slug, '') LIKE '%' || term.q || '%'
      OR EXISTS (
        SELECT 1 FROM public.channel_categories sub
        WHERE sub.parent_category_id = c.category_id
          AND sub.is_active
          AND (lower(sub.name) LIKE '%' || term.q || '%' OR sub.slug LIKE '%' || term.q || '%')
      )
    )
  ORDER BY c.followers_count DESC, c.posts_count DESC, c.name
  LIMIT least(greatest(coalesce(_limit, 20), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.search_channels(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_channels(text, integer) TO anon, authenticated;