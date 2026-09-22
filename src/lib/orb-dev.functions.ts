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
import type { FixApproval, FixProposal } from "@/orb-dev/fix-model";

export type OrbDevStatus = {
  adminId: string;
  phase: "PHASE_2_PERSISTENCE";
  writeOperationsEnabled: boolean;
  selfModificationEnabled: boolean;
  deploymentEnabled: boolean;
  persistence: "database_with_rls";
  allowedRoots: string[];
  proposals: number;
  approvals: number;
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
    } = await import("@/orb-dev/fix-model");
    const { ALLOWED_ROOTS } = await import("@/orb-dev/code-access.server");
    const repo = await import("@/orb-dev/repo.server");
    const [proposals, approvals] = await Promise.all([
      repo.listProposals(context.supabase),
      repo.listApprovals(context.supabase),
    ]);
    return {
      adminId,
      phase: "PHASE_2_PERSISTENCE",
      writeOperationsEnabled: PHASE2_EXECUTION_ENABLED,
      selfModificationEnabled: PHASE1_SELF_MODIFICATION_ENABLED,
      deploymentEnabled: PHASE1_DEPLOYMENT_ENABLED,
      persistence: "database_with_rls",
      allowedRoots: [...ALLOWED_ROOTS],
      proposals: proposals.length,
      approvals: approvals.filter((a) => a.status === "APPROVED").length,
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

/* ---------------------------------------------------------------- Audit Log */

export const orbDevAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditEntry[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { auditLog } = await import("@/orb-dev/repo.server");
    return auditLog(context.supabase);
  });

export type { AuditEntry, Diagnosis } from "@/orb-dev/types";
export type { FixApproval, FixProposal } from "@/orb-dev/fix-model";
