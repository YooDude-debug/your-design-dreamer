/**
 * ORB Core – Phase 12: Cognitive Strategy Foundation (passive Verfügbarkeit).
 *
 * "Welche Reaktionsarten sind in diesem Zustand grundsätzlich verfügbar?"
 * – keine Wahl, keine Bewertung, keine Reihung, keine Ausführung.
 *
 * - 8 feste Typen, feste API-Reihenfolge (keine Bevorzugung).
 * - Nur available: boolean + deterministische Grund-Codes.
 * - Candidate-Dimensionen werden nur auf null/fehlend geprüft, nie numerisch.
 * - Listen zählen nur als vorhanden/leer. Goals werden nicht genutzt.
 * - Snapshot wird nur gelesen, nie verändert.
 * - Keine Uhr, kein Zufall, keine DB/API/LLM. Von keinem Modul importiert.
 */
import type { OrbCognitiveSnapshot } from "./snapshot.ts";

export type OrbStrategyType =
  | "continue_focus"
  | "ask_clarification"
  | "explore_gap"
  | "resolve_conflict"
  | "switch_focus"
  | "defer"
  | "observe"
  | "follow_up";

export type OrbStrategyCandidate = {
  type: OrbStrategyType;
  available: boolean;
  reasons: string[];
};

export type OrbStrategyAssessment = {
  strategies: OrbStrategyCandidate[];
};

export const STRATEGY_TYPES: readonly OrbStrategyType[] = [
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

function entry(type: OrbStrategyType, available: boolean, yes: string, no: string) {
  return { type, available, reasons: [available ? yes : no] };
}

export function assessStrategies(snapshot: OrbCognitiveSnapshot): OrbStrategyAssessment {
  const candidates = Array.isArray(snapshot?.candidates) ? snapshot.candidates : [];
  const competitions = Array.isArray(snapshot?.competitions) ? snapshot.competitions : [];
  const conflicts = Array.isArray(snapshot?.conflicts) ? snapshot.conflicts : [];
  const experiences = Array.isArray(snapshot?.experiences) ? snapshot.experiences : [];
  const hasFocus = !!snapshot?.currentFocus;
  const hasCandidate = candidates.length > 0;
  const incomplete = candidates.some(
    (c) => !!c && DIMENSIONS.some((d) => (c as Record<string, unknown>)[d] === null || !(d in c)),
  );

  return {
    strategies: [
      entry("continue_focus", hasFocus, "explicit_current_focus", "no_current_focus"),
      entry(
        "ask_clarification",
        incomplete,
        "candidate_information_incomplete",
        "no_incomplete_candidate_information",
      ),
      entry("explore_gap", incomplete, "candidate_information_gap", "no_candidate_information_gap"),
      entry("resolve_conflict", conflicts.length > 0, "explicit_conflict", "no_explicit_conflict"),
      entry(
        "switch_focus",
        hasFocus && hasCandidate && competitions.length > 0,
        "focus_and_competition_present",
        "focus_or_competition_missing",
      ),
      entry("defer", hasCandidate, "candidate_present", "no_candidate"),
      entry("observe", true, "observation_always_available", "observation_always_available"),
      entry(
        "follow_up",
        experiences.length > 0,
        "previous_experience_present",
        "no_previous_experience",
      ),
    ],
  };
}
