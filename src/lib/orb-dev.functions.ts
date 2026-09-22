/**
 * ORB Developer / Repair Environment – serverseitige Schnittstelle (Phase 2).
 *
 * Jede Funktion erzwingt: authentifizierter Nutzer (requireSupabaseAuth) und
 * Administratorrolle (bestehende `has_role`-Prüfung über assertAdmin). Alle
 * Daten laufen zusätzlich über den RLS-gebundenen Client des Aufrufers, sodass
 * die Datenbank eine zweite, unabhängige Sicherheitsgrenze bildet.
 * Die UI ist nur Anzeige – niemals die Sicherheitsgrenze.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AuditEntry, Diagnosis } from "@/orb-dev/types";
import type { FixApproval, FixProposal, FixState } from "@/orb-dev/fix-model";

export type OrbDevStatus = {
  adminId: string;
  phase: "PHASE_3_SANDBOX";
  writeOperationsEnabled: boolean;
  selfModificationEnabled: boolean;
  deploymentEnabled: boolean;
  persistence: "database_with_rls";
  allowedRoots: string[];
  proposals: number;
  approvals: number;
  /** Phase 3: isolierte Sandbox erlaubt, Live-Code und Deployment weiterhin aus. */
  sandboxExecutionEnabled: boolean;
  liveCodeWriteEnabled: boolean;
  autonomousSelfRepairEnabled: boolean;
};

export const orbDevStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrbDevStatus> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const {
      PHASE2_EXECUTION_ENABLED,
      PHASE1_SELF_MODIFICATION_ENABLED,
      PHASE1_DEPLOYMENT_ENABLED,
      PHASE3_SANDBOX_EXECUTION_ENABLED,
      PHASE3_LIVE_CODE_WRITE_ENABLED,
      PHASE3_AUTONOMOUS_SELF_REPAIR_ENABLED,
    } = await import("@/orb-dev/fix-model");
    const { ALLOWED_ROOTS } = await import("@/orb-dev/code-access.server");
    const repo = await import("@/orb-dev/repo.server");
    const [proposals, approvals] = await Promise.all([
      repo.listProposals(context.supabase),
      repo.listApprovals(context.supabase),
    ]);
    return {
      adminId,
      phase: "PHASE_3_SANDBOX",
      writeOperationsEnabled: PHASE2_EXECUTION_ENABLED,
      selfModificationEnabled: PHASE1_SELF_MODIFICATION_ENABLED,
      deploymentEnabled: PHASE1_DEPLOYMENT_ENABLED,
      persistence: "database_with_rls",
      allowedRoots: [...ALLOWED_ROOTS],
      proposals: proposals.length,
      approvals: approvals.filter((a) => a.status === "APPROVED").length,
      sandboxExecutionEnabled: PHASE3_SANDBOX_EXECUTION_ENABLED,
      liveCodeWriteEnabled: PHASE3_LIVE_CODE_WRITE_ENABLED,
      autonomousSelfRepairEnabled: PHASE3_AUTONOMOUS_SELF_REPAIR_ENABLED,
    };
  });

/* ------------------------------------------------------------- Code Access */

export type CodeQueryMode =
  | "read"
  | "search"
  | "symbol"
  | "callers"
  | "dependencies"
  | "tests"
  | "schema";

export const orbDevCodeQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode: CodeQueryMode; value: string }) => {
    const modes: CodeQueryMode[] = [
      "read",
      "search",
      "symbol",
      "callers",
      "dependencies",
      "tests",
      "schema",
    ];
    if (!modes.includes(input?.mode)) throw new Error("Ungültiger Modus");
    const value = String(input?.value ?? "").slice(0, 200);
    if (value.trim().length < 2) throw new Error("Eingabe zu kurz");
    return { mode: input.mode, value: value.trim() };
  })
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      mode: CodeQueryMode;
      file?: { path: string; lines: number; content: string };
      matches?: { path: string; line: number; text: string }[];
      dependencies?: string[];
    }> => {
      const { assertAdmin } = await import("@/lib/admin.server");
      const adminId = await assertAdmin(context);
      const access = await import("@/orb-dev/code-access.server");
      const { audit } = await import("@/orb-dev/repo.server");
      await audit(context.supabase, adminId, {
        action: `CODE_${data.mode.toUpperCase()}`,
        fixId: null,
        previousState: null,
        newState: null,
        files: data.mode === "read" ? [data.value] : [],
        result: "read-only",
      });
      switch (data.mode) {
        case "read":
          return { mode: data.mode, file: await access.readCodeFile(data.value) };
        case "search":
          return { mode: data.mode, matches: await access.searchCode(data.value) };
        case "symbol":
          return { mode: data.mode, matches: await access.findSymbolDefinitions(data.value) };
        case "callers":
          return { mode: data.mode, matches: await access.findCallers(data.value) };
        case "dependencies":
          return { mode: data.mode, dependencies: await access.fileDependencies(data.value) };
        case "tests":
          return { mode: data.mode, matches: await access.findRelatedTests(data.value) };
        case "schema":
          return { mode: data.mode, matches: await access.findSchemaReferences(data.value) };
      }
    },
  );

