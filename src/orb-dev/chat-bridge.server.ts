/**
 * ORB Chat → Developer Repair Bridge – serverseitige Ausführung der Analyse.
 *
 * Die Brücke verwendet ausschliesslich die bereits vorhandenen, kontrollierten
 * READ-ONLY-Diagnosefunktionen (Phase 1) und die bestehende Persistenz der
 * Fix-Vorschläge (Phase 2). Es entsteht kein zweites Fix-System, keine zweite
 * Approval-Logik und keine neue Tabelle.
 *
 * Harte Grenzen dieser Datei:
 *  · sie verändert keinen Code und keine Datei,
 *  · sie erzeugt keine Freigabe,
 *  · sie startet keine Sandbox und kein Deployment,
 *  · sie schreibt ausschliesslich in die bestehenden Repair-Tabellen
 *    (Vorschlag + append-only Audit) über den RLS-gebundenen Admin-Client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import {
  bridgeChatResponse,
  confidenceOf,
  formatDiagnosticRequestId,
  isSupportedScope,
  mayCreateProposal,
  type BridgeConfidence,
  type BridgeOutcome,
  type DiagnosticRequest,
  type DiagnosticRequestState,
  type DiagnosticScope,
} from "@/orb-dev/chat-bridge";
import type { Diagnosis } from "@/orb-dev/types";

type Db = SupabaseClient<Database>;

export type ChatBridgeResult = {
  request: DiagnosticRequest;
  confidence: BridgeConfidence;
  rootCause: string;
  files: string[];
  evidence: string[];
  outcome: BridgeOutcome;
  reply: string;
  /** Immer false: die Brücke führt niemals etwas aus. */
  executed: false;
  codeChanged: false;
  approvalCreated: false;
  deployed: false;
};

