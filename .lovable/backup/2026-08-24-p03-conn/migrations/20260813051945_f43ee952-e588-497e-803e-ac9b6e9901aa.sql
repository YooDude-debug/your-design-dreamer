ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_duration_ms integer,
  ADD COLUMN IF NOT EXISTS video_views_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.slang_tags
  ADD COLUMN IF NOT EXISTS video_uses_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.post_video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_video_views_idx
  ON public.post_video_views (post_id, user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.post_video_views TO authenticated;
GRANT ALL ON public.post_video_views TO service_role;
ALTER TABLE public.post_video_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_video_views_select" ON public.post_video_views
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_video_views_insert_own" ON public.post_video_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_video_views_delete_own" ON public.post_video_views
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER post_video_views_count
  AFTER INSERT OR DELETE ON public.post_video_views
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_counter('video_views_count');

CREATE TABLE IF NOT EXISTS public.slang_tag_video_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  region text NOT NULL DEFAULT '',
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS slang_tag_video_uses_tag_idx
  ON public.slang_tag_video_uses (tag_id, year);
CREATE INDEX IF NOT EXISTS slang_tag_video_uses_region_idx
  ON public.slang_tag_video_uses (region, year);

GRANT SELECT ON public.slang_tag_video_uses TO authenticated;
GRANT ALL ON public.slang_tag_video_uses TO service_role;
ALTER TABLE public.slang_tag_video_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slang_tag_video_uses_select" ON public.slang_tag_video_uses
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER slang_tag_video_uses_count
  AFTER INSERT OR DELETE ON public.slang_tag_video_uses
  FOR EACH ROW EXECUTE FUNCTION public.sync_tag_counter('video_uses_count');