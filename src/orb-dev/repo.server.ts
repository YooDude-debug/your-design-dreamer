/**
 * ORB Developer / Repair Environment – Phase 2: persistente Ablage.
 *
 * Alle Schreib- und Leseoperationen laufen über den RLS-gebundenen Client des
 * aufrufenden Administrators. Zusätzlich prüft jede Server-Funktion vorher die
 * Administratorrolle (assertAdmin). Die Datenbank ist damit zweite, harte
 * Sicherheitsgrenze – die UI ist nie die Grenze.
 *
 * Grundsätze:
 *  · Fix-Inhalte sind unveränderlich (DB-Trigger). Änderungen erzeugen eine
 *    neue Fix-ID/Version und entwerten die alte Freigabe.
 *  · Freigaben sind an Fix-ID + Fingerabdruck + Operationsmenge gebunden.
 *  · Audit-Einträge werden nur angehängt und enthalten keine Secrets.
 *  · Memory/Graph/LLM erzeugen niemals eine Freigabe: die Quelle ist fest
 *    „admin_ui“ (zusätzlich per CHECK-Constraint in der Datenbank).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
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

type Db = SupabaseClient<Database>;
type ProposalRow = Database["public"]["Tables"]["orb_dev_fix_proposals"]["Row"];
type ApprovalRow = Database["public"]["Tables"]["orb_dev_fix_approvals"]["Row"];
type AuditRow = Database["public"]["Tables"]["orb_dev_audit_log"]["Row"];

export type StoredProposal = FixProposal & {
  version: number;
  supersedesFixId: string | null;
  fingerprint: string;
  updatedAt: string;
};

/** Sicherheitsnetz: nie Schlüsselartiges im Audit-Log ablegen. */
const SECRET_RE =
  /(sb_secret_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{16,}|SERVICE_ROLE_KEY|(?:API[_-]?KEY|TOKEN|PASSWORD)\s*[:=]\s*\S+)/gi;

export function redactAuditText(value: string): string {
  return value.replace(SECRET_RE, "[REDACTED]");
}

/* ------------------------------------------------------------- Abbildungen */

function toProposal(row: ProposalRow): StoredProposal {
  return {
    fixId: row.fix_id,
    createdAt: row.created_at,
    createdBy: row.created_source === "admin" ? "admin" : "orb_diagnostic",
    rootCause: row.root_cause,
    rootCauseLevel: row.root_cause_confidence as StoredProposal["rootCauseLevel"],
    files: row.files,
    diff: row.diff,
    operations: row.operations as unknown as FixOperation[],
    testPlan: row.test_plan,
    expectedEffects: row.expected_effects,
    risks: row.risks,
    rollbackPlan: row.rollback_plan,
    state: row.status as FixState,
    version: row.version,
    supersedesFixId: row.supersedes_fix_id,
    fingerprint: row.fingerprint,
    updatedAt: row.updated_at,
  };
}

function toApproval(row: ApprovalRow): FixApproval {
  return {
    fixId: row.fix_id,
    fingerprint: row.fingerprint,
    operations: row.operations as unknown as FixOperation[],
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    source: "admin_ui",
  };
}

function toAudit(row: AuditRow): AuditEntry {
  return {
    at: row.at,
    adminId: row.actor,
    action: row.action,
    fixId: row.fix_id,
    previousState: row.previous_status as FixState | null,
    newState: row.new_status as FixState | null,
    files: row.files,
    result: row.result,
  };
}

/* ----------------------------------------------------------------- Audit */

export async function audit(
  db: Db,
  actor: string,
  entry: {
    action: string;
    fixId: string | null;
    previousState: FixState | null;
    newState: FixState | null;
    files: string[];
    result: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  const { error } = await db.from("orb_dev_audit_log").insert({
    actor,
    action: redactAuditText(entry.action),
    fix_id: entry.fixId,
    previous_status: entry.previousState,
    new_status: entry.newState,
    files: entry.files.map(redactAuditText),
    result: redactAuditText(entry.result),
    metadata: JSON.parse(redactAuditText(JSON.stringify(entry.metadata ?? {}))),
  });
  if (error) throw new Error(`Audit-Eintrag fehlgeschlagen: ${error.message}`);
}

export async function auditLog(db: Db, limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await db
    .from("orb_dev_audit_log")
    .select("*")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAudit);
}