/* -------------------------------------------------------------- Diagnostics */

export const orbDevRunDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { question?: string; memory?: string }) => ({
    question: String(input?.question ?? "Wie alt bin ich?").slice(0, 300),
    memory: String(input?.memory ?? "Ich bin 36 Jahre.").slice(0, 300),
  }))
  .handler(async ({ context, data }): Promise<Diagnosis> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { diagnoseMemoryRecallCase } = await import("@/orb-dev/diagnose.server");
    const { audit } = await import("@/orb-dev/repo.server");
    const diagnosis = await diagnoseMemoryRecallCase(data.question, data.memory);
    await audit(context.supabase, adminId, {
      action: "RUN_DIAGNOSIS",
      fixId: null,
      previousState: "ANALYZING",
      newState: "DIAGNOSIS_READY",
      files: [],
      result: diagnosis.rootCauseLevel,
    });
    return diagnosis;
  });

/* ------------------------------------------------------------ Fix Proposals */

export type ProposalView = FixProposal & {
  fingerprint: string;
  approved: boolean;
  version: number;
  supersedesFixId: string | null;
  updatedAt: string;
  approval: {
    approvedBy: string;
    approvedAt: string;
    fingerprint: string;
    status: string;
  } | null;
};

export const orbDevListProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProposalView[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const repo = await import("@/orb-dev/repo.server");
    const { checkApproval } = await import("@/orb-dev/fix-model");
    const [proposals, approvals] = await Promise.all([
      repo.listProposals(context.supabase),
      repo.listApprovals(context.supabase),
    ]);
    return proposals.map((p) => {
      const row = approvals.find((a) => a.fix_id === p.fixId && a.status === "APPROVED") ?? null;
      const approval: FixApproval | null = row
        ? {
            fixId: row.fix_id,
            fingerprint: row.fingerprint,
            operations: row.operations as unknown as FixProposal["operations"],
            approvedBy: row.approved_by,
            approvedAt: row.approved_at,
            source: "admin_ui",
          }
        : null;
      return {
        ...p,
        approved: checkApproval(p, approval).valid,
        approval: row
          ? {
              approvedBy: row.approved_by,
              approvedAt: row.approved_at,
              fingerprint: row.fingerprint,
              status: row.status,
            }
          : null,
      };
    });
  });

export const orbDevCreateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ created: string | null; error?: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { diagnoseMemoryRecallCase, proposalFromDiagnosis } =
      await import("@/orb-dev/diagnose.server");
    const repo = await import("@/orb-dev/repo.server");
    const diagnosis = await diagnoseMemoryRecallCase();
    const fixId = await repo.nextFixId(context.supabase);
    const candidate = proposalFromDiagnosis(diagnosis, fixId);
    if ("error" in candidate) return { created: null, error: candidate.error };
    await repo.insertProposal(context.supabase, adminId, candidate);
    const waiting = await repo.setProposalState(
      context.supabase,
      candidate.fixId,
      "WAITING_FOR_ADMIN_APPROVAL",
    );
    await repo.audit(context.supabase, adminId, {
      action: "CREATE_FIX_PROPOSAL",
      fixId: waiting.fixId,
      previousState: "FIX_PROPOSED",
      newState: waiting.state,
      files: waiting.files,
      result: "wartet auf Administrator-Freigabe",
      metadata: { fingerprint: waiting.fingerprint, version: waiting.version },
    });
    return { created: waiting.fixId };
  });

export const orbDevApproveFix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fixId: string; fingerprint: string; comment?: string }) => {
    const fixId = String(input?.fixId ?? "");
    if (!/^ORB-FIX-\d{4}$/.test(fixId)) throw new Error("Ungültige Fix-ID");
    const fingerprint = String(input?.fingerprint ?? "");
    if (!/^[0-9a-f]{16}$/.test(fingerprint)) throw new Error("Ungültiger Fix-Fingerabdruck");
    const comment = input?.comment ? String(input.comment).slice(0, 500) : undefined;
    return { fixId, fingerprint, comment };
  })
  .handler(async ({ context, data }): Promise<{ ok: boolean; reason?: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { approveFix, audit } = await import("@/orb-dev/repo.server");
    // Quelle ist fest „admin_ui“ – kein Aufrufer kann eine andere Quelle setzen.
    const result = await approveFix(context.supabase, { ...data, adminId, source: "admin_ui" });
    if (!result.ok) {
      await audit(context.supabase, adminId, {
        action: "APPROVE_FIX_REJECTED",
        fixId: data.fixId,
        previousState: null,
        newState: null,
        files: [],
        result: result.reason,
      });
      return { ok: false, reason: result.reason };
    }
    return { ok: true };
  });

