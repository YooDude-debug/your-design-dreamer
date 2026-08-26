-- Technische Betriebsüberwachung (Phase 3): Ereignisse + Vorfälle
CREATE TABLE public.ops_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  environment TEXT NOT NULL DEFAULT 'production',
  severity TEXT NOT NULL DEFAULT 'info',
  area TEXT NOT NULL,
  event TEXT NOT NULL,
  service TEXT,
  fn TEXT,
  fingerprint TEXT NOT NULL,
  message TEXT,
  duration_ms INTEGER,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ops_events_severity_chk CHECK (severity IN ('debug','info','warning','critical')),
  CONSTRAINT ops_events_environment_chk CHECK (environment IN ('development','staging','production'))
);

CREATE INDEX ops_events_created_idx ON public.ops_events (created_at DESC);
CREATE INDEX ops_events_env_area_idx ON public.ops_events (environment, area, created_at DESC);
CREATE INDEX ops_events_fingerprint_idx ON public.ops_events (fingerprint, created_at DESC);

GRANT SELECT ON public.ops_events TO authenticated;
GRANT ALL ON public.ops_events TO service_role;

ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_events_admin_select" ON public.ops_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ops_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  environment TEXT NOT NULL DEFAULT 'production',
  severity TEXT NOT NULL DEFAULT 'warning',
  area TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  event_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'open',
  alerted_at TIMESTAMPTZ,
  alert_count INTEGER NOT NULL DEFAULT 0,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  note TEXT,
  CONSTRAINT ops_incidents_severity_chk CHECK (severity IN ('info','warning','critical')),
  CONSTRAINT ops_incidents_environment_chk CHECK (environment IN ('development','staging','production')),
  CONSTRAINT ops_incidents_status_chk CHECK (status IN ('open','acknowledged','investigating','resolved'))
);

CREATE UNIQUE INDEX ops_incidents_open_key
  ON public.ops_incidents (environment, fingerprint)
  WHERE status <> 'resolved';
CREATE INDEX ops_incidents_env_status_idx ON public.ops_incidents (environment, status, last_seen_at DESC);

GRANT SELECT, UPDATE ON public.ops_incidents TO authenticated;
GRANT ALL ON public.ops_incidents TO service_role;

ALTER TABLE public.ops_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_incidents_admin_select" ON public.ops_incidents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ops_incidents_admin_update" ON public.ops_incidents
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ops_incidents_updated_at
  BEFORE UPDATE ON public.ops_incidents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();