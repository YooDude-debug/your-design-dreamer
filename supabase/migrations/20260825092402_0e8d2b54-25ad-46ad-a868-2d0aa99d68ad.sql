CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Personensuche (ILIKE '%term%') auf Nutzername und Anzeigename.
CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx
  ON public.profiles USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
  ON public.profiles USING gin (display_name gin_trgm_ops);

-- Vorschlagsliste ohne Suchbegriff: neueste Profile zuerst.
CREATE INDEX IF NOT EXISTS profiles_created_at_desc_idx
  ON public.profiles (created_at DESC);