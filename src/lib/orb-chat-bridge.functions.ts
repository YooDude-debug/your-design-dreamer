/**
 * ORB Chat → Developer Repair Bridge – serverseitige Schnittstelle.
 *
 * Jede Funktion erzwingt serverseitig:
 *  · angemeldeter Nutzer (requireSupabaseAuth),
 *  · Administratorrolle (bestehende `has_role`-Prüfung über assertAdmin),
 *  · gültiger Chat-Aktionstyp,
 *  · erlaubter Diagnostic Scope,
 *  · ausdrückliche technische Anweisung im aktuellen Nachrichtentext.
 *
 * Die UI ist nur Anzeige. Ein manipulierter Client-Request wird hier abgelehnt,
 * auch wenn er behauptet, eine Anweisung oder eine Berechtigung zu besitzen.
 * Memory, Graph und LLM-Ausgabe erzeugen niemals eine Berechtigung.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DIAGNOSTIC_SCOPES,
  type BridgeConfidence,
  type DiagnosticRequestState,
  type DiagnosticScope,
} from "@/orb-dev/chat-bridge";

export type ChatBridgeView = {
  accepted: boolean;
  reply: string;
  requestId: string | null;
  status: DiagnosticRequestState | null;
  scope: DiagnosticScope | null;
  confidence: BridgeConfidence | null;
  rootCause: string | null;
  files: string[];
  evidence: string[];
  fixId: string | null;
  version: number | null;
  fingerprint: string | null;
  /** Immer false – aus dem Chat entsteht nie Ausführung, Freigabe oder Deployment. */
  codeChanged: false;
  approvalCreated: false;
  sandboxExecuted: false;
  deployed: false;
};

const denied = (reply: string, scope: DiagnosticScope | null = null): ChatBridgeView => ({
  accepted: false,
  reply,
  requestId: null,
  status: null,
  scope,
  confidence: null,
  rootCause: null,
  files: [],
  evidence: [],
  fixId: null,
  version: null,
  fingerprint: null,
  codeChanged: false,
  approvalCreated: false,
  sandboxExecuted: false,
  deployed: false,
});

/**
 * Eine ausdrückliche technische Anweisung aus dem Chat verarbeiten.
 *
 * Der Nachrichtentext wird serverseitig erneut auf eine ausdrückliche Anweisung
 * geprüft – ein Client kann die Prüfung nicht überspringen, und ein behaupteter
 * Scope aus dem Request wird gegen die serverseitige Erkennung abgeglichen.
 */
export const orbChatRequestDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        /** Fester, gültiger Chat-Aktionstyp – nichts anderes ist erlaubt. */
        action: z.literal("developer_diagnostic"),
        text: z.string().min(1).max(1000),
        conversationId: z.string().max(200).nullable().optional(),
        sourceMessageId: z.string().max(200).nullable().optional(),
        /** Optionaler Vorschlag des Clients – nie verbindlich. */
        scope: z.enum(DIAGNOSTIC_SCOPES).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<ChatBridgeView> => {
    const { isAdmin } = await import("@/lib/admin.server");
    const admin = await isAdmin(context);
    const { detectDeveloperDiagnosticIntent, bridgeChatResponse } =
      await import("@/orb-dev/chat-bridge");

    // Serverseitige Erkennung ist verbindlich – nicht der Client, nicht das LLM.
    const intent = detectDeveloperDiagnosticIntent(data.text);
    if (intent.kind === "none")
      return denied(bridgeChatResponse({ kind: "not_a_developer_instruction" }));
    if (intent.kind === "escalation_denied")
      return denied(
        bridgeChatResponse({ kind: "escalation_denied", reason: intent.reason }),
        intent.scope,
      );

    if (!admin)
      return denied(
        bridgeChatResponse({
          kind: "unauthorized",
          reason:
            "Die technische Entwicklungsumgebung ist ausschliesslich für Administratoren zugänglich.",
        }),
        intent.scope,
      );

    const { runChatDiagnostic } = await import("@/orb-dev/chat-bridge.server");
    const result = await runChatDiagnostic(
      context.supabase,
      { adminId: context.userId },
      {
        scope: intent.scope,
        instruction: intent.instruction,
        conversationId: data.conversationId ?? null,
        sourceMessageId: data.sourceMessageId ?? null,
      },
    );

    const created = result.outcome.kind === "proposal_created" ? result.outcome : null;
    return {
      accepted: true,
      reply: result.reply,
      requestId: result.request.requestId,
      status: result.request.status,
      scope: result.request.requestedScope,
      confidence: result.confidence,
      rootCause: result.rootCause,
      files: result.files,
      evidence: result.evidence,
      fixId: created?.fixId ?? null,
      version: created?.version ?? null,
      fingerprint: created?.fingerprint ?? null,
      codeChanged: false,
      approvalCreated: false,
      sandboxExecuted: false,
      deployed: false,
    };
  });

export type ChatBridgeEventView = {
  at: string;
  actor: string;
  action: string;
  fixId: string | null;
  result: string;
  requestId: string | null;
  scope: string | null;
  instruction: string | null;
  confidence: string | null;
  source: string | null;
};

/** Protokoll der Chat-Anfragen für den Admin-Bereich (nur lesend, admin-only). */
export const orbChatBridgeEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatBridgeEventView[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { listChatBridgeEvents } = await import("@/orb-dev/chat-bridge.server");
    const rows = await listChatBridgeEvents(context.supabase);
    const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
    return rows.map((row) => ({
      at: row.at,
      actor: row.actor,
      action: row.action,
      fixId: row.fixId,
      result: row.result,
      requestId: text(row.metadata["requestId"]),
      scope: text(row.metadata["scope"]),
      instruction: text(row.metadata["instruction"]),
      confidence: text(row.metadata["confidence"]),
      source: text(row.metadata["source"]),
    }));
  });

/**
 * Ausdrücklich gesperrte Brückenoperationen. Sie existieren, damit ein
 * manipulierter Client eine serverseitige Ablehnung erhält und diese im
 * Protokoll sichtbar wird – ausgeführt wird niemals etwas.
 */
export const orbChatBridgeRequestOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        operation: z.enum(["code_write", "approval", "sandbox_execution", "deployment"]),
        fixId: z.string().max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ allowed: false; reason: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { checkBridgeOperationAllowed } = await import("@/orb-dev/chat-bridge");
    const { audit } = await import("@/orb-dev/repo.server");
    const decision = checkBridgeOperationAllowed(data.operation);
    await audit(context.supabase, adminId, {
      action: "CHAT_BRIDGE_OPERATION_DENIED",
      fixId: data.fixId && /^ORB-FIX-\d{4}$/.test(data.fixId) ? data.fixId : null,
      previousState: null,
      newState: null,
      files: [],
      result: decision.reason,
      metadata: { operation: data.operation, source: "orb_chat" },
    });
    return decision;
  });
