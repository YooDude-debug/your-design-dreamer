-- Moderationsliste eines Channels: sortiert nach angepinnt, dann Datum.
CREATE INDEX IF NOT EXISTS idx_posts_channel_mod
  ON public.posts (channel_id, channel_pinned DESC, created_at DESC)
  WHERE channel_id IS NOT NULL;

-- Der bisherige Teil-Index ist damit redundant (gleiches Prefix).
DROP INDEX IF EXISTS public.posts_channel_pinned_idx;

-- Followerliste wird nach Beitrittsdatum seitenweise gelesen.
CREATE INDEX IF NOT EXISTS idx_channel_follows_channel_created
  ON public.channel_follows (channel_id, created_at DESC);

DROP INDEX IF EXISTS public.idx_channel_follows_channel;