/* ------------------------------------------------------------- Vorschläge */

export async function nextFixId(db: Db): Promise<string> {
  const { data, error } = await db
    .from("orb_dev_fix_proposals")
    .select("fix_id")
    .order("fix_id", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.fix_id;
  const sequence = last ? Number(last.slice("ORB-FIX-".length)) + 1 : 1;
  return formatFixId(sequence);
}

export async function listProposals(db: Db, limit = 50): Promise<StoredProposal[]> {
  const { data, error } = await db
    .from("orb_dev_fix_proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toProposal);
}

export async function getProposal(db: Db, fixId: string): Promise<StoredProposal | null> {
  const { data, error } = await db
    .from("orb_dev_fix_proposals")
    .select("*")
    .eq("fix_id", fixId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProposal(data) : null;
}

export async function insertProposal(
  db: Db,
  adminId: string,
  proposal: FixProposal,
  options: { version?: number; supersedesFixId?: string | null } = {},
): Promise<StoredProposal> {
  const { data, error } = await db
    .from("orb_dev_fix_proposals")
    .insert({
      fix_id: proposal.fixId,
      version: options.version ?? 1,
      supersedes_fix_id: options.supersedesFixId ?? null,
      status: proposal.state,
      root_cause: proposal.rootCause,
      root_cause_confidence: proposal.rootCauseLevel,
      files: proposal.files,
      diff: proposal.diff,
      operations: proposal.operations as unknown as Database["public"]["Tables"]["orb_dev_fix_proposals"]["Insert"]["operations"],
      test_plan: proposal.testPlan,
      expected_effects: proposal.expectedEffects,
      risks: proposal.risks,
      rollback_plan: proposal.rollbackPlan,
      fingerprint: fixFingerprint(proposal),
      created_source: proposal.createdBy,
      created_by: adminId,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toProposal(data);
}

export async function setProposalState(
  db: Db,
  fixId: string,
  next: FixState,
): Promise<StoredProposal> {
  const current = await getProposal(db, fixId);
  if (!current) throw new Error("Fix-ID unbekannt");
  if (!canTransition(current.state, next))
    throw new Error(`Übergang ${current.state} → ${next} nicht erlaubt`);
  const { data, error } = await db
    .from("orb_dev_fix_proposals")
    .update({ status: next })
    .eq("fix_id", fixId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toProposal(data);
}

/* --------------------------------------------------------------- Freigaben */

export async function getActiveApproval(db: Db, fixId: string): Promise<FixApproval | null> {
  const { data, error } = await db
    .from("orb_dev_fix_approvals")
    .select("*")
    .eq("fix_id", fixId)
    .eq("status", "APPROVED")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toApproval(data) : null;
}

export async function listApprovals(db: Db, limit = 100): Promise<ApprovalRow[]> {
  const { data, error } = await db
    .from("orb_dev_fix_approvals")
    .select("*")
    .order("approved_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Ausdrückliche Administrator-Freigabe. Die Quelle wird serverseitig fest auf
 * „admin_ui“ gesetzt; Memory, Graph oder LLM können sie nicht setzen.
 */
export async function approveFix(
  db: Db,
  input: { fixId: string; fingerprint: string; adminId: string; source: string; comment?: string },
): Promise<{ ok: true; approval: FixApproval } | { ok: false; reason: string }> {
  if (!isApprovalSourceAllowed(input.source))
    return { ok: false, reason: `Freigabequelle nicht erlaubt: ${input.source}` };
  const proposal = await getProposal(db, input.fixId);
  if (!proposal) return { ok: false, reason: "Fix-ID unbekannt" };
  if (proposal.state !== "WAITING_FOR_ADMIN_APPROVAL")
    return { ok: false, reason: `Fix ist nicht freigabebereit (Status ${proposal.state})` };
  const current = fixFingerprint(proposal);
  if (input.fingerprint !== current)
    return { ok: false, reason: "Angezeigter Fix ist veraltet – bitte neu laden." };
  if (proposal.rootCauseLevel !== "ROOT_CAUSE_PROVEN")
    return { ok: false, reason: "Nur bewiesene Ursachen dürfen freigegeben werden." };

  const { data, error } = await db
    .from("orb_dev_fix_approvals")
    .insert({
      fix_id: proposal.fixId,
      fingerprint: current,
      operations:
        proposal.operations as unknown as Database["public"]["Tables"]["orb_dev_fix_approvals"]["Insert"]["operations"],
      status: "APPROVED",
      approved_by: input.adminId,
      source: "admin_ui",
      comment: input.comment ? redactAuditText(input.comment.slice(0, 500)) : null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, reason: error.message };

  const updated = await setProposalState(db, proposal.fixId, "APPROVED");
  await audit(db, input.adminId, {
    action: "APPROVE_FIX",
    fixId: proposal.fixId,
    previousState: "WAITING_FOR_ADMIN_APPROVAL",
    newState: updated.state,
    files: proposal.files,
    result: "approved",
    metadata: { fingerprint: current, operations: proposal.operations.length },
  });
  return { ok: true, approval: toApproval(data) };
}

/**
 * Änderung eines Fix-Inhalts: die bestehende Freigabe wird entwertet, der alte
 * Vorschlag bleibt als Historie erhalten (Status INVALIDATED) und es entsteht
 * eine neue Fix-ID mit erhöhter Version.
 */
export async function reviseProposal(
  db: Db,
  fixId: string,
  changes: Partial<Pick<FixProposal, "diff" | "files" | "operations" | "testPlan">>,
  adminId: string,
): Promise<StoredProposal> {
  const previous = await getProposal(db, fixId);
  if (!previous) throw new Error("Fix-ID unbekannt");

  const { error: invalidateError } = await db
    .from("orb_dev_fix_approvals")
    .update({
      status: "INVALIDATED",
      invalidated_reason: `Fix-Inhalt geändert (Nachfolger von ${fixId})`,
    })
    .eq("fix_id", fixId)
    .eq("status", "APPROVED");
  if (invalidateError) throw new Error(invalidateError.message);

  await db.from("orb_dev_fix_proposals").update({ status: "INVALIDATED" }).eq("fix_id", fixId);

  const nextId = await nextFixId(db);
  const revised = await insertProposal(
    db,
    adminId,
    {
      ...previous,
      ...changes,
      fixId: nextId,
      createdAt: new Date().toISOString(),
      state: "WAITING_FOR_ADMIN_APPROVAL",
    },
    { version: previous.version + 1, supersedesFixId: previous.fixId },
  );

  await audit(db, adminId, {
    action: "REVISE_FIX_INVALIDATES_APPROVAL",
    fixId: revised.fixId,
    previousState: previous.state,
    newState: revised.state,
    files: revised.files,
    result: `Freigabe für ${previous.fixId} entwertet – neue Freigabe erforderlich`,
    metadata: { supersedes: previous.fixId, version: revised.version },
  });
  return revised;
}

/** Serverseitige Vollprüfung vor jeder gedachten Schreiboperation. */
export async function authorizeOperation(
  db: Db,
  fixId: string,
  operation: FixOperation,
): Promise<{ allowed: false; reason: string }> {
  const proposal = await getProposal(db, fixId);
  if (!proposal) return { allowed: false, reason: "Fix-ID unbekannt" };
  const check = checkApproval(proposal, await getActiveApproval(db, fixId), operation);
  if (!check.valid) return { allowed: false, reason: check.reason };
  return {
    allowed: false,
    reason:
      "Freigabe gültig, Ausführung bleibt deaktiviert (Phase 2 speichert nur; getrennte Arbeitsumgebung fehlt).",
  };
}
