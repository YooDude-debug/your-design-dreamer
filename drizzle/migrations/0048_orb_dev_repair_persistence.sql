-- ORB Developer / Repair Environment – Phase 2: Persistenzebene.
-- Nur neue Tabellen. Keine bestehenden Tabellen, Daten oder Trigger geändert.
-- Zugriff ausschliesslich für Administratoren (public.has_role(auth.uid(),'admin')).

-- 1) Fix-Vorschläge (unveränderlicher Inhalt, nur Status wandert)
CREATE TABLE public.orb_dev_fix_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fix_id TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_fix_id TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  root_cause TEXT NOT NULL,
  root_cause_confidence TEXT NOT NULL,
  files TEXT[] NOT NULL DEFAULT '{}',
  diff TEXT NOT NULL,
  operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  test_plan TEXT[] NOT NULL DEFAULT '{}',
  expected_effects TEXT[] NOT NULL DEFAULT '{}',
  risks TEXT[] NOT NULL DEFAULT '{}',
  rollback_plan TEXT[] NOT NULL DEFAULT '{}',
  fingerprint TEXT NOT NULL,
  created_source TEXT NOT NULL DEFAULT 'orb_diagnostic',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orb_dev_fix_id_format CHECK (fix_id ~ '^ORB-FIX-[0-9]{4}$'),
  CONSTRAINT orb_dev_fingerprint_format CHECK (fingerprint ~ '^[0-9a-f]{16}$'),
  CONSTRAINT orb_dev_proposal_status CHECK (status IN (
    'DRAFT','ANALYZING','DIAGNOSIS_READY','FIX_PROPOSED','WAITING_FOR_ADMIN_APPROVAL',
    'APPROVED','INVALIDATED','EXECUTING','TESTING','PASSED','FAILED','ROLLED_BACK','COMPLETED'
  )),
  CONSTRAINT orb_dev_root_cause_confidence CHECK (root_cause_confidence IN (
    'ROOT_CAUSE_PROVEN','ROOT_CAUSE_PLAUSIBLE','ROOT_CAUSE_UNKNOWN'
  ))
);

CREATE INDEX orb_dev_fix_proposals_created_idx ON public.orb_dev_fix_proposals (created_at DESC);
CREATE INDEX orb_dev_fix_proposals_status_idx ON public.orb_dev_fix_proposals (status);

GRANT SELECT, INSERT, UPDATE ON public.orb_dev_fix_proposals TO authenticated;
GRANT ALL ON public.orb_dev_fix_proposals TO service_role;
ALTER TABLE public.orb_dev_fix_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read fix proposals" ON public.orb_dev_fix_proposals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins create fix proposals" ON public.orb_dev_fix_proposals
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE POLICY "admins advance fix status" ON public.orb_dev_fix_proposals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inhalt eines Vorschlags ist unveränderlich: nur Status/updated_at dürfen wandern.
CREATE OR REPLACE FUNCTION public.orb_dev_guard_proposal_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fix_id IS DISTINCT FROM OLD.fix_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.supersedes_fix_id IS DISTINCT FROM OLD.supersedes_fix_id
     OR NEW.root_cause IS DISTINCT FROM OLD.root_cause
     OR NEW.root_cause_confidence IS DISTINCT FROM OLD.root_cause_confidence
     OR NEW.files IS DISTINCT FROM OLD.files
     OR NEW.diff IS DISTINCT FROM OLD.diff
     OR NEW.operations IS DISTINCT FROM OLD.operations
     OR NEW.test_plan IS DISTINCT FROM OLD.test_plan
     OR NEW.expected_effects IS DISTINCT FROM OLD.expected_effects
     OR NEW.risks IS DISTINCT FROM OLD.risks
     OR NEW.rollback_plan IS DISTINCT FROM OLD.rollback_plan
     OR NEW.fingerprint IS DISTINCT FROM OLD.fingerprint
     OR NEW.created_source IS DISTINCT FROM OLD.created_source
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Fix-Inhalt ist unveraenderlich: neue Fix-Version anlegen';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orb_dev_fix_proposals_immutable
  BEFORE UPDATE ON public.orb_dev_fix_proposals
  FOR EACH ROW EXECUTE FUNCTION public.orb_dev_guard_proposal_immutability();