/** Änderung eines Fix-Inhalts: alte Freigabe verfällt, neue Fix-ID entsteht. */
export const orbDevReviseFix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fixId: string; note: string }) => {
    const fixId = String(input?.fixId ?? "");
    if (!/^ORB-FIX-\d{4}$/.test(fixId)) throw new Error("Ungültige Fix-ID");
    const note = String(input?.note ?? "").slice(0, 300);
    if (note.trim().length < 3) throw new Error("Änderungsnotiz zu kurz");
    return { fixId, note: note.trim() };
  })
  .handler(async ({ context, data }): Promise<{ created: string | null; error?: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const repo = await import("@/orb-dev/repo.server");
    const previous = await repo.getProposal(context.supabase, data.fixId);
    if (!previous) return { created: null, error: "Fix-ID unbekannt" };
    const revised = await repo.reviseProposal(
      context.supabase,
      data.fixId,
      { diff: `${previous.diff}\n# Änderung: ${data.note}\n` },
      adminId,
    );
    return { created: revised.fixId };
  });

/** Jede gedachte Repair-Operation – weiterhin immer abgelehnt. */
export const orbDevRequestExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fixId: string; path: string }) => ({
    fixId: String(input?.fixId ?? ""),
    path: String(input?.path ?? ""),
  }))
  .handler(async ({ context, data }): Promise<{ allowed: false; reason: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { authorizeOperation, audit } = await import("@/orb-dev/repo.server");
    const decision = await authorizeOperation(context.supabase, data.fixId, {
      kind: "edit_file",
      path: data.path,
    });
    await audit(context.supabase, adminId, {
      action: "REQUEST_EXECUTION_DENIED",
      fixId: /^ORB-FIX-\d{4}$/.test(data.fixId) ? data.fixId : null,
      previousState: null,
      newState: null,
      files: [data.path],
      result: decision.reason,
    });
    return decision;
  });

/* -------------------------------------------------------- Phase 3: Sandbox */

export type SandboxGateView = {
  fixId: string;
  ready: boolean;
  reason: string | null;
  state: string;
  version: number | null;
  fingerprint: string | null;
  patchFiles: string[];
  commands: string[];
  liveCodeWriteEnabled: boolean;
  deploymentEnabled: boolean;
};

/**
 * Serverseitige Neuprüfung der Freigabe. Sie läuft unabhängig von der UI und
 * wird vor jedem Ausführungsauftrag erneut ausgewertet – auch bei manipulierten
 * Anfragen. Diese Funktion führt selbst nichts aus.
 */
export const orbDevValidateSandboxExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fixId: string }) => {
    const fixId = String(input?.fixId ?? "");
    if (!/^ORB-FIX-\d{4}$/.test(fixId)) throw new Error("Ungültige Fix-ID");
    return { fixId };
  })
  .handler(async ({ context, data }): Promise<SandboxGateView> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const repo = await import("@/orb-dev/repo.server");
    const { checkSandboxExecutionRequest } = await import("@/orb-dev/sandbox-policy");
    const { patchPaths } = await import("@/orb-dev/diff-integrity");
    const { PHASE3_LIVE_CODE_WRITE_ENABLED, PHASE3_DEPLOYMENT_ENABLED } =
      await import("@/orb-dev/fix-model");

    const base = {
      fixId: data.fixId,
      liveCodeWriteEnabled: PHASE3_LIVE_CODE_WRITE_ENABLED,
      deploymentEnabled: PHASE3_DEPLOYMENT_ENABLED,
    };
    const proposal = await repo.getProposal(context.supabase, data.fixId);
    if (!proposal)
      return {
        ...base,
        ready: false,
        reason: "Fix-ID unbekannt",
        state: "APPROVAL_INVALID",
        version: null,
        fingerprint: null,
        patchFiles: [],
        commands: [],
      };
    const approval = await repo.getActiveApproval(context.supabase, data.fixId);
    const paths = patchPaths(proposal.diff);
    const gate = checkSandboxExecutionRequest({
      proposal,
      approval,
      diffToExecute: proposal.diff,
      patchPaths: paths,
    });
    return {
      ...base,
      ready: gate.allowed,
      reason: gate.allowed ? null : gate.reason,
      state: gate.allowed ? "EXECUTION_QUEUED" : gate.state,
      version: proposal.version,
      fingerprint: proposal.fingerprint,
      patchFiles: paths,
      commands: gate.allowed ? gate.commands : [],
    };
  });

/**
 * Ausführungsauftrag für die isolierte Sandbox. Der laufende Serverprozess
 * führt selbst keinen Code aus und verändert keine Datei: er prüft die Freigabe
 * erneut und protokolliert den Auftrag append-only. Die Ausführung erfolgt
 * ausschliesslich im getrennten Sandbox-Runner (scripts/orb-repair-sandbox.ts).
 */
