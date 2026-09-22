-- ORB Developer / Repair Environment – Phase 4: Deployment-Governance.
-- Nur eine neue Tabelle. Bestehende Tabellen, Daten und Trigger bleiben unberuehrt.
-- Zugriff ausschliesslich fuer Administratoren (public.has_role(auth.uid(),'admin')).
-- Eine Fix-Freigabe (Phase 2) ist ausdruecklich KEINE Deployment-Freigabe.

CREATE TABLE public.orb_dev_deployment_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fix_id TEXT NOT NULL REFERENCES public.orb_dev_fix_proposals (fix_id) ON DELETE RESTRICT,
  fix_version INTEGER NOT NULL,
  proposal_fingerprint TEXT NOT NULL,
  final_diff_fingerprint TEXT NOT NULL,
  sandbox_execution_id TEXT NOT NULL,
  sandbox_result TEXT NOT NULL,
  base_commit TEXT NOT NULL,
  target TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  migrations_approved BOOLEAN NOT NULL DEFAULT false,
  rollback_target TEXT NOT NULL,
  deployment_fingerprint TEXT NOT NULL,
  confirmation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DEPLOYMENT_APPROVED',
  approved_by UUID NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'admin_ui',
  comment TEXT,
  invalidated_at TIMESTAMPTZ,
  invalidated_reason TEXT,
  CONSTRAINT orb_dev_deploy_fix_id_format CHECK (fix_id ~ '^ORB-FIX-[0-9]{4}$'),
  CONSTRAINT orb_dev_deploy_proposal_fp CHECK (proposal_fingerprint ~ '^[0-9a-f]{16}$'),
  CONSTRAINT orb_dev_deploy_final_fp CHECK (final_diff_fingerprint ~ '^[0-9a-f]{16}$'),
  CONSTRAINT orb_dev_deploy_fingerprint CHECK (deployment_fingerprint ~ '^[0-9a-f]{16}$'),
  CONSTRAINT orb_dev_deploy_target CHECK (target IN ('STAGING','PRODUCTION')),
  CONSTRAINT orb_dev_deploy_sandbox_result CHECK (sandbox_result = 'PASSED'),
  CONSTRAINT orb_dev_deploy_source CHECK (source = 'admin_ui'),
  CONSTRAINT orb_dev_deploy_status CHECK (status IN (
    'DEPLOYMENT_APPROVED','DEPLOYMENT_INVALIDATED','CONSUMED'
  ))
);

CREATE UNIQUE INDEX orb_dev_one_active_deployment_approval
  ON public.orb_dev_deployment_approvals (fix_id, target)
  WHERE status = 'DEPLOYMENT_APPROVED';
CREATE INDEX orb_dev_deployment_approvals_fix_idx
  ON public.orb_dev_deployment_approvals (fix_id);
CREATE INDEX orb_dev_deployment_approvals_at_idx
  ON public.orb_dev_deployment_approvals (approved_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.orb_dev_deployment_approvals TO authenticated;
GRANT ALL ON public.orb_dev_deployment_approvals TO service_role;
ALTER TABLE public.orb_dev_deployment_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read deployment approvals" ON public.orb_dev_deployment_approvals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins create deployment approvals" ON public.orb_dev_deployment_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND approved_by = auth.uid()
    AND source = 'admin_ui'
    AND status = 'DEPLOYMENT_APPROVED'
  );
CREATE POLICY "admins invalidate deployment approvals" ON public.orb_dev_deployment_approvals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Eine erteilte Deployment-Freigabe ist unveraenderlich; erlaubt ist nur Entwertung
-- oder das einmalige Markieren als verbraucht.
CREATE OR REPLACE FUNCTION public.orb_dev_guard_deployment_approval_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fix_id IS DISTINCT FROM OLD.fix_id
     OR NEW.fix_version IS DISTINCT FROM OLD.fix_version
     OR NEW.proposal_fingerprint IS DISTINCT FROM OLD.proposal_fingerprint
     OR NEW.final_diff_fingerprint IS DISTINCT FROM OLD.final_diff_fingerprint
     OR NEW.sandbox_execution_id IS DISTINCT FROM OLD.sandbox_execution_id
     OR NEW.sandbox_result IS DISTINCT FROM OLD.sandbox_result
     OR NEW.base_commit IS DISTINCT FROM OLD.base_commit
     OR NEW.target IS DISTINCT FROM OLD.target
     OR NEW.scope IS DISTINCT FROM OLD.scope
     OR NEW.migrations_approved IS DISTINCT FROM OLD.migrations_approved
     OR NEW.rollback_target IS DISTINCT FROM OLD.rollback_target
     OR NEW.deployment_fingerprint IS DISTINCT FROM OLD.deployment_fingerprint
     OR NEW.confirmation IS DISTINCT FROM OLD.confirmation
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.source IS DISTINCT FROM OLD.source THEN
    RAISE EXCEPTION 'Deployment-Freigabe ist unveraenderlich: neue Freigabe erforderlich';
  END IF;
  IF OLD.status <> 'DEPLOYMENT_APPROVED' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Entwertete oder verbrauchte Deployment-Freigabe kann nicht reaktiviert werden';
  END IF;
  IF NEW.status = 'DEPLOYMENT_INVALIDATED' AND NEW.invalidated_at IS NULL THEN
    NEW.invalidated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orb_dev_deployment_approvals_immutable
  BEFORE UPDATE ON public.orb_dev_deployment_approvals
  FOR EACH ROW EXECUTE FUNCTION public.orb_dev_guard_deployment_approval_immutability();

COMMENT ON TABLE public.orb_dev_deployment_approvals IS
  'ORB Developer/Repair Phase 4: separate Deployment-Freigaben, gebunden an Fix-ID, Version, Final-Diff, Sandbox-Ergebnis, Base Commit, Ziel und Scope. Fix-Freigabe != Deployment-Freigabe.';
