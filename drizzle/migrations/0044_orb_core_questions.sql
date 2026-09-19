CREATE TABLE public.orb_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  topic text,
  knowledge_gap text NOT NULL,
  gap_kind text NOT NULL,
  source_memory_ids uuid[] NOT NULL DEFAULT '{}',
  score numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  asked_at timestamp with time zone,
  answered boolean NOT NULL DEFAULT false,
  answer_received text,
  answered_at timestamp with time zone
);

REVOKE ALL ON public.orb_questions FROM anon;
REVOKE ALL ON public.orb_questions FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON public.orb_questions TO authenticated;
GRANT ALL ON public.orb_questions TO service_role;

ALTER TABLE public.orb_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orb_questions_select_own" ON public.orb_questions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "orb_questions_insert_own" ON public.orb_questions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "orb_questions_update_own" ON public.orb_questions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX orb_questions_user_created_idx ON public.orb_questions (user_id, created_at DESC);
CREATE INDEX orb_questions_user_open_idx ON public.orb_questions (user_id, answered, asked_at DESC);