export const orbDevQueueSandboxExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fixId: string; fingerprint: string }) => {
    const fixId = String(input?.fixId ?? "");
    if (!/^ORB-FIX-\d{4}$/.test(fixId)) throw new Error("Ungültige Fix-ID");
    const fingerprint = String(input?.fingerprint ?? "");
    if (!/^[0-9a-f]{16}$/.test(fingerprint)) throw new Error("Ungültiger Fix-Fingerabdruck");
    return { fixId, fingerprint };
  })
  .handler(
    async ({
      context,
      data,
    }): Promise<{ queued: boolean; reason?: string; state: string; runner?: string }> => {
      const { assertAdmin } = await import("@/lib/admin.server");
      const adminId = await assertAdmin(context);
      const repo = await import("@/orb-dev/repo.server");
      const { checkSandboxExecutionRequest } = await import("@/orb-dev/sandbox-policy");
      const { patchPaths } = await import("@/orb-dev/diff-integrity");

      const proposal = await repo.getProposal(context.supabase, data.fixId);
      const approval = proposal ? await repo.getActiveApproval(context.supabase, data.fixId) : null;
      const gate = proposal
        ? checkSandboxExecutionRequest({
            proposal,
            approval,
            diffToExecute: proposal.diff,
            patchPaths: patchPaths(proposal.diff),
          })
        : ({ allowed: false, state: "APPROVAL_INVALID", reason: "Fix-ID unbekannt" } as const);

      // Der angezeigte Fingerabdruck muss dem gespeicherten exakt entsprechen.
      const stale = proposal !== null && proposal.fingerprint !== data.fingerprint;
      const blocked: { state: FixState; reason: string } | null = stale
        ? {
            state: "APPROVAL_INVALID",
            reason: "Angezeigter Fix ist veraltet – Freigabe gilt nicht für diesen Inhalt.",
          }
        : gate.allowed
          ? null
          : { state: gate.state, reason: gate.reason };

      if (blocked || !gate.allowed) {
        const fail = blocked ?? { state: "APPROVAL_INVALID" as FixState, reason: "Blockiert" };
        await repo.recordSandboxEvent(context.supabase, adminId, {
          action: "SANDBOX_EXECUTION_BLOCKED",
          fixId: proposal ? proposal.fixId : null,
          previousState: proposal ? proposal.state : null,
          newState: fail.state,
          files: [],
          result: fail.reason,
        });
        return { queued: false, reason: fail.reason, state: fail.state };
      }

      await repo.recordSandboxEvent(context.supabase, adminId, {
        action: "SANDBOX_EXECUTION_QUEUED",
        fixId: proposal!.fixId,
        previousState: proposal!.state,
        newState: "EXECUTION_QUEUED",
        files: proposal!.files,
        result: "Freigabe serverseitig bestätigt – Ausführung erfolgt isoliert im Sandbox-Runner",
        metadata: {
          fingerprint: proposal!.fingerprint,
          version: proposal!.version,
          commands: gate.commands,
          liveCodeWrite: false,
          deployment: false,
        },
      });
      return {
        queued: true,
        state: "EXECUTION_QUEUED",
        runner: `bun run scripts/orb-repair-sandbox.ts ${proposal!.fixId}`,
      };
    },
  );

export const orbDevSandboxEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditEntry[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { listSandboxEvents } = await import("@/orb-dev/repo.server");
    const rows = await listSandboxEvents(context.supabase);
    // Metadaten werden als Text übertragen; sie enthalten keine Secrets.
    return rows.map((row) => ({
      at: row.at,
      adminId: row.actor,
      action: row.action,
      fixId: row.fixId,
      previousState: row.previousState,
      newState: row.newState,
      files: [],
      result: row.result,
    }));
  });

/* ---------------------------------------------------------------- Audit Log */

export const orbDevAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditEntry[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { auditLog } = await import("@/orb-dev/repo.server");
    return auditLog(context.supabase);
  });

/* ------------------------------------------------- Phase 4: Controlled Rollout */

export type DeploymentPlanView = {
  fixId: string;
  target: string;
  ready: boolean;
  state: string;
  reason: string | null;
  fixVersion: number | null;
  proposalFingerprint: string | null;
  fixApprovalValid: boolean;
  sandbox: {
    executionId: string;
    state: string;
    patchApplied: boolean;
    integrityOk: boolean;
    reproductionConfirmed: boolean;
    baseCommit: string;
    steps: { command: string; exitCode: number | null }[];
  } | null;
  finalDiffFingerprint: string | null;
  deploymentFingerprint: string | null;
  scope: {
    files: string[];
    services: string[];
    databaseAreas: string[];
    migrations: string[];
    configuration: string[];
    expectedEffects: string[];
  } | null;
  rollbackTarget: string | null;
  requiredChecks: { check: string; ok: boolean; detail: string }[];
  preflight: { name: string; ok: boolean; detail: string }[];
  confirmationPhrase: string;
  deploymentApproved: boolean;
  approvalReason: string | null;
  autonomousDeploymentEnabled: boolean;
  productionRolloutByOrbEnabled: boolean;
};

