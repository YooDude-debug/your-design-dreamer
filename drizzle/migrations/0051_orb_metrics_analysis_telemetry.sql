-- D2: persistente technische Telemetrie der Hintergrundanalyse (nur Zahlen/Kennungen, keine Inhalte).
-- Rollback: ALTER TABLE public.orb_metrics DROP COLUMN analysis_run_id, DROP COLUMN provider, DROP COLUMN http_status,
--           DROP COLUMN failure_kind, DROP COLUMN pre_sanitize_count, DROP COLUMN post_sanitize_count, DROP COLUMN duration_ms;
ALTER TABLE public.orb_metrics
  ADD COLUMN IF NOT EXISTS analysis_run_id uuid,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS failure_kind text,
  ADD COLUMN IF NOT EXISTS pre_sanitize_count integer,
  ADD COLUMN IF NOT EXISTS post_sanitize_count integer,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

CREATE UNIQUE INDEX IF NOT EXISTS orb_metrics_analysis_run_id_key
  ON public.orb_metrics (analysis_run_id) WHERE analysis_run_id IS NOT NULL;

COMMENT ON COLUMN public.orb_metrics.analysis_run_id IS 'D2: technische Lauf-ID der Hintergrundanalyse (nur kind=analysis).';