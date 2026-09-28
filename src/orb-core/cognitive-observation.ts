/**
 * ORB Core – Cognitive Observation (einziger Einstieg in Phase 1–16).
 *
 * Rein beobachtend: beschreibt, was im laufenden ORB-Vorgang an
 * Cognitive-Struktur vorhanden wäre. Ergebnis ist flüchtig (nur im
 * Rundenergebnis, wie das Retrieval-Event), wird nie gespeichert und von
 * keinem ORB-Pfad gelesen. Keine DB, kein LLM, kein Netzwerk, keine Uhr.
 *
 * Datenherkunft (ausschließlich bereits geladene Daten):
 * - Candidates: je eine bereits geladene Memory-ID (Chat: abgerufene
 *   Memories; autonome Frage: Knoten der bereits geladenen Lücken).
 *   Quelle { type: "memory", memoryId }. Kein Inhalt, kein Topic.
 * - Alle Dimensionen (Relevance … Contradiction): null – ORB liefert dafür
 *   noch keine Daten in der Semantik der Cognitive-Schichten. Insbesondere
 *   werden Retrieval-Score und Gap-Novelty NICHT umgedeutet.
 * - Fokus, Goals, Experiences, Conflicts: nicht vorhanden → null / [].
 * - Action Plan: keine explizit vorgegebene Strategie → keine Pläne.
 * - Outcome / Adaptation: kein explizites Outcome → null.
 *
 * Fehler: jede Ausnahme → { status: "failed" } ohne Ersatzdaten; der
 * aufrufende ORB-Lauf bleibt unberührt.
 */
import { isInformationSource } from "./cognitive/foundation";
import { createCognitiveCandidate, type OrbCognitiveCandidate } from "./cognitive/candidate";
import { compareCognitiveCandidates } from "./cognitive/competition";
import { createCognitiveSnapshot, type OrbCognitiveSnapshot } from "./cognitive/snapshot";
import { assessStrategies, type OrbStrategyAssessment } from "./cognitive/strategy";
import { assessDecisionFoundation, type OrbDecisionFoundation } from "./cognitive/decision";
import type { OrbActionPlan } from "./cognitive/action-plan";
import type { OrbOutcome } from "./cognitive/outcome";
import type { OrbAdaptationObservation } from "./cognitive/adaptation";

/** Obergrenze für Candidates je Vorgang (Paarvergleiche bleiben klein). */
export const COGNITIVE_OBSERVATION_MAX_CANDIDATES = 12;

export type OrbCognitivePath = "chat" | "proactive_question";

export type OrbCognitiveObservation =
  | {
      kind: "orb.cognitive_observation";
      status: "observed";
      path: OrbCognitivePath;
      candidateCount: number;
      /** true, wenn mehr IDs vorlagen als COGNITIVE_OBSERVATION_MAX_CANDIDATES. */
      truncated: boolean;
      snapshot: OrbCognitiveSnapshot;
      strategies: OrbStrategyAssessment;
      decision: OrbDecisionFoundation;
      actionPlans: OrbActionPlan[];
      outcome: OrbOutcome | null;
      adaptation: OrbAdaptationObservation | null;
    }
  | { kind: "orb.cognitive_observation"; status: "failed"; path: OrbCognitivePath };

function uniqueIds(ids: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const id of ids)
    if (typeof id === "string" && id.length > 0 && !out.includes(id)) out.push(id);
  return out;
}

export function runCognitiveObservation(input: {
  path: OrbCognitivePath;
  memoryIds: readonly unknown[];
}): OrbCognitiveObservation {
  const path = input?.path === "proactive_question" ? "proactive_question" : "chat";
  try {
    const all = uniqueIds(Array.isArray(input?.memoryIds) ? input.memoryIds : []);
    const ids = all.slice(0, COGNITIVE_OBSERVATION_MAX_CANDIDATES);
    const candidates: OrbCognitiveCandidate[] = ids.map((id) => {
      const source = { type: "memory" as const, memoryId: id };
      return createCognitiveCandidate({
        id,
        source: isInformationSource(source) ? source : undefined,
      });
    });
    const competitions = [];
    for (let i = 0; i < candidates.length; i++)
      for (let j = i + 1; j < candidates.length; j++)
        competitions.push(compareCognitiveCandidates(candidates[i], candidates[j]));
    const snapshot = createCognitiveSnapshot({ candidates, competitions });
    const strategies = assessStrategies(snapshot);
    const decision = assessDecisionFoundation(snapshot, strategies);
    return {
      kind: "orb.cognitive_observation",
      status: "observed",
      path,
      candidateCount: candidates.length,
      truncated: all.length > ids.length,
      snapshot,
      strategies,
      decision,
      actionPlans: [],
      outcome: null,
      adaptation: null,
    };
  } catch {
    return { kind: "orb.cognitive_observation", status: "failed", path };
  }
}