/**
 * Rollout-Plan: zeigt vollständig und ohne versteckte Anteile, was deployt
 * würde. Diese Funktion verändert nichts und führt nichts aus.
 */
export const orbDevRolloutPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fixId: string; target: string; rollbackTarget?: string }) => {
    const fixId = String(input?.fixId ?? "");
    if (!/^ORB-FIX-\d{4}$/.test(fixId)) throw new Error("Ungültige Fix-ID");
    const target = String(input?.target ?? "");
    if (target !== "STAGING" && target !== "PRODUCTION")
      throw new Error("Ziel muss ausdrücklich STAGING oder PRODUCTION sein");
    const rollbackTarget = input?.rollbackTarget ? String(input.rollbackTarget).slice(0, 64) : "";
    return { fixId, target, rollbackTarget };
  })
  .handler(async ({ context, data }): Promise<DeploymentPlanView> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const repo = await import("@/orb-dev/repo.server");
    const { checkApproval } = await import("@/orb-dev/fix-model");
    const policy = await import("@/orb-dev/rollout-policy");

    const target = data.target as import("@/orb-dev/rollout-policy").DeployTarget;
    const base: DeploymentPlanView = {
      fixId: data.fixId,
      target,
      ready: false,
      state: "DEPLOYMENT_BLOCKED",
      reason: null,
      fixVersion: null,
      proposalFingerprint: null,
      fixApprovalValid: false,
      sandbox: null,
      finalDiffFingerprint: null,
      deploymentFingerprint: null,
      scope: null,
      rollbackTarget: data.rollbackTarget.length > 0 ? data.rollbackTarget : null,
      requiredChecks: [],
      preflight: [],
      confirmationPhrase: policy.confirmationPhraseFor(target),
      deploymentApproved: false,
      approvalReason: null,
      autonomousDeploymentEnabled: policy.PHASE4_AUTOMATIC_DEPLOYMENT_ENABLED,
      productionRolloutByOrbEnabled: policy.PHASE4_PRODUCTION_ROLLOUT_EXECUTION_BY_ORB_ENABLED,
    };

    const proposal = await repo.getProposal(context.supabase, data.fixId);
    if (!proposal) return { ...base, reason: "Fix-ID unbekannt" };

    const fixApproval = await repo.getActiveApproval(context.supabase, data.fixId);
    const fixApprovalValid = checkApproval(proposal, fixApproval).valid;
    const evidence = await repo.getSandboxEvidence(context.supabase, data.fixId);
    const deploymentApproval = await repo.getActiveDeploymentApproval(
      context.supabase,
      data.fixId,
      target,
    );

    const scope = policy.scopeFromOperations({
      files: proposal.files,
      operations: proposal.operations,
      expectedEffects: proposal.expectedEffects,
    });
    const rollbackTarget =
      base.rollbackTarget ?? deploymentApproval?.rollbackTarget ?? evidence?.baseCommit ?? null;
    const binding =
      evidence !== null && rollbackTarget !== null
        ? {
            fixId: proposal.fixId,
            fixVersion: proposal.version,
            proposalFingerprint: proposal.fingerprint,
            finalDiffFingerprint: policy.diffFingerprint(evidence.finalDiff),
            sandboxExecutionId: evidence.executionId,
            sandboxResult: evidence.state,
            baseCommit: evidence.baseCommit,
            target,
            scope,
            migrationsApproved: deploymentApproval?.migrationsApproved ?? false,
            rollbackTarget,
          }
        : null;

    const preflight = policy.runPreflight({
      fixId: proposal.fixId,
      fixVersion: proposal.version,
      proposalFingerprint: proposal.fingerprint,
      proposalState: proposal.state,
      fixApprovalValid,
      evidence,
      extraSteps: [],
      deploymentApproval,
      current: binding,
      requestedTarget: target,
      targetExplicitlyConfirmed: true,
      currentProductionCommit: evidence?.baseCommit ?? null,
      rollbackTarget,
      healthChecksAvailable: true,
    });
    const approvalVerdict =
      binding === null
        ? { valid: false as const, reason: "Kein vollständiger Sandbox-Nachweis vorhanden." }
        : policy.checkDeploymentApproval({
            approval: deploymentApproval,
            current: binding,
            requestedTarget: target,
          });

    return {
      ...base,
      ready: preflight.ok,
      state: preflight.ok ? "READY_FOR_DEPLOYMENT" : preflight.state,
      reason: preflight.blockedReason,
      fixVersion: proposal.version,
      proposalFingerprint: proposal.fingerprint,
      fixApprovalValid,
      sandbox: evidence
        ? {
            executionId: evidence.executionId,
            state: evidence.state,
            patchApplied: evidence.patchApplied,
            integrityOk: evidence.integrityOk,
            reproductionConfirmed: evidence.reproductionConfirmed,
            baseCommit: evidence.baseCommit,
            steps: evidence.steps,
          }
        : null,
      finalDiffFingerprint: binding?.finalDiffFingerprint ?? null,
      deploymentFingerprint: binding ? policy.deploymentFingerprint(binding) : null,
      scope,
      rollbackTarget,
      requiredChecks: policy.evaluateRequiredChecks(evidence?.steps ?? []),
      preflight: preflight.checks,
      deploymentApproved: approvalVerdict.valid,
      approvalReason: approvalVerdict.valid ? null : approvalVerdict.reason,
    };
  });

