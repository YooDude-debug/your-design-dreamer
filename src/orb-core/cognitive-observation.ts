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
 * - Phase 4 (Uncertainty): Herkunft { type: "memory" } plus – falls
 *   übergeben – gespeicherter Inhalt (statement) und die Inhalte der übrigen
 *   Candidates (others). sourceAgreement/contradiction nur aus der
 *   bestehenden lexikalischen Regel; recencyUncertainty bleibt null
 *   (timeDependent liegt nicht vor). Engine-Herkunft (user_stated/observed/
 *   inferred) wird nur in memoryOrigins durchgereicht: "inference" verlangt
 *   Quell-IDs, die nicht vorliegen – daher keine Umdeutung.
 * - Phasen 2, 3, 5, 6, 7, 8: null – im Aufrufkontext liegen nur IDs vor,
 *   keine Texte, Ziele, Fokusangaben, Erfahrungen oder Aussagen-Tripel.
 *   Retrieval-Score und Gap-Novelty werden NICHT umgedeutet; eine Gap-ID
 *   ist nur Kandidatenreferenz (Wissenslücken-Knoten), keine Wahrheit.
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
import { assessCognitiveUncertainty } from "./cognitive/uncertainty";
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
type OrbJson = string | number | boolean | null | OrbJson[] | { [key: string]: OrbJson };
export type OrbObservedOutcome = Omit<OrbOutcome, "provenance"> & {
  provenance: OrbJson | undefined;
};

export type OrbCognitiveObservation =
  | {
      kind: "orb.cognitive_observation";
      status: "observed";
      path: OrbCognitivePath;
      candidateCount: number;
      /** true, wenn mehr IDs vorlagen als COGNITIVE_OBSERVATION_MAX_CANDIDATES. */
      truncated: boolean;
      /** Engine-Herkunft je Candidate, unverändert (null = nicht übergeben). */
      memoryOrigins: { memoryId: string; origin: string | null }[];
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

/** Bereits geladener Memory-Inhalt (nur für Phase 4). */
export type OrbObservedMemory = {
  id: string;
  content: string;
  /** Gespeicherte Engine-Herkunft, unverändert durchgereicht; fehlt → null. */
  origin?: string | null;
};

function contentMap(list: readonly unknown[] | undefined): Map<string, OrbObservedMemory> {
  const out = new Map<string, OrbObservedMemory>();
  if (!Array.isArray(list)) return out;
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id || out.has(r.id)) continue;
    if (typeof r.content !== "string" || !r.content.trim()) continue;
    out.set(r.id, {
      id: r.id,
      content: r.content,
      origin: typeof r.origin === "string" && r.origin ? r.origin : null,
    });
  }
  return out;
}

export function runCognitiveObservation(input: {
  path: OrbCognitivePath;
  memoryIds: readonly unknown[];
  /** Bereits geladene Inhalte zu den IDs (keine neue Datenquelle). */
  memories?: readonly OrbObservedMemory[];
  /** Explizit beobachtetes Outcome. Der ORB-Laufzeitpfad übergibt keines. */
  observedOutcome?: OrbOutcomeInput | null;
}): OrbCognitiveObservation {
  const path = input?.path === "proactive_question" ? "proactive_question" : "chat";
  try {
    const all = uniqueIds(Array.isArray(input?.memoryIds) ? input.memoryIds : []);
    const ids = all.slice(0, COGNITIVE_OBSERVATION_MAX_CANDIDATES);
    const contents = contentMap(input?.memories);
    const sourced = ids.map((id) => {
      const source = { type: "memory" as const, memoryId: id };
      return { id, source: isInformationSource(source) ? source : undefined };
    });
    // Phase 4: Herkunft + (falls vorhanden) gespeicherter Inhalt als statement,
    // übrige Candidate-Inhalte mit Memory-Quelle als others. Vergleich nur über
    // die bestehende lexikalische Regel in uncertainty.ts. Kein timeDependent
    // → recencyUncertainty bleibt null.
    const candidates: OrbCognitiveCandidate[] = sourced.map(({ id, source }) => {
      if (!source) return createCognitiveCandidate({ id, source: undefined });
      const statement = contents.get(id)?.content;
      const others = sourced
        .filter((o) => o.id !== id && o.source && contents.has(o.id))
        .map((o) => ({ text: contents.get(o.id)!.content, source: o.source! }));
      const uncertainty = assessCognitiveUncertainty(
        statement && others.length > 0 ? { source, statement, others } : { source },
      );
      return createCognitiveCandidate({ id, source, uncertainty });
    });
    const memoryOrigins = ids.map((id) => ({
      memoryId: id,
      origin: contents.get(id)?.origin ?? null,
    }));
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
      memoryOrigins,
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
