ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test_bot boolean NOT NULL DEFAULT false;

ALTER TABLE public.test_accounts
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.test_bot_settings (
  id boolean NOT NULL PRIMARY KEY DEFAULT true,
  enabled boolean NOT NULL DEFAULT false,
  running boolean NOT NULL DEFAULT false,
  bot_count integer NOT NULL DEFAULT 20,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT test_bot_settings_singleton CHECK (id)
);

GRANT SELECT ON public.test_bot_settings TO authenticated;
GRANT ALL ON public.test_bot_settings TO service_role;

ALTER TABLE public.test_bot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_bot_settings_select_authenticated"
  ON public.test_bot_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "test_bot_settings_admin_write"
  ON public.test_bot_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER test_bot_settings_touch
  BEFORE UPDATE ON public.test_bot_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.test_bot_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;