ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS media_image_path text,
  ADD COLUMN IF NOT EXISTS media_video_path text,
  ADD COLUMN IF NOT EXISTS media_video_thumb_path text;

ALTER TABLE public.ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_media_single_chk;
ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_media_single_chk
  CHECK (media_image_path IS NULL OR media_video_path IS NULL);