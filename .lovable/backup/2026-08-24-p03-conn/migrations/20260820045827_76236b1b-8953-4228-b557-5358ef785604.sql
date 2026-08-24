CREATE TABLE public.easter_eggs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  transcript TEXT NOT NULL,
  audio_base64 TEXT NOT NULL,
  audio_mime TEXT NOT NULL DEFAULT 'audio/mpeg',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.easter_eggs TO authenticated;
GRANT ALL ON public.easter_eggs TO service_role;

ALTER TABLE public.easter_eggs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "easter_eggs_select_active" ON public.easter_eggs
  FOR SELECT TO authenticated USING (is_active);

CREATE POLICY "easter_eggs_admin_write" ON public.easter_eggs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));