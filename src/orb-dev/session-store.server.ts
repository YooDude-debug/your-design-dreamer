/**
 * ORB Developer Environment – flüchtiger Speicher (Phase 1).
 *
 * Bewusst KEINE Datenbank, KEINE Migration, KEIN Schema: Fix-Vorschläge,
 * Freigaben und Audit-Einträge leben nur im laufenden Serverprozess und gehen
 * bei Neustart verloren. Die Sicherheitslogik ist davon unberührt – ein
 * verlorener Eintrag bedeutet „keine Freigabe“, niemals „freigegeben“.
 *
 * Phase 2 ersetzt diesen Speicher durch persistente Tabellen mit RLS.
 */

import {
  canTransition,
  checkApproval,
  fixFingerprint,
  formatFixId,
  isApprovalSourceAllowed,
  type FixApproval,
  type FixOperation,
  type FixProposal,
  type FixState,
} from "@/orb-dev/fix-model";

import type { AuditEntry } from "@/orb-dev/types";

type Store = {
  sequence: number;
  proposals: Map<string, FixProposal>;
  approvals: Map<string, FixApproval>;
  audit: AuditEntry[];
};

const AUDIT_LIMIT = 200;

const globalKey = "__orbDevStore" as const;
const globalScope = globalThis as unknown as Record<string, Store | undefined>;

function store(): Store {
  const existing = globalScope[globalKey];
  if (existing) return existing;
  const fresh: Store = { sequence: 0, proposals: new Map(), approvals: new Map(), audit: [] };
  globalScope[globalKey] = fresh;
  return fresh;
}

/** Audit: nachvollziehbar, ohne Secrets. Phase 1 zusätzlich nur im Server-Log. */
export function audit(entry: Omit<AuditEntry, "at">): AuditEntry {
  const full: AuditEntry = { at: new Date().toISOString(), ...entry };
  const s = store();
  s.audit.unshift(full);
  if (s.audit.length > AUDIT_LIMIT) s.audit.length = AUDIT_LIMIT;
  console.info("[orb-dev][audit]", JSON.stringify(full));
  return full;
}

export function auditLog(): AuditEntry[] {
  return [...store().audit];
}

export function nextFixId(): string {
  const s = store();
  s.sequence += 1;
  return formatFixId(s.sequence);
}

export function putProposal(proposal: FixProposal): FixProposal {
  store().proposals.set(proposal.fixId, proposal);
  return proposal;
}

export function getProposal(fixId: string): FixProposal | null {
  return store().proposals.get(fixId) ?? null;
}

export function listProposals(): FixProposal[] {
  return [...store().proposals.values()].sort((a, b) => a.fixId.localeCompare(b.fixId));
}

export function getApproval(fixId: string): FixApproval | null {
  return store().approvals.get(fixId) ?? null;
}

export function listApprovals(): FixApproval[] {
  return [...store().approvals.values()];
}

export function setProposalState(fixId: string, next: FixState): FixProposal {
  const p = getProposal(fixId);
  if (!p) throw new Error("Fix-ID unbekannt");
  if (!canTransition(p.state, next)) throw new Error(`Übergang ${p.state} → ${next} nicht erlaubt`);
  const updated = { ...p, state: next };
  putProposal(updated);
  return updated;
}

/**
 * Ausdrückliche Administrator-Freigabe. Gebunden an Fix-ID, Fingerabdruck des
 * konkreten Diffs und die genau erlaubten Operationen.
 */
export function approveFix(input: {
  fixId: string;
  fingerprint: string;
  adminId: string;
  source: string;
}): { ok: true; approval: FixApproval } | { ok: false; reason: string } {
  const proposal = getProposal(input.fixId);
  if (!proposal) return { ok: false, reason: "Fix-ID unbekannt" };
  if (!isApprovalSourceAllowed(input.source))
    return { ok: false, reason: `Freigabequelle nicht erlaubt: ${input.source}` };
  if (proposal.state !== "WAITING_FOR_ADMIN_APPROVAL")
    return { ok: false, reason: `Fix ist nicht freigabebereit (Status ${proposal.state})` };
  const current = fixFingerprint(proposal);
  if (input.fingerprint !== current)
    return { ok: false, reason: "Angezeigter Fix ist veraltet – bitte neu laden." };
  if (proposal.rootCauseLevel !== "ROOT_CAUSE_PROVEN")
    return { ok: false, reason: "Nur bewiesene Ursachen dürfen freigegeben werden." };

  const approval: FixApproval = {
    fixId: proposal.fixId,
    fingerprint: current,
    operations: proposal.operations,
    approvedBy: input.adminId,
    approvedAt: new Date().toISOString(),
    source: "admin_ui",
  };
  store().approvals.set(proposal.fixId, approval);
  const updated = setProposalState(proposal.fixId, "APPROVED");
  audit({
    adminId: input.adminId,
    action: "APPROVE_FIX",
    fixId: proposal.fixId,
    previousState: "WAITING_FOR_ADMIN_APPROVAL",
    newState: updated.state,
    files: proposal.files,
    result: "approved",
  });
  return { ok: true, approval };
}

/**
 * Ändert sich ein freigegebener Fix, verfällt die Freigabe sofort und es
 * entsteht ein neuer Vorschlag mit neuer Fix-ID.
 */
export function reviseProposal(
  fixId: string,
  changes: Partial<Pick<FixProposal, "diff" | "files" | "operations" | "testPlan">>,
  adminId: string,
): FixProposal {
  const previous = getProposal(fixId);
  if (!previous) throw new Error("Fix-ID unbekannt");
  store().approvals.delete(fixId);
  putProposal({ ...previous, state: "ROLLED_BACK" });
  const revised: FixProposal = {
    ...previous,
    ...changes,
    fixId: nextFixId(),
    createdAt: new Date().toISOString(),
    state: "WAITING_FOR_ADMIN_APPROVAL",
  };
  putProposal(revised);
  audit({
    adminId,
    action: "REVISE_FIX_INVALIDATES_APPROVAL",
    fixId: revised.fixId,
    previousState: previous.state,
    newState: revised.state,
    files: revised.files,
    result: `Freigabe für ${previous.fixId} verfallen`,
  });
  return revised;
}

/** Serverseitige Vollprüfung vor jeder gedachten Schreiboperation. */
export function authorizeOperation(
  fixId: string,
  operation: FixOperation,
): { allowed: false; reason: string } {
  const proposal = getProposal(fixId);
  if (!proposal) return { allowed: false, reason: "Fix-ID unbekannt" };
  const check = checkApproval(proposal, getApproval(fixId), operation);
  if (!check.valid) return { allowed: false, reason: check.reason };
  // Auch mit gültiger Freigabe: Phase 1 führt nichts aus.
  return {
    allowed: false,
    reason: "Freigabe gültig, Ausführung in Phase 1 deaktiviert (getrennte Umgebung fehlt noch).",
  };
}
