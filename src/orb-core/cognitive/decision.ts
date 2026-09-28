/**
 * ORB Core – Phase 13: Cognitive Decision Foundation (passive Vorbereitung).
 *
 * Beschreibt pro Strategie, welche Entscheidungsinformationen vorhanden
 * sind und welche fehlen – trifft KEINE Entscheidung.
 *
 * Festgelegt (User-Entscheidung 2026-09-28):
 * - Dimensionswerte = vorhandene Datenabdeckung, unverändert kopiert:
 *   confidence (Relevance, Novelty, Uncertainty, Goal Pressure, Attention,
 *   Contradiction) bzw. completeness (Experience). Kein Dimensionswert.
 * - Werte nur bei genau einem Candidate; bei 0 oder mehreren → null.
 *   missingInputs listet fehlende Dimensionen aller Candidates.
 * - competition: immer null; Vorhandensein nur über missingInputs.
 * - available/reasons werden aus Phase 12 übernommen (kopiert).
 * - Feste Phase-12-Reihenfolge; Position hat keine Bedeutung.
 * - Keine Uhr, kein Zufall, keine DB/API/LLM. Von keinem Modul importiert.
 */
import type { OrbCognitiveSnapshot } from "./snapshot.ts";
import type { OrbCognitiveCandidate } from "./candidate.ts";

/** Strukturgleiche Kopie der Phase-12-Typen (Phase-12-Isolationstest verbietet Import). */
export type OrbStrategyType =
  | "continue_focus"
  | "ask_clarification"
  | "explore_gap"
  | "resolve_conflict"
  | "switch_focus"
  | "defer"
  | "observe"
  | "follow_up";

type OrbStrategyAssessmentInput = {
  strategies: { type: OrbStrategyType; available: boolean; reasons: string[] }[];
};

export type OrbDecisionInputs = {
  relevance: number | null;
  novelty: number | null;
  uncertainty: number | null;
  goalPressure: number | null;
  attention: number | null;
  experience: number | null;
  contradiction: number | null;
  competition: number | null;
  focusPresent: boolean;
  experiencePresent: boolean;
  conflictPresent: boolean;
};

export type OrbDecisionCandidate = {
  strategy: OrbStrategyType;
  available: boolean;
  decisionInputs: OrbDecisionInputs;
  missingInputs: string[];
  reasons: string[];
};

export type OrbDecisionFoundation = {
  candidates: OrbDecisionCandidate[];
};

const ORDER: readonly OrbStrategyType[] = [
  "continue_focus",
  "ask_clarification",
  "explore_gap",
  "resolve_conflict",
  "switch_focus",
  "defer",
  "observe",
  "follow_up",
];

const DIMENSIONS = [
  "relevance",
  "novelty",
  "uncertainty",
  "goalPressure",
  "attention",
  "experience",
  "contradiction",
] as const;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function coverage(c: OrbCognitiveCandidate | null, d: (typeof DIMENSIONS)[number]): number | null {
  if (!c) return null;
  if (d === "experience") return c.experience ? num(c.experience.completeness) : null;
  const a = c[d] as { confidence?: unknown } | null | undefined;
  return a ? num(a.confidence) : null;
}

function missingDimensions(cands: OrbCognitiveCandidate[]): string[] {
  const out: string[] = [];
  cands.forEach((c, i) => {
    const label = cands.length === 1 ? "" : `${c?.id ?? `#${i}`}.`;
    for (const d of DIMENSIONS) {
      const v = c ? (c as Record<string, unknown>)[d] : undefined;
      if (v === null || v === undefined) out.push(label + d);
    }
  });
  return out;
}

export function assessDecisionCandidate(
  strategy: OrbStrategyType,
  snapshot: OrbCognitiveSnapshot,
  strategyAssessment: OrbStrategyAssessmentInput,
): OrbDecisionCandidate {
  const cands = Array.isArray(snapshot?.candidates) ? snapshot.candidates : [];
  const focusPresent = !!snapshot?.currentFocus;
  const experiencePresent = (snapshot?.experiences?.length ?? 0) > 0;
  const conflictPresent = (snapshot?.conflicts?.length ?? 0) > 0;
  const competitionPresent = (snapshot?.competitions?.length ?? 0) > 0;
  const single = cands.length === 1 ? cands[0] : null;
  const entry = strategyAssessment?.strategies?.find((s) => s.type === strategy);

  const need: string[] = [];
  const noCandidate = cands.length === 0;
  switch (strategy) {
    case "continue_focus":
      if (!focusPresent) need.push("currentFocus");
      break;
    case "ask_clarification":
    case "explore_gap":
      if (noCandidate) need.push("candidate");
      else need.push(...missingDimensions(cands));
      break;
    case "resolve_conflict":
      if (!conflictPresent) need.push("conflict");
      break;
    case "switch_focus":
      if (!focusPresent) need.push("currentFocus");
      if (noCandidate) need.push("candidate");
      if (!competitionPresent) need.push("competition");
      break;
    case "defer":
      if (noCandidate) need.push("candidate");
      break;
    case "observe":
      break;
    case "follow_up":
      if (!experiencePresent) need.push("experience");
      break;
  }

  return {
    strategy,
    available: entry ? entry.available === true : false,
    decisionInputs: {
      relevance: coverage(single, "relevance"),
      novelty: coverage(single, "novelty"),
      uncertainty: coverage(single, "uncertainty"),
      goalPressure: coverage(single, "goalPressure"),
      attention: coverage(single, "attention"),
      experience: coverage(single, "experience"),
      contradiction: coverage(single, "contradiction"),
      competition: null,
      focusPresent,
      experiencePresent,
      conflictPresent,
    },
    missingInputs: need,
    reasons: entry && Array.isArray(entry.reasons) ? [...entry.reasons] : [],
  };
}

export function assessDecisionFoundation(
  snapshot: OrbCognitiveSnapshot,
  strategyAssessment: OrbStrategyAssessmentInput,
): OrbDecisionFoundation {
  return {
    candidates: ORDER.map((s) => assessDecisionCandidate(s, snapshot, strategyAssessment)),
  };
}
