CREATE TABLE public.comment_translations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  target_language text NOT NULL,
  source_language text,
  translated_body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comment_translations_unique UNIQUE (comment_id, target_language)
);

GRANT SELECT ON public.comment_translations TO authenticated;
GRANT ALL ON public.comment_translations TO service_role;

ALTER TABLE public.comment_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_translations_select" ON public.comment_translations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.comments c
    WHERE c.id = comment_translations.comment_id
      AND public.can_view_post(c.post_id)
  )
);

CREATE TRIGGER comment_translations_updated_at
BEFORE UPDATE ON public.comment_translations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();