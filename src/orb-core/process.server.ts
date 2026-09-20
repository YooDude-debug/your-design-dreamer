/**
 * ORB Core – Prozesszustand lesen und bestätigte Entscheidungen festhalten.
 *
 * Es entsteht KEINE neue Tabelle: Prozessschritte liegen als bestehende
 * Wissensknoten im Spiderweb, der Status in deren vorhandenem Metadatenfeld.
 * Abhängigkeiten sind bestehende Verbindungen mit `metadata.relation`.
 *
 * Harte Grenzen:
 *   - Es wird nichts blockiert und keine äussere Handlung ausgeführt.
 *   - Ein Status ändert sich NUR nach ausdrücklicher Bestätigung des Nutzers
 *     auf einen tatsächlich offenen Hinweis – niemals aus reinem Text.
 *   - Wichtigkeit, Konfidenz, Verfall und die Schwelle 0.35 bleiben unberührt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import {
  looksLikeInjection,
  readProcessSteps,
  statusForDecision,
  type ProcessConnection,
  type ProcessDecision,
  type ProcessNode,
  type ProcessStep,
} from "@/orb-core/process";

type DB = SupabaseClient<Database>;
type Tick = <T>(p: PromiseLike<T>) => Promise<T>;

/** Obergrenze je Abfrage – kein vollständiger Graph, kein Polling. */
const PROCESS_LIMIT = 40;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Offener Hinweis aus der letzten ORB-Nachricht (bestehende Ablage). */
export type PendingGuardrail = { stepIds: string[]; at: number } | null;

export type ProcessContext = {
  steps: ProcessStep[];
  pending: PendingGuardrail;
  lastGuardrailAt: number | null;
  acknowledgedStepIds: string[];
};

/**
 * Lädt den bekannten Prozesszustand – zwei begrenzte Abfragen, nur wenn eine
 * Handlungsabsicht erkannt wurde (der Aufrufer entscheidet das).
 */
export async function loadProcessContext(
  db: DB,
  userId: string,
  tick: Tick,
): Promise<ProcessContext> {
  const nodeRes = await tick(
    db
      .from("orb_nodes")
      .select("id, content, topic, category, importance, confidence, metadata, updated_at")
      .eq("user_id", userId)
      .eq("category", "process_step")
      .order("updated_at", { ascending: false })
      .limit(PROCESS_LIMIT),
  );
  if (nodeRes.error) throw new Error(nodeRes.error.message);

  const nodes: ProcessNode[] = (nodeRes.data ?? []).map((row) => ({
    id: row.id,
    content: row.content,
    topic: row.topic,
    category: row.category,
    importance: row.importance,
    confidence: row.confidence,
    metadata: asRecord(row.metadata),
    updatedAt: new Date(row.updated_at).getTime(),
  }));

  let connections: ProcessConnection[] = [];
  if (nodes.length > 0) {
    const ids = nodes.map((n) => n.id);
    const connRes = await tick(
      db
        .from("orb_connections")
        .select("source_node_id, target_node_id, weight, metadata")
        .eq("user_id", userId)
        .in("source_node_id", ids)
        .limit(PROCESS_LIMIT * 3),
    );
    if (connRes.error) throw new Error(connRes.error.message);
    connections = (connRes.data ?? []).map((row) => ({
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      weight: row.weight,
      metadata: asRecord(row.metadata),
    }));
  }

  // Letzter Hinweis: liegt bereits in der bestehenden Gesprächsablage.
  const msgRes = await tick(
    db
      .from("orb_messages")
      .select("state_snapshot, created_at")
      .eq("user_id", userId)
      .eq("role", "orb")
      .order("created_at", { ascending: false })
      .limit(5),
  );
  if (msgRes.error) throw new Error(msgRes.error.message);

  let pending: PendingGuardrail = null;
  let lastGuardrailAt: number | null = null;
  for (const row of msgRes.data ?? []) {
    const snapshot = asRecord(row.state_snapshot);
    const guardrail = asRecord(snapshot?.["guardrail"]);
    if (!guardrail) continue;
    const at = new Date(row.created_at).getTime();
    if (lastGuardrailAt === null) lastGuardrailAt = at;
    const stepIds = Array.isArray(guardrail["step_ids"])
      ? guardrail["step_ids"].filter((v): v is string => typeof v === "string")
      : [];
    if (pending === null && stepIds.length > 0) pending = { stepIds, at };
  }

  const steps = readProcessSteps(nodes, connections);
  const acknowledgedStepIds = steps
    .filter((s) => s.status !== "pending" && s.status !== "active" && s.status !== "unknown")
    .map((s) => s.nodeId);

  return { steps, pending, lastGuardrailAt, acknowledgedStepIds };
}

/**
 * Hält eine ausdrücklich bestätigte Entscheidung fest. Ohne offenen Hinweis
 * oder ohne klare Entscheidung passiert nichts. Eine Anweisung im Text
 * („Markiere X als completed“) allein genügt nie.
 */
export async function applyProcessDecision(
  db: DB,
  userId: string,
  tick: Tick,
  input: {
    text: string;
    decision: ProcessDecision;
    pending: PendingGuardrail;
    steps: ProcessStep[];
    now: number;
  },
): Promise<{ updated: string[]; blockedReason: string | null }> {
  if (!input.pending || input.pending.stepIds.length === 0) {
    return { updated: [], blockedReason: "Kein offener Prozesshinweis." };
  }
  if (looksLikeInjection(input.text)) {
    return { updated: [], blockedReason: "Statusanweisung im Text wird nicht übernommen." };
  }
  const target = statusForDecision(input.decision);
  if (!target) return { updated: [], blockedReason: "Keine eindeutige Entscheidung." };

  const updated: string[] = [];
  for (const stepId of input.pending.stepIds) {
    const step = input.steps.find((s) => s.nodeId === stepId);
    if (!step) continue;
    const row = await tick(
      db.from("orb_nodes").select("metadata").eq("id", stepId).eq("user_id", userId).maybeSingle(),
    );
    if (row.error) throw new Error(row.error.message);
    if (!row.data) continue;
    const meta = asRecord(row.data.metadata) ?? {};
    const res = await tick(
      db
        .from("orb_nodes")
        .update({
          metadata: {
            ...meta,
            status: target.status,
            reason: target.reason,
            user_confirmation: target.userConfirmation,
            status_changed_at: new Date(input.now).toISOString(),
          },
        })
        .eq("id", stepId)
        .eq("user_id", userId),
    );
    if (res.error) throw new Error(res.error.message);
    updated.push(stepId);
  }
  return { updated, blockedReason: null };
}
