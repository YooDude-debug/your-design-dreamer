/**
 * P14 S2 – Ausgabe der passiven Memory-Bewertung als Logzeile.
 * Schreibt nie in die Datenbank, wirft nie, gibt nichts zurück.
 */
import { evaluateMemories, type EvaluationInputMemory } from "@/orb-core/memory-evaluation";
import type { OrbDataScope } from "@/orb-core/scope-values";

export function logPassiveMemoryEvaluation(input: {
  scope: OrbDataScope | null;
  eventId: string;
  recalled: EvaluationInputMemory[];
  modelVisibleIds: readonly string[];
  replyText: string;
  userText: string;
}): void {
  try {
    // Ohne bekannten Bereich keine Bewertung (kein Raten, kein Default).
    if (!input.scope) return;
    const evaluation = evaluateMemories({
      scope: input.scope,
      memories: input.recalled,
      modelVisibleIds: input.modelVisibleIds,
      replyText: input.replyText,
      userText: input.userText,
    });
    console.info(
      "[orb.obs.memory_eval]",
      JSON.stringify({ event_id: input.eventId, ...evaluation }),
    );
  } catch {
    // Beobachtung darf den Chat nie beeinflussen.
  }
}
