ALTER TABLE public.slang_tags
  ADD COLUMN IF NOT EXISTS normalized_name text
    GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  ADD COLUMN IF NOT EXISTS community_shared boolean NOT NULL DEFAULT false;

UPDATE public.slang_tags SET owner_id = creator_id WHERE owner_id IS NULL;

CREATE INDEX IF NOT EXISTS slang_tags_normalized_name_idx
  ON public.slang_tags (normalized_name);

CREATE UNIQUE INDEX IF NOT EXISTS slang_tags_owner_name_unique
  ON public.slang_tags (owner_id, normalized_name);