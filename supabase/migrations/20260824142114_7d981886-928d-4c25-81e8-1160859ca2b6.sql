CREATE TABLE IF NOT EXISTS public.post_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  target_language text NOT NULL,
  source_language text,
  translated_title text NOT NULL DEFAULT '',
  translated_description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, target_language)
);

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS source_language text;

GRANT SELECT ON public.post_translations TO authenticated;
GRANT ALL ON public.post_translations TO service_role;

ALTER TABLE public.post_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_translations_read" ON public.post_translations;
CREATE POLICY "post_translations_read" ON public.post_translations
  FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

-- Bei Textänderung am Original wird die zwischengespeicherte Übersetzung verworfen.
CREATE OR REPLACE FUNCTION public.invalidate_post_translations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description THEN
    DELETE FROM public.post_translations WHERE post_id = NEW.id;
    NEW.source_language := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_post_translations() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS posts_invalidate_translations ON public.posts;
CREATE TRIGGER posts_invalidate_translations BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_post_translations();