/** Zufällige, nicht ratbare Kennung – ohne Rückschluss auf Nutzerdaten. */
function newRequestToken(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function evidenceFrom(diagnosis: Diagnosis): string[] {
  const r = diagnosis.reproduction;
  return [
    `Frage „${diagnosis.question}“ → Thema ${r.questionTopic ?? "—"}, Informationsbereich ${r.questionIntent ?? "—"}`,
    `Erinnerung „${diagnosis.memory}“ → Thema ${r.memoryTopic ?? "—"}`,
    `Überschneidung = max(${r.lexicalSimilarity.toFixed(3)}, ${r.topicAffinity.toFixed(3)}) = ${r.overlap.toFixed(3)}`,
    ...diagnosis.chain
      .filter((s) => s.outcome !== "PASS")
      .map((s) => `${s.stage}: ${s.outcome} – ${s.detail}`),
    ...diagnosis.codeTrace.slice(0, 4).map((t) => `${t.path}:${t.line}`),
  ];
}

/**
 * Führt eine angeforderte Analyse aus und legt – nur bei bestätigter Ursache –
 * einen persistenten Fix-Vorschlag über das bestehende Phase-2-System ab.
 *
 * Der Aufrufer hat zuvor serverseitig geprüft: angemeldeter Nutzer,
 * Administratorrolle, gültiger Aktionstyp und ausdrückliche Anweisung.
 */
export async function runChatDiagnostic(
  db: Db,
  actor: { adminId: string },
  input: {
    scope: DiagnosticScope;
    instruction: string;
    conversationId: string | null;
    sourceMessageId: string | null;
  },
): Promise<ChatBridgeResult> {
  const repo = await import("@/orb-dev/repo.server");
  const requestId = formatDiagnosticRequestId(newRequestToken());

  const request: DiagnosticRequest = {
    requestId,
    userId: actor.adminId,
    conversationId: input.conversationId,
    sourceMessageId: input.sourceMessageId,
    requestedScope: input.scope,
    userInstruction: input.instruction.slice(0, 500),
    createdAt: new Date().toISOString(),
    status: "REQUESTED",
  };

  const log = async (status: DiagnosticRequestState, result: string, extra = {}) => {
    request.status = status;
    await repo.audit(db, actor.adminId, {
      action: `CHAT_BRIDGE_${status}`,
      fixId: null,
      previousState: null,
      newState: null,
      files: [],
      result,
      metadata: {
        requestId,
        scope: request.requestedScope,
        instruction: request.userInstruction,
        conversationId: request.conversationId,
        sourceMessageId: request.sourceMessageId,
        source: "orb_chat",
        ...extra,
      },
    });
  };

  await log("REQUESTED", "ausdrückliche technische Anweisung aus dem Chat");

  if (!isSupportedScope(input.scope)) {
    await log("FAILED", `Bereich ${input.scope} hat keine reproduzierbare Analyse`);
    const outcome: BridgeOutcome = { kind: "unsupported_scope", scope: input.scope };
    return {
      request,
      confidence: "UNCONFIRMED",
      rootCause: "Kein reproduzierbarer Analysepfad für diesen Bereich.",
      files: [],
      evidence: [],
      outcome,
      reply: bridgeChatResponse(outcome),
      executed: false,
      codeChanged: false,
      approvalCreated: false,
      deployed: false,
    };
  }

  await log("ANALYZING", "READ-ONLY Analyse gestartet (kein Schreibzugriff auf Code)");

  const { diagnoseMemoryRecallCase, proposalFromDiagnosis } =
    await import("@/orb-dev/diagnose.server");
  const diagnosis = await diagnoseMemoryRecallCase();
  const confidence = confidenceOf(diagnosis.rootCauseLevel);
  const evidence = evidenceFrom(diagnosis);

  await log("DIAGNOSIS_READY", `Ursache ${confidence}`, { confidence });

  if (!mayCreateProposal(confidence)) {
    await log("FAILED", "keine bestätigte Ursache – kein ausführbarer Fix-Vorschlag");
    const outcome: BridgeOutcome = {
      kind: "no_confirmed_cause",
      confidence,
      rootCause: diagnosis.rootCause,
    };
    return {
      request,
      confidence,
      rootCause: diagnosis.rootCause,
      files: [],
      evidence,
      outcome,
      reply: bridgeChatResponse(outcome),
      executed: false,
      codeChanged: false,
      approvalCreated: false,
      deployed: false,
    };
  }

  const fixId = await repo.nextFixId(db);
  const candidate = proposalFromDiagnosis(diagnosis, fixId);
  if ("error" in candidate) {
    await log("FAILED", candidate.error);
    const outcome: BridgeOutcome = {
      kind: "no_confirmed_cause",
      confidence,
      rootCause: candidate.error,
    };
    return {
      request,
      confidence,
      rootCause: candidate.error,
      files: [],
      evidence,
      outcome,
      reply: bridgeChatResponse(outcome),
      executed: false,
      codeChanged: false,
      approvalCreated: false,
      deployed: false,
    };
  }

  // Quelle „orb_chat“ ist ausschliesslich dokumentarisch – sie begründet nie ein Recht.
  await repo.insertProposal(db, actor.adminId, { ...candidate, createdBy: "orb_chat" });
  const waiting = await repo.setProposalState(db, candidate.fixId, "WAITING_FOR_ADMIN_APPROVAL");

  await repo.audit(db, actor.adminId, {
    action: "CHAT_BRIDGE_FIX_PROPOSED",
    fixId: waiting.fixId,
    previousState: "FIX_PROPOSED",
    newState: waiting.state,
    files: waiting.files,
    result: "wartet auf Administrator-Freigabe (aus dem Chat angefordert)",
    metadata: {
      requestId,
      source: "orb_chat",
      instruction: request.userInstruction,
      conversationId: request.conversationId,
      sourceMessageId: request.sourceMessageId,
      confidence,
      fingerprint: waiting.fingerprint,
      version: waiting.version,
      approvalCreated: false,
      executed: false,
      deployed: false,
    },
  });
  request.status = "FIX_PROPOSED";

  const outcome: BridgeOutcome = {
    kind: "proposal_created",
    fixId: waiting.fixId,
    version: waiting.version,
    fingerprint: waiting.fingerprint,
  };
  return {
    request,
    confidence,
    rootCause: diagnosis.rootCause,
    files: waiting.files,
    evidence,
    outcome,
    reply: bridgeChatResponse(outcome),
    executed: false,
    codeChanged: false,
    approvalCreated: false,
    deployed: false,
  };
}

/** Bestehende Audit-Ablage der Brücke lesen (append-only, admin-only). */
export async function listChatBridgeEvents(
  db: Db,
  limit = 50,
): Promise<
  {
    at: string;
    actor: string;
    action: string;
    fixId: string | null;
    result: string;
    metadata: Record<string, unknown>;
  }[]
> {
  const { data, error } = await db
    .from("orb_dev_audit_log")
    .select("*")
    .like("action", "CHAT_BRIDGE_%")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    at: row.at,
    actor: row.actor,
    action: row.action,
    fixId: row.fix_id,
    result: row.result,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  }));
}
