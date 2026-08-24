CREATE TABLE public.ad_pauses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  month_key text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  ends_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_date)
);

GRANT SELECT, INSERT ON public.ad_pauses TO authenticated;
GRANT ALL ON public.ad_pauses TO service_role;

ALTER TABLE public.ad_pauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ad pauses"
  ON public.ad_pauses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ad pauses"
  ON public.ad_pauses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX ad_pauses_user_month_idx ON public.ad_pauses (user_id, month_key);