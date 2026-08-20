-- Zusatzfelder auf messages (rückwärtskompatibel, nullable)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS source_language text,
  ADD COLUMN IF NOT EXISTS transcript text;

-- Übersetzungs-Cache: eine Zeile pro Nachricht und Zielsprache
CREATE TABLE IF NOT EXISTS public.message_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  target_language text NOT NULL,
  source_language text,
  translated_text text NOT NULL DEFAULT '',
  transcript text,
  status text NOT NULL DEFAULT 'ready',
  audio_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, target_language)
);

CREATE INDEX IF NOT EXISTS message_translations_message_idx
  ON public.message_translations (message_id);

-- Nur Lesen für angemeldete Nutzer; Schreiben ausschließlich serverseitig.
GRANT SELECT ON public.message_translations TO authenticated;
GRANT ALL ON public.message_translations TO service_role;

ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_translations_select ON public.message_translations;
CREATE POLICY message_translations_select
  ON public.message_translations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_translations.message_id
        AND public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );