CREATE TABLE public.media_variant_jobs (
  path TEXT PRIMARY KEY,
  owner_id UUID NOT NULL,
  needs_thumb BOOLEAN NOT NULL DEFAULT true,
  needs_medium BOOLEAN NOT NULL DEFAULT true,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_variant_jobs_status_check CHECK (status IN ('pending','done','failed'))
);

CREATE INDEX media_variant_jobs_status_idx ON public.media_variant_jobs (status, updated_at DESC);
CREATE INDEX media_variant_jobs_owner_idx ON public.media_variant_jobs (owner_id);

GRANT SELECT ON public.media_variant_jobs TO authenticated;
GRANT ALL ON public.media_variant_jobs TO service_role;

ALTER TABLE public.media_variant_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own variant jobs"
  ON public.media_variant_jobs FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER media_variant_jobs_updated_at
  BEFORE UPDATE ON public.media_variant_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();