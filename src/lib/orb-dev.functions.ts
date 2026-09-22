/**
 * ORB Developer / Repair Environment – serverseitige Schnittstelle.
 *
 * Jede Funktion erzwingt: authentifizierter Nutzer (requireSupabaseAuth) und
 * Administratorrolle (bestehende `has_role`-Prüfung über assertAdmin).
 * Die UI ist nur Anzeige – niemals die Sicherheitsgrenze.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AuditEntry } from "@/orb-dev/session-store.server";
import type { Diagnosis } from "@/orb-dev/diagnose.server";
import type { FixApproval, FixProposal } from "@/orb-dev/fix-model";

export type OrbDevStatus = {
  adminId: string;
  phase: "PHASE_1_ENVIRONMENT_ONLY";
  writeOperationsEnabled: boolean;
  selfModificationEnabled: boolean;
  deploymentEnabled: boolean;
  persistence: "in_memory_session_only";
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
      PHASE1_WRITE_OPERATIONS_ENABLED,
      PHASE1_SELF_MODIFICATION_ENABLED,
      PHASE1_DEPLOYMENT_ENABLED,
    } = await import("@/orb-dev/fix-model");
    const { ALLOWED_ROOTS } = await import("@/orb-dev/code-access.server");
    const { listProposals, listApprovals } = await import("@/orb-dev/session-store.server");
    return {
      adminId,
      phase: "PHASE_1_ENVIRONMENT_ONLY",
      writeOperationsEnabled: PHASE1_WRITE_OPERATIONS_ENABLED,
      selfModificationEnabled: PHASE1_SELF_MODIFICATION_ENABLED,
      deploymentEnabled: PHASE1_DEPLOYMENT_ENABLED,
      persistence: "in_memory_session_only",
      allowedRoots: [...ALLOWED_ROOTS],
      proposals: listProposals().length,
      approvals: listApprovals().length,
    };
  });

/* ------------------------------------------------------------- Code Access */

export type CodeQueryMode = "read" | "search" | "symbol" | "callers" | "dependencies" | "tests" | "schema";

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
      const { audit } = await import("@/orb-dev/session-store.server");
      audit({
        adminId,
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
    const { audit } = await import("@/orb-dev/session-store.server");
    const diagnosis = await diagnoseMemoryRecallCase(data.question, data.memory);
    audit({
      adminId,
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

export type ProposalView = FixProposal & { fingerprint: string; approved: boolean };

async function views(): Promise<ProposalView[]> {
  const { listProposals, getApproval } = await import("@/orb-dev/session-store.server");
  const { fixFingerprint, checkApproval } = await import("@/orb-dev/fix-model");
  return listProposals().map((p) => ({
    ...p,
    fingerprint: fixFingerprint(p),
    approved: checkApproval(p, getApproval(p.fixId)).valid,
  }));
}

export const orbDevListProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProposalView[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return views();
  });

export const orbDevCreateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ created: string | null; error?: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { diagnoseMemoryRecallCase, proposalFromDiagnosis } = await import(
      "@/orb-dev/diagnose.server"
    );
    const { nextFixId, putProposal, setProposalState, audit } = await import(
      "@/orb-dev/session-store.server"
    );
    const diagnosis = await diagnoseMemoryRecallCase();
    const candidate = proposalFromDiagnosis(diagnosis, nextFixId());
    if ("error" in candidate) return { created: null, error: candidate.error };
    putProposal(candidate);
    const waiting = setProposalState(candidate.fixId, "WAITING_FOR_ADMIN_APPROVAL");
    audit({
      adminId,
      action: "CREATE_FIX_PROPOSAL",
      fixId: waiting.fixId,
      previousState: "FIX_PROPOSED",
      newState: waiting.state,
      files: waiting.files,
      result: "wartet auf Administrator-Freigabe",
    });
    return { created: waiting.fixId };
  });

export const orbDevApproveFix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fixId: string; fingerprint: string }) => {
    const fixId = String(input?.fixId ?? "");
    if (!/^ORB-FIX-\d{4}$/.test(fixId)) throw new Error("Ungültige Fix-ID");
    const fingerprint = String(input?.fingerprint ?? "");
    if (!/^[0-9a-f]{16}$/.test(fingerprint)) throw new Error("Ungültiger Fix-Fingerabdruck");
    return { fixId, fingerprint };
  })
  .handler(async ({ context, data }): Promise<{ ok: boolean; reason?: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { approveFix, audit } = await import("@/orb-dev/session-store.server");
    // Quelle ist fest „admin_ui“ – kein Aufrufer kann eine andere Quelle setzen.
    const result = approveFix({ ...data, adminId, source: "admin_ui" });
    if (!result.ok) {
      audit({
        adminId,
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

/** Jede gedachte Repair-Operation – in Phase 1 immer abgelehnt. */
export const orbDevRequestExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fixId: string; path: string }) => ({
    fixId: String(input?.fixId ?? ""),
    path: String(input?.path ?? ""),
  }))
  .handler(async ({ context, data }): Promise<{ allowed: false; reason: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { authorizeOperation, audit } = await import("@/orb-dev/session-store.server");
    const decision = authorizeOperation(data.fixId, { kind: "edit_file", path: data.path });
    audit({
      adminId,
      action: "REQUEST_EXECUTION_DENIED",
      fixId: data.fixId,
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
    const { auditLog } = await import("@/orb-dev/session-store.server");
    return auditLog();
  });

export type { AuditEntry, Diagnosis, FixApproval, FixProposal };
