CREATE TYPE public.feedback_category AS ENUM ('bug', 'improvement', 'design', 'performance', 'other');
CREATE TYPE public.feedback_status AS ENUM ('new', 'in_progress', 'done', 'rejected');

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL DEFAULT '',
  user_roles text[] NOT NULL DEFAULT '{}',
  category public.feedback_category NOT NULL,
  message text NOT NULL,
  area text NOT NULL DEFAULT '',
  device text NOT NULL DEFAULT '',
  browser text NOT NULL DEFAULT '',
  os text NOT NULL DEFAULT '',
  status public.feedback_status NOT NULL DEFAULT 'new',
  admin_note text NOT NULL DEFAULT '',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_message_len CHECK (char_length(message) BETWEEN 5 AND 20000),
  CONSTRAINT feedback_area_len CHECK (char_length(area) <= 200),
  CONSTRAINT feedback_note_len CHECK (char_length(admin_note) <= 4000)
);

CREATE INDEX feedback_created_idx ON public.feedback (created_at DESC);
CREATE INDEX feedback_user_idx ON public.feedback (user_id, created_at DESC);
CREATE INDEX feedback_status_idx ON public.feedback (status, created_at DESC);

GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own feedback"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'new' AND admin_note = '');

CREATE POLICY "Users read own feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update feedback"
  ON public.feedback FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Zeilenlimit (max. 300 Zeilen) als Trigger, plus updated_at.
CREATE OR REPLACE FUNCTION public.guard_feedback_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM regexp_split_to_table(NEW.message, E'\n')) > 300 THEN
    RAISE EXCEPTION 'Feedback darf maximal 300 Zeilen enthalten.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_feedback_message_trg
  BEFORE INSERT OR UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.guard_feedback_message();

REVOKE ALL ON FUNCTION public.guard_feedback_message() FROM PUBLIC, anon, authenticated;