/**
 * Hinterlegt das tatsächliche Ergebnis einer Phase-3-Sandbox-Ausführung
 * (Runner-Bericht) append-only. Nur damit existieren überhaupt Nachweise für
 * einen Rollout – ein behaupteter Status genügt nie.
 */
export const orbDevRecordSandboxResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { report: string }) => {
    const report = String(input?.report ?? "");
    if (report.length < 20 || report.length > 400_000) throw new Error("Bericht unplausibel");
    return { report };
  })
  .handler(async ({ context, data }): Promise<{ stored: boolean; reason?: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const repo = await import("@/orb-dev/repo.server");
    const { redact } = await import("@/orb-dev/sandbox.server");

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(redact(data.report)) as Record<string, unknown>;
    } catch {
      return { stored: false, reason: "Bericht ist kein gültiges JSON" };
    }
    const fixId = String(parsed["fixId"] ?? "");
    if (!/^ORB-FIX-\d{4}$/.test(fixId)) return { stored: false, reason: "Fix-ID im Bericht fehlt" };
    const proposal = await repo.getProposal(context.supabase, fixId);
    if (!proposal) return { stored: false, reason: "Fix-ID unbekannt" };

    const integrity = (parsed["integrity"] ?? {}) as Record<string, unknown>;
    const reproduction = (parsed["reproduction"] ?? {}) as Record<string, unknown>;
    const steps = Array.isArray(parsed["steps"])
      ? (parsed["steps"] as { command?: unknown; exitCode?: unknown }[]).map((s) => ({
          command: String(s?.command ?? ""),
          exitCode: typeof s?.exitCode === "number" ? s.exitCode : null,
        }))
      : [];
    await repo.recordSandboxResult(context.supabase, adminId, {
      executionId: String(parsed["executionId"] ?? ""),
      fixId,
      fixVersion: proposal.version,
      fingerprint: String(parsed["fingerprint"] ?? ""),
      baseCommit: String(parsed["baseCommit"] ?? ""),
      state: String(parsed["state"] ?? ""),
      patchApplied: integrity["ok"] === true || parsed["patchApplied"] === true,
      integrityOk: integrity["ok"] === true,
      reproductionConfirmed: reproduction["failureConfirmed"] === true,
      steps,
      finalDiff: String(parsed["finalDiff"] ?? proposal.diff),
    });
    return { stored: true };
  });

/**
 * Separate Deployment-Freigabe. Die Fix-Freigabe aus Phase 2 genügt nicht. Die
 * Freigabe wird an den exakt getesteten Stand gebunden; weicht irgendetwas ab,
 * entsteht sie nicht.
 */
export const orbDevRequestDeploymentApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      fixId: string;
      target: string;
      deploymentFingerprint: string;
      rollbackTarget: string;
      migrationsApproved?: boolean;
      confirmation: string;
      comment?: string;
    }) => {
      const fixId = String(input?.fixId ?? "");
      if (!/^ORB-FIX-\d{4}$/.test(fixId)) throw new Error("Ungültige Fix-ID");
      const target = String(input?.target ?? "");
      if (target !== "STAGING" && target !== "PRODUCTION")
        throw new Error("Ziel muss ausdrücklich STAGING oder PRODUCTION sein");
      const deploymentFingerprint = String(input?.deploymentFingerprint ?? "");
      if (!/^[0-9a-f]{16}$/.test(deploymentFingerprint))
        throw new Error("Ungültiger Deployment-Fingerabdruck");
      const rollbackTarget = String(input?.rollbackTarget ?? "");
      if (!/^[0-9a-f]{7,40}$/.test(rollbackTarget)) throw new Error("Rollback-Ziel fehlt");
      return {
        fixId,
        target,
        deploymentFingerprint,
        rollbackTarget,
        migrationsApproved: input?.migrationsApproved === true,
        confirmation: String(input?.confirmation ?? "").slice(0, 200),
        comment: input?.comment ? String(input.comment).slice(0, 500) : undefined,
      };
    },
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ ok: boolean; reason?: string; deploymentFingerprint?: string }> => {
      const { assertAdmin } = await import("@/lib/admin.server");
      const adminId = await assertAdmin(context);
      const repo = await import("@/orb-dev/repo.server");
      const { checkApproval } = await import("@/orb-dev/fix-model");
      const policy = await import("@/orb-dev/rollout-policy");
      const target = data.target as import("@/orb-dev/rollout-policy").DeployTarget;

      const reject = async (reason: string) => {
        await repo.recordDeploymentEvent(context.supabase, adminId, {
          action: "DEPLOYMENT_APPROVAL_REJECTED",
          fixId: /^ORB-FIX-\d{4}$/.test(data.fixId) ? data.fixId : null,
          previousState: null,
          newState: null,
          files: [],
          result: reason,
          metadata: { target },
        });
        return { ok: false, reason };
      };

      if (data.confirmation !== policy.confirmationPhraseFor(target))
        return reject("Doppelbestätigung fehlt oder ist nicht wörtlich.");

      const proposal = await repo.getProposal(context.supabase, data.fixId);
      if (!proposal) return reject("Fix-ID unbekannt");
      const fixApproval = await repo.getActiveApproval(context.supabase, data.fixId);
      if (!checkApproval(proposal, fixApproval).valid)
        return reject("Fix-Freigabe fehlt oder ist entwertet.");
      const evidence = await repo.getSandboxEvidence(context.supabase, data.fixId);
      const verdict = policy.verifySandboxEvidence(evidence);
      if (!verdict.ok) return reject(verdict.reason);

      const scope = policy.scopeFromOperations({
        files: proposal.files,
        operations: proposal.operations,
        expectedEffects: proposal.expectedEffects,
      });
      const migration = policy.checkMigrationScope(scope, data.migrationsApproved);
      if (!migration.ok) return reject(migration.reason);

      const binding = {
        fixId: proposal.fixId,
        fixVersion: proposal.version,
        proposalFingerprint: proposal.fingerprint,
        finalDiffFingerprint: policy.diffFingerprint(evidence!.finalDiff),
        sandboxExecutionId: evidence!.executionId,
        sandboxResult: evidence!.state,
        baseCommit: evidence!.baseCommit,
        target,
        scope,
        migrationsApproved: data.migrationsApproved,
        rollbackTarget: data.rollbackTarget,
      };
      const expected = policy.deploymentFingerprint(binding);
      if (expected !== data.deploymentFingerprint)
        return reject("Angezeigter Stand ist veraltet – Deployment-Fingerabdruck weicht ab.");

      const inserted = await repo.insertDeploymentApproval(context.supabase, adminId, {
        ...binding,
        deploymentFingerprint: expected,
        confirmation: data.confirmation,
        comment: data.comment,
      });
      if (!inserted.ok) return reject(inserted.reason);

      await repo.recordDeploymentEvent(context.supabase, adminId, {
        action: "DEPLOYMENT_APPROVAL_GRANTED",
        fixId: proposal.fixId,
        previousState: proposal.state,
        newState: "APPROVED",
        files: proposal.files,
        result: `Deployment-Freigabe für ${target} erteilt`,
        metadata: {
          target,
          deploymentFingerprint: expected,
          sandboxExecutionId: binding.sandboxExecutionId,
          baseCommit: binding.baseCommit,
          rollbackTarget: binding.rollbackTarget,
          migrationsApproved: binding.migrationsApproved,
        },
      });
      return { ok: true, deploymentFingerprint: expected };
    },
  );

/**
 * Auftrag für den kontrollierten Rollout. Der laufende Serverprozess deployt
 * nichts und verändert keine Datei: er prüft die Deployment-Freigabe erneut
 * serverseitig und protokolliert append-only. Der Rollout selbst läuft im
 * getrennten Runner (scripts/orb-rollout.ts); die Veröffentlichung nach
 * Production bleibt eine ausdrückliche Handlung eines Menschen.
 */
