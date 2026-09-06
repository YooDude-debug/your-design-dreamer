CREATE TABLE public.registration_health_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'automatic',
  overall_status text NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_count integer NOT NULL DEFAULT 0,
  run_by uuid,
  note text,
  CONSTRAINT registration_health_checks_kind_chk CHECK (kind IN ('automatic', 'manual')),
  CONSTRAINT registration_health_checks_status_chk CHECK (overall_status IN ('healthy', 'manual_required', 'failed'))
);

GRANT SELECT ON public.registration_health_checks TO authenticated;
GRANT ALL ON public.registration_health_checks TO service_role;

ALTER TABLE public.registration_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read registration health checks"
ON public.registration_health_checks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX registration_health_checks_created_at_idx
ON public.registration_health_checks (created_at DESC);