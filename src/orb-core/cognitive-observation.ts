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
 * - Action Plan (Phase 14): je ein Plan für JEDE Strategie mit
 *   available=true aus Phase 12, in deren fester Reihenfolge. Keine Auswahl,
 *   kein Ranking, kein Gewinner; Phase 13 wird nur als strukturgleicher
 *   Begleitwert übergeben, nicht zur Auswahl genutzt. Pläne werden nie
 *   ausgeführt.
 * - Outcome (Phase 15): nur wenn der Aufrufer ein explizit beobachtetes
 *   Outcome übergibt. Der ORB-Laufzeitpfad übergibt keines (Pläne werden
 *   nicht ausgeführt, es gibt nichts zu beobachten) → null.
 * - Adaptation (Phase 16): nur aus einem vorhandenen Outcome, sonst null.
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
import { createActionPlan, type OrbActionPlan } from "./cognitive/action-plan";
import { createOutcome, type OrbOutcome, type OrbOutcomeInput } from "./cognitive/outcome";
import { assessAdaptation, type OrbAdaptationObservation } from "./cognitive/adaptation";

/** Obergrenze für Candidates je Vorgang (Paarvergleiche bleiben klein). */
export const COGNITIVE_OBSERVATION_MAX_CANDIDATES = 12;

export type OrbCognitivePath = "chat" | "proactive_question";

/** Outcome ohne freie Provenance (bleibt serialisierbar). */
export type OrbObservedOutcome = Omit<OrbOutcome, "provenance"> & {
  provenance: string | number | boolean | null | Record<string, unknown> | undefined;
};

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
      /** Nur bei explizit übergebenem, beobachtetem Outcome; sonst null. */
      outcome: OrbObservedOutcome | null;
      /** Nur aus vorhandenem Outcome; sonst null. */
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
  /** Explizit beobachtetes Outcome. Der ORB-Laufzeitpfad übergibt keines. */
  observedOutcome?: OrbOutcomeInput | null;
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

    // Phase 14: alle verfügbaren Strategien, feste Reihenfolge aus Phase 12.
    const actionPlans: OrbActionPlan[] = [];
    for (const s of strategies.strategies) {
      if (!s.available) continue;
      const dc = decision.candidates.find((c) => c.strategy === s.type) ?? null;
      const plan = createActionPlan(s.type, snapshot, dc);
      if (plan) actionPlans.push(plan);
    }

    // Phase 15: nur explizit übergebenes Outcome.
    const rawOutcome = input?.observedOutcome;
    const outcome =
      rawOutcome && typeof rawOutcome === "object"
        ? (createOutcome(rawOutcome) as OrbObservedOutcome)
        : null;

    // Phase 16: nur aus vorhandenem Outcome.
    const adaptation = outcome ? assessAdaptation(outcome) : null;

    return {
      kind: "orb.cognitive_observation",
      status: "observed",
      path,
      candidateCount: candidates.length,
      truncated: all.length > ids.length,
      snapshot,
      strategies,
      decision,
      actionPlans,
      outcome,
      adaptation,
    };
  } catch {
    return { kind: "orb.cognitive_observation", status: "failed", path };
  }
}
