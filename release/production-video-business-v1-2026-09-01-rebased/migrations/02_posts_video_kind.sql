ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS video_kind text NOT NULL DEFAULT 'shot';

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_video_kind_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_video_kind_check CHECK (video_kind IN ('shot', 'post'));

COMMENT ON COLUMN public.posts.video_kind IS 'shot = stummer SlangShot (max 5s), post = normaler Video-Beitrag (max 60s, Video Upload V1)';