ALTER TABLE public.easter_eggs
  ADD COLUMN audio_url TEXT,
  ALTER COLUMN audio_base64 DROP NOT NULL;