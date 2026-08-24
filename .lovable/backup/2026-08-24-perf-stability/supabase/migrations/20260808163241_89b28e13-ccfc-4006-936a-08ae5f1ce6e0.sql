DO $$ BEGIN
  CREATE TYPE public.presence_status AS ENUM ('online','busy','offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS presence_status public.presence_status NOT NULL DEFAULT 'online';

GRANT SELECT (presence_status), UPDATE (presence_status) ON public.profiles TO authenticated;