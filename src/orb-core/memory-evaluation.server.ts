/**
 * P14 S2 / Phase 3 – Ausgabe der passiven Memory-Bewertung als Logzeile.
 * Nutzung kommt ausschliesslich aus der Phase-2E-Regel (evaluateUsageEvidence);
 * das frühere S2-Nutzungsfeld wird nicht mehr protokolliert (keine Doppelbewertung).
 * Schreibt nie in die Datenbank, wirft nie, gibt nichts zurück. Nur IDs/Status.
 */
import { evaluateMemories, type EvaluationInputMemory } from "@/orb-core/memory-evaluation";
import { evaluateUsageEvidence } from "@/orb-core/memory-usage-evidence";
import type { OrbDataScope } from "@/orb-core/scope-values";

export function logPassiveMemoryEvaluation(input: {
  scope: OrbDataScope | null;
  eventId: string;
  recalled: EvaluationInputMemory[];
  /** Ohne ID (null) nie als sichtbar gewertet. */
  modelVisibleIds: readonly (string | null)[];
  replyText: string;
  userText: string;
}): void {
  try {
    // Ohne bekannten Bereich keine Bewertung (kein Raten, kein Default).
    if (!input.scope) return;
    const visible = input.modelVisibleIds.filter((id): id is string => typeof id === "string");
    const evaluation = evaluateMemories({
      scope: input.scope,
      memories: input.recalled,
      modelVisibleIds: visible,
      replyText: input.replyText,
      userText: input.userText,
    });
    const usage = new Map(
      evaluateUsageEvidence({
        retrieved: input.recalled.map((m) => ({ id: m.id, content: m.content })),
        suppliedIds: visible,
        userText: input.userText,
        replyText: input.replyText,
      }).map((e) => [e.id, e]),
    );
    const entries = evaluation.entries.map((e) => ({
      id: e.id,
      relevance: e.relevance,
      importance: e.importance,
      usage: usage.get(e.id)?.status ?? "unknown",
      usage_reason: usage.get(e.id)?.reason ?? "not_supplied",
    }));
    console.info(
      "[orb.obs.memory_eval]",
      JSON.stringify({ event_id: input.eventId, ...evaluation, version: 2, entries }),
    );
  } catch {
    // Beobachtung darf den Chat nie beeinflussen.
  }
}
