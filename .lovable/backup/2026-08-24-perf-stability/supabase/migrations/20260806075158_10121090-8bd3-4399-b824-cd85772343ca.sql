-- Asynchrone Moderation: Status je Beitrag + Auftragswarteschlange

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderation_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

-- Bestehende Beitraege gelten als geprueft.
UPDATE public.posts SET moderation_status = 'approved', moderated_at = COALESCE(moderated_at, updated_at)
WHERE moderation_status = 'pending';

CREATE TABLE IF NOT EXISTS public.post_moderation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'post_create',
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  skip_image boolean NOT NULL DEFAULT false,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  result text NOT NULL DEFAULT '',
  last_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_moderation_jobs_due_idx
  ON public.post_moderation_jobs (status, next_attempt_at);

GRANT SELECT ON public.post_moderation_jobs TO authenticated;
GRANT ALL ON public.post_moderation_jobs TO service_role;

ALTER TABLE public.post_moderation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read moderation jobs"
ON public.post_moderation_jobs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER post_moderation_jobs_touch
BEFORE UPDATE ON public.post_moderation_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();