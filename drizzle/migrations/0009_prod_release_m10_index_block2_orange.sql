CREATE INDEX IF NOT EXISTS idx_slang_tag_votes_user_id
  ON public.slang_tag_votes (user_id);

CREATE INDEX IF NOT EXISTS idx_globe_entries_round_id
  ON public.globe_entries (round_id);