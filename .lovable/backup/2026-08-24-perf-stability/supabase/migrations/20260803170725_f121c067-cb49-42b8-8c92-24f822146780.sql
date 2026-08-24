ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'creator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'business';
ALTER TABLE public.test_accounts ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';