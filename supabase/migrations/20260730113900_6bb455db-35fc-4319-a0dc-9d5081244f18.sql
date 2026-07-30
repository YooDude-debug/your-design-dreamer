CREATE TABLE public.test_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  username text NOT NULL,
  email text NOT NULL UNIQUE,
  initial_password text NOT NULL,
  region text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'Deutsch',
  registered_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.test_accounts TO authenticated;
GRANT ALL ON public.test_accounts TO service_role;

ALTER TABLE public.test_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_accounts_select_admin"
  ON public.test_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "test_accounts_delete_admin"
  ON public.test_accounts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER test_accounts_touch_updated_at
  BEFORE UPDATE ON public.test_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();