-- 2) Freigaben (an Fix-ID + Fingerprint + Operationsmenge gebunden)
CREATE TABLE public.orb_dev_fix_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fix_id TEXT NOT NULL REFERENCES public.orb_dev_fix_proposals (fix_id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL,
  operations JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPROVED',
  approved_by UUID NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'admin_ui',
  comment TEXT,
  invalidated_at TIMESTAMPTZ,
  invalidated_reason TEXT,
  CONSTRAINT orb_dev_approval_status CHECK (status IN ('APPROVED','INVALIDATED','REVOKED')),
  CONSTRAINT orb_dev_approval_source CHECK (source = 'admin_ui'),
  CONSTRAINT orb_dev_approval_fingerprint CHECK (fingerprint ~ '^[0-9a-f]{16}$')
);

CREATE UNIQUE INDEX orb_dev_one_active_approval_per_fix
  ON public.orb_dev_fix_approvals (fix_id) WHERE status = 'APPROVED';
CREATE INDEX orb_dev_fix_approvals_fix_idx ON public.orb_dev_fix_approvals (fix_id);

GRANT SELECT, INSERT, UPDATE ON public.orb_dev_fix_approvals TO authenticated;
GRANT ALL ON public.orb_dev_fix_approvals TO service_role;
ALTER TABLE public.orb_dev_fix_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read approvals" ON public.orb_dev_fix_approvals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins create approvals" ON public.orb_dev_fix_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND approved_by = auth.uid()
    AND source = 'admin_ui'
    AND status = 'APPROVED'
  );
CREATE POLICY "admins invalidate approvals" ON public.orb_dev_fix_approvals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Eine erteilte Freigabe ist unveränderlich; erlaubt ist nur die Entwertung.
CREATE OR REPLACE FUNCTION public.orb_dev_guard_approval_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fix_id IS DISTINCT FROM OLD.fix_id
     OR NEW.fingerprint IS DISTINCT FROM OLD.fingerprint
     OR NEW.operations IS DISTINCT FROM OLD.operations
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.source IS DISTINCT FROM OLD.source THEN
    RAISE EXCEPTION 'Freigabe ist unveraenderlich: nur Entwertung erlaubt';
  END IF;
  IF OLD.status <> 'APPROVED' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Entwertete Freigabe kann nicht reaktiviert werden';
  END IF;
  IF NEW.status IN ('INVALIDATED','REVOKED') AND NEW.invalidated_at IS NULL THEN
    NEW.invalidated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orb_dev_fix_approvals_immutable
  BEFORE UPDATE ON public.orb_dev_fix_approvals
  FOR EACH ROW EXECUTE FUNCTION public.orb_dev_guard_approval_immutability();

-- 3) Audit-Ereignisse (nur anhängen, niemals ändern oder löschen)
CREATE TABLE public.orb_dev_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor UUID NOT NULL,
  action TEXT NOT NULL,
  fix_id TEXT,
  previous_status TEXT,
  new_status TEXT,
  files TEXT[] NOT NULL DEFAULT '{}',
  result TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX orb_dev_audit_log_at_idx ON public.orb_dev_audit_log (at DESC);
CREATE INDEX orb_dev_audit_log_fix_idx ON public.orb_dev_audit_log (fix_id);

GRANT SELECT, INSERT ON public.orb_dev_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.orb_dev_audit_log TO service_role;
ALTER TABLE public.orb_dev_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read audit log" ON public.orb_dev_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins append audit log" ON public.orb_dev_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND actor = auth.uid());

COMMENT ON TABLE public.orb_dev_fix_proposals IS 'ORB Developer/Repair Phase 2: persistente Fix-Vorschlaege, Inhalt unveraenderlich.';
COMMENT ON TABLE public.orb_dev_fix_approvals IS 'ORB Developer/Repair Phase 2: Freigaben, gebunden an Fix-ID + Fingerprint + Operationen.';
COMMENT ON TABLE public.orb_dev_audit_log IS 'ORB Developer/Repair Phase 2: Audit-Ereignisse, nur anhaengen, keine Secrets.';