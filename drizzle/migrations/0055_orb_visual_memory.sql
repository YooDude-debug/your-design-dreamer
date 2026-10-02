CREATE TABLE public.orb_visual_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope public.orb_scope NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/webp','image/png','image/jpeg','image/gif')),
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 8388608),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  source_type text NOT NULL CHECK (source_type IN ('user_upload','orb_generated','unknown')),
  source_message_id uuid NULL,
  origin_status text NOT NULL DEFAULT 'pending' CHECK (origin_status IN ('pending','stored','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, sha256)
);
CREATE INDEX orb_visual_assets_owner_idx ON public.orb_visual_assets (user_id, scope, created_at DESC, id);
CREATE INDEX orb_visual_assets_msg_idx ON public.orb_visual_assets (source_message_id) WHERE source_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orb_visual_assets TO authenticated;
GRANT ALL ON public.orb_visual_assets TO service_role;
ALTER TABLE public.orb_visual_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY orb_visual_assets_select_own ON public.orb_visual_assets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY orb_visual_assets_insert_own ON public.orb_visual_assets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND origin_status = 'pending');
CREATE POLICY orb_visual_assets_update_own ON public.orb_visual_assets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY orb_visual_assets_delete_own ON public.orb_visual_assets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Pfad muss exakt aus Besitzer, Scope, Hash und zum MIME-Typ passender Endung bestehen;
-- Identitätsfelder sind nach dem Anlegen unveränderlich; Quellnachricht muss demselben
-- Besitzer und Scope gehören.
CREATE OR REPLACE FUNCTION public.orb_guard_visual_asset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ext text;
BEGIN
  ext := CASE NEW.mime_type WHEN 'image/webp' THEN 'webp' WHEN 'image/png' THEN 'png'
         WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/gif' THEN 'gif' END;
  IF NEW.storage_path <> NEW.user_id::text || '/orb/' || NEW.scope::text || '/' || NEW.sha256 || '.' || ext THEN
    RAISE EXCEPTION 'orb_visual_asset: invalid storage path' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id <> OLD.user_id OR NEW.scope <> OLD.scope OR NEW.sha256 <> OLD.sha256
       OR NEW.storage_path <> OLD.storage_path OR NEW.mime_type <> OLD.mime_type
       OR NEW.source_type <> OLD.source_type OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'orb_visual_asset: identity fields are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.source_message_id IS NOT NULL AND NEW.source_message_id IS DISTINCT FROM OLD.source_message_id THEN
      RAISE EXCEPTION 'orb_visual_asset: source message is immutable' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := now();
  END IF;
  IF NEW.source_message_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.orb_messages m
    WHERE m.id = NEW.source_message_id AND m.user_id = NEW.user_id AND m.scope = NEW.scope AND m.role = 'user'
  ) THEN
    RAISE EXCEPTION 'orb_visual_asset: source message mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orb_guard_visual_asset BEFORE INSERT OR UPDATE ON public.orb_visual_assets
  FOR EACH ROW EXECUTE FUNCTION public.orb_guard_visual_asset();

CREATE TABLE public.orb_memory_images (
  memory_id uuid NOT NULL REFERENCES public.orb_nodes(id) ON DELETE CASCADE,
  image_id uuid NOT NULL REFERENCES public.orb_visual_assets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope public.orb_scope NOT NULL,
  basis text NOT NULL CHECK (basis IN ('analysis_image_ref','manual')),
  analysis_run_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (memory_id, image_id)
);
CREATE INDEX orb_memory_images_image_idx ON public.orb_memory_images (image_id);
CREATE INDEX orb_memory_images_owner_idx ON public.orb_memory_images (user_id, scope);

GRANT SELECT, INSERT, DELETE ON public.orb_memory_images TO authenticated;
GRANT ALL ON public.orb_memory_images TO service_role;
ALTER TABLE public.orb_memory_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY orb_memory_images_select_own ON public.orb_memory_images FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY orb_memory_images_insert_own ON public.orb_memory_images FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY orb_memory_images_delete_own ON public.orb_memory_images FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Verknüpfung nur zwischen Erinnerung und gespeichertem Bild desselben Besitzers und Scopes;
-- Begriffsknoten sind keine Erinnerungen.
CREATE OR REPLACE FUNCTION public.orb_guard_memory_image()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.orb_nodes n
    WHERE n.id = NEW.memory_id AND n.user_id = NEW.user_id AND n.scope = NEW.scope
      AND COALESCE(n.metadata->>'kind','') <> 'concept'
  ) THEN
    RAISE EXCEPTION 'orb_memory_image: memory mismatch' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orb_visual_assets a
    WHERE a.id = NEW.image_id AND a.user_id = NEW.user_id AND a.scope = NEW.scope AND a.origin_status = 'stored'
  ) THEN
    RAISE EXCEPTION 'orb_memory_image: image mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orb_guard_memory_image BEFORE INSERT ON public.orb_memory_images
  FOR EACH ROW EXECUTE FUNCTION public.orb_guard_memory_image();

REVOKE EXECUTE ON FUNCTION public.orb_guard_visual_asset() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orb_guard_memory_image() FROM PUBLIC, anon, authenticated;