export const orbDevQueueDeployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      fixId: string;
      target: string;
      deploymentFingerprint: string;
      confirmation: string;
    }) => {
      const fixId = String(input?.fixId ?? "");
      if (!/^ORB-FIX-\d{4}$/.test(fixId)) throw new Error("Ungültige Fix-ID");
      const target = String(input?.target ?? "");
      if (target !== "STAGING" && target !== "PRODUCTION")
        throw new Error("Ziel muss ausdrücklich STAGING oder PRODUCTION sein");
      const deploymentFingerprint = String(input?.deploymentFingerprint ?? "");
      if (!/^[0-9a-f]{16}$/.test(deploymentFingerprint))
        throw new Error("Ungültiger Deployment-Fingerabdruck");
      return {
        fixId,
        target,
        deploymentFingerprint,
        confirmation: String(input?.confirmation ?? "").slice(0, 200),
      };
    },
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ queued: boolean; state: string; reason?: string; runner?: string }> => {
      const { assertAdmin } = await import("@/lib/admin.server");
      const adminId = await assertAdmin(context);
      const repo = await import("@/orb-dev/repo.server");
      const { checkApproval } = await import("@/orb-dev/fix-model");
      const policy = await import("@/orb-dev/rollout-policy");
      const target = data.target as import("@/orb-dev/rollout-policy").DeployTarget;

      const block = async (state: string, reason: string) => {
        await repo.recordDeploymentEvent(context.supabase, adminId, {
          action: "DEPLOYMENT_BLOCKED",
          fixId: /^ORB-FIX-\d{4}$/.test(data.fixId) ? data.fixId : null,
          previousState: null,
          newState: null,
          files: [],
          result: reason,
          metadata: { target, state },
        });
        return { queued: false, state, reason };
      };

      if (data.confirmation !== policy.confirmationPhraseFor(target))
        return block("DEPLOYMENT_BLOCKED", "Doppelbestätigung fehlt oder ist nicht wörtlich.");

      const proposal = await repo.getProposal(context.supabase, data.fixId);
      if (!proposal) return block("DEPLOYMENT_BLOCKED", "Fix-ID unbekannt");
      const fixApproval = await repo.getActiveApproval(context.supabase, data.fixId);
      const fixApprovalValid = checkApproval(proposal, fixApproval).valid;
      const evidence = await repo.getSandboxEvidence(context.supabase, data.fixId);
      const deploymentApproval = await repo.getActiveDeploymentApproval(
        context.supabase,
        data.fixId,
        target,
      );
      const scope = policy.scopeFromOperations({
        files: proposal.files,
        operations: proposal.operations,
        expectedEffects: proposal.expectedEffects,
      });
      const binding =
        evidence && deploymentApproval
          ? {
              fixId: proposal.fixId,
              fixVersion: proposal.version,
              proposalFingerprint: proposal.fingerprint,
              finalDiffFingerprint: policy.diffFingerprint(evidence.finalDiff),
              sandboxExecutionId: evidence.executionId,
              sandboxResult: evidence.state,
              baseCommit: evidence.baseCommit,
              target,
              scope,
              migrationsApproved: deploymentApproval.migrationsApproved,
              rollbackTarget: deploymentApproval.rollbackTarget,
            }
          : null;

      const preflight = policy.runPreflight({
        fixId: proposal.fixId,
        fixVersion: proposal.version,
        proposalFingerprint: proposal.fingerprint,
        proposalState: proposal.state,
        fixApprovalValid,
        evidence,
        extraSteps: [],
        deploymentApproval,
        current: binding,
        requestedTarget: target,
        targetExplicitlyConfirmed: true,
        currentProductionCommit: evidence?.baseCommit ?? null,
        rollbackTarget: deploymentApproval?.rollbackTarget ?? null,
        healthChecksAvailable: true,
        confirmation: data.confirmation,
      });
      if (!preflight.ok)
        return block(preflight.state, preflight.blockedReason ?? "Pre-flight fehlgeschlagen");
      if (deploymentApproval!.deploymentFingerprint !== data.deploymentFingerprint)
        return block(
          "DEPLOYMENT_APPROVAL_INVALID",
          "Angezeigter Stand ist veraltet – Deployment-Fingerabdruck weicht ab.",
        );

      await repo.recordDeploymentEvent(context.supabase, adminId, {
        action: "DEPLOYMENT_QUEUED",
        fixId: proposal.fixId,
        previousState: proposal.state,
        newState: null,
        files: proposal.files,
        result:
          target === "PRODUCTION"
            ? "Alle Voraussetzungen erfüllt – Veröffentlichung nach Production erfolgt ausschliesslich durch einen autorisierten Menschen"
            : "Kontrollierter Rollout in das Verifikationsziel freigegeben",
        metadata: {
          target,
          deploymentFingerprint: deploymentApproval!.deploymentFingerprint,
          sandboxExecutionId: deploymentApproval!.sandboxExecutionId,
          baseCommit: deploymentApproval!.baseCommit,
          rollbackTarget: deploymentApproval!.rollbackTarget,
          orbDeploysItself: false,
          automaticDeployment: false,
        },
      });
      return {
        queued: true,
        state: target === "PRODUCTION" ? "READY_FOR_DEPLOYMENT" : "DEPLOYMENT_APPROVED",
        runner: `bun run scripts/orb-rollout.ts ${proposal.fixId} ${target} <approval.json>`,
      };
    },
  );

export const orbDevDeploymentEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditEntry[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { listDeploymentEvents } = await import("@/orb-dev/repo.server");
    const rows = await listDeploymentEvents(context.supabase);
    return rows.map((row) => ({
      at: row.at,
      adminId: row.actor,
      action: row.action,
      fixId: row.fixId,
      previousState: row.previousState,
      newState: row.newState,
      files: [],
      result: row.result,
    }));
  });

export type { AuditEntry, Diagnosis } from "@/orb-dev/types";
export type { FixApproval, FixProposal } from "@/orb-dev/fix-model";
