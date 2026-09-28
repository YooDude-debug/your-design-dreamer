/**
 * ORB Core – Phase 10: Cognitive Competition (neutrale Paarbeziehung).
 *
 * Beantwortet nur: "Wie stark konkurrieren zwei Candidates momentan um
 * dieselbe kognitive Aufmerksamkeit?" – NICHT, wer gewinnt, was wichtiger
 * ist oder was ORB tun soll. Kein Winner, kein Ranking, keine Auswahl,
 * keine Priorisierung. Symmetrisch: compare(A,B) ≡ compare(B,A)
 * (nur die IDs folgen der Eingabereihenfolge).
 *
 * Primitive Faktor-Regeln (nur aus vorhandenen Candidate-Daten):
 * - attentionOverlap: beide attention.factors.currentFocus vorhanden →
 *   min(a, b) = beide beanspruchen gleichzeitig den aktuellen Fokus.
 * - focusOverlap: beide attention.focus vorhanden → 1 gleich (kind+id), sonst 0.
 * - topicOverlap: beide Topics vorhanden → Jaccard der Wortmengen
 *   (trim, lowercase, Split an Nicht-Buchstaben/Ziffern). Keine Synonyme.
 * - goalOverlap: beide goalPressure.goalId vorhanden → 1 gleich, sonst 0.
 *   Nie aus ähnlichen Zahlen geschlossen.
 * - interruptionConflict: beide attention.factors.interruption vorhanden →
 *   min(a, b). Höhere interruption ≠ wichtiger.
 * Fehlt die Grundlage → null.
 *
 * Relevance, Novelty, Uncertainty, Experience und Contradiction erzeugen
 * bewusst KEINE Competition (keine automatische Umdeutung).
 *
 * score = stärkster einzelner beobachteter Überlappungsfaktor (max). Er
 * beschreibt nur die Stärke der Beziehung – keine Wichtigkeit, Relevance,
 * Priorität oder Entscheidung. Faktoren bleiben separat sichtbar.
 * level: kein Faktor → unknown; score 0 → none; <1/3 low; <2/3 medium; sonst high.
 * Gleiche (nicht-leere) ID → none ("kein Wettbewerb zwischen zwei
 * verschiedenen Fokusobjekten", nicht "unwichtig"). Fehlender Candidate → unknown.
 *
 * Keine Uhr, kein Zufall, keine DB/API/LLM, keine Side-Effects, keine
 * Mutation. Von keinem Modul importiert.
 */
import type { OrbCognitiveCandidate } from "./candidate";

export const COMPETITION_FACTOR_KEYS = [
  "attentionOverlap",
  "focusOverlap",
  "topicOverlap",
  "goalOverlap",
  "interruptionConflict",
] as const;
export type OrbCompetitionFactorKey = (typeof COMPETITION_FACTOR_KEYS)[number];
export type OrbCompetitionFactors = Record<OrbCompetitionFactorKey, number | null>;

export type OrbCompetitionLevel = "none" | "low" | "medium" | "high" | "unknown";

export type OrbCompetitionReason =
  | OrbCompetitionFactorKey
  | "identical_candidate"
  | "missing_candidate"
  | "insufficient_data";

export type OrbCompetitionRelationship = {
  leftCandidateId: string | null;
  rightCandidateId: string | null;
  level: OrbCompetitionLevel;
  score: number | null;
  factors: OrbCompetitionFactors;
  reasons: OrbCompetitionReason[];
};

function emptyFactors(): OrbCompetitionFactors {
  return {
    attentionOverlap: null,
    focusOverlap: null,
    topicOverlap: null,
    goalOverlap: null,
    interruptionConflict: null,
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function bothMin(a: unknown, b: unknown): number | null {
  const x = num(a);
  const y = num(b);
  return x === null || y === null ? null : Math.min(x, y);
}

function words(t: string | null | undefined): Set<string> | null {
  if (typeof t !== "string") return null;
  const w = t
    .trim()
    .toLocaleLowerCase("de-DE")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((s) => s.length > 0);
  return w.length > 0 ? new Set(w) : null;
}

function topicOverlap(a: string | null, b: string | null): number | null {
  const x = words(a);
  const y = words(b);
  if (!x || !y) return null;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / new Set([...x, ...y]).size;
}

function focusOverlap(l: OrbCognitiveCandidate, r: OrbCognitiveCandidate): number | null {
  const a = l.attention?.focus;
  const b = r.attention?.focus;
  if (!a || !b) return null;
  return a.kind === b.kind && a.id === b.id ? 1 : 0;
}

function goalOverlap(l: OrbCognitiveCandidate, r: OrbCognitiveCandidate): number | null {
  const a = l.goalPressure?.goalId;
  const b = r.goalPressure?.goalId;
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return null;
  return a === b ? 1 : 0;
}

function levelFor(score: number): OrbCompetitionLevel {
  if (score <= 0) return "none";
  if (score < 1 / 3) return "low";
  if (score < 2 / 3) return "medium";
  return "high";
}

export function compareCognitiveCandidates(
  left: OrbCognitiveCandidate | null | undefined,
  right: OrbCognitiveCandidate | null | undefined,
): OrbCompetitionRelationship {
  const leftCandidateId = left?.id ?? null;
  const rightCandidateId = right?.id ?? null;
  const base = { leftCandidateId, rightCandidateId, factors: emptyFactors() };

  if (!left || !right) {
    return { ...base, level: "unknown", score: null, reasons: ["missing_candidate"] };
  }
  if (leftCandidateId !== null && leftCandidateId === rightCandidateId) {
    return { ...base, level: "none", score: null, reasons: ["identical_candidate"] };
  }

  const factors: OrbCompetitionFactors = {
    attentionOverlap: bothMin(
      left.attention?.factors.currentFocus,
      right.attention?.factors.currentFocus,
    ),
    focusOverlap: focusOverlap(left, right),
    topicOverlap: topicOverlap(left.topic, right.topic),
    goalOverlap: goalOverlap(left, right),
    interruptionConflict: bothMin(
      left.attention?.factors.interruption,
      right.attention?.factors.interruption,
    ),
  };

  const present = COMPETITION_FACTOR_KEYS.filter((k) => factors[k] !== null);
  if (present.length === 0) {
    return { ...base, factors, level: "unknown", score: null, reasons: ["insufficient_data"] };
  }
  const score = Math.max(...present.map((k) => factors[k] as number));
  return { ...base, factors, level: levelFor(score), score, reasons: [...present] };
}
