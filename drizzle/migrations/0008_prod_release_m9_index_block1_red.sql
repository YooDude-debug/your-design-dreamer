-- INDEX BLOCK 1 (RED) — Production Release 2026-08-29, Migration 9 (exakt nach Release-Paket)
CREATE INDEX IF NOT EXISTS idx_slang_tags_creator_id ON public.slang_tags (creator_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_video_views_user_created ON public.post_video_views (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_offers_conversation_id ON public.market_offers (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_transactions_conversation_id ON public.market_transactions (conversation_id) WHERE conversation_id IS NOT NULL;