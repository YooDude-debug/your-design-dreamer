CREATE TABLE public.orb_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  topic text,
  status text NOT NULL DEFAULT 'OPEN',
  known jsonb NOT NULL DEFAULT '[]'::jsonb,
  unknown jsonb NOT NULL DEFAULT '[]'::jsonb,
  curiosity double precision NOT NULL DEFAULT 0.3,
  importance double precision NOT NULL DEFAULT 0.3,
  activation_count integer NOT NULL DEFAULT 1,
  node_ids uuid[] NOT NULL DEFAULT '{}',
  last_activation_at timestamptz NOT NULL DEFAULT now(),
  last_resume_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orb_threads_status_check CHECK (status IN ('OPEN','ACTIVE','PAUSED','REACTIVATED','RESOLVED'))
);

CREATE INDEX orb_threads_user_activity_idx ON public.orb_threads (user_id, last_activation_at DESC);
CREATE INDEX orb_threads_user_status_idx ON public.orb_threads (user_id, status);
CREATE UNIQUE INDEX orb_threads_user_title_idx ON public.orb_threads (user_id, lower(title));

REVOKE ALL ON public.orb_threads FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.orb_threads TO authenticated;
GRANT ALL ON public.orb_threads TO service_role;

ALTER TABLE public.orb_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orb_threads_select_own" ON public.orb_threads
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "orb_threads_insert_own" ON public.orb_threads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "orb_threads_update_own" ON public.orb_threads
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER orb_threads_set_updated_at
  BEFORE UPDATE ON public.orb_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.orb_style (
  user_id uuid PRIMARY KEY,
  messages integer NOT NULL DEFAULT 0,
  total_length integer NOT NULL DEFAULT 0,
  emoji_messages integer NOT NULL DEFAULT 0,
  question_messages integer NOT NULL DEFAULT 0,
  casual_messages integer NOT NULL DEFAULT 0,
  formal_messages integer NOT NULL DEFAULT 0,
  technical_messages integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.orb_style FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.orb_style TO authenticated;
GRANT ALL ON public.orb_style TO service_role;

ALTER TABLE public.orb_style ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orb_style_select_own" ON public.orb_style
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "orb_style_insert_own" ON public.orb_style
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "orb_style_update_own" ON public.orb_style
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER orb_style_set_updated_at
  BEFORE UPDATE ON public.orb_style
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();