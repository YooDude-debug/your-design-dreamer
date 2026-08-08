ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS real_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS real_name_hidden boolean NOT NULL DEFAULT true;

GRANT SELECT (real_name, real_name_hidden), UPDATE (real_name, real_name_hidden) ON public.profiles TO authenticated;