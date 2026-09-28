/**
 * ORB Core – Phase 14: Cognitive Action Planning Foundation (passiv).
 *
 * "Wenn eine Strategie vom Aufrufer vorgegeben ist: welche Handlungsart
 * entspricht ihr, und sind deren strukturelle Voraussetzungen vorhanden?"
 *
 * - Strategie kommt ausschließlich vom Aufrufer; ungültig → null (kein Plan,
 *   kein Ausweichen auf eine andere Strategie).
 * - Statische Zuordnung Strategy → Action; keine Bewertung, kein Vergleich.
 * - executable = nur strukturelle Voraussetzungen vorhanden. NICHT
 *   "soll/darf ausgeführt werden", nicht "richtiger Zeitpunkt".
 * - Kein Text, keine Frage, keine Parameter. Snapshot/DecisionCandidate nur
 *   gelesen. Der DecisionCandidate wird nur auf passende Strategie geprüft;
 *   Anforderungen kommen direkt aus dem Snapshot.
 * - Typen strukturgleich lokal definiert: die eingefrorenen Isolationstests
 *   der Phasen 12/13 verbieten Importe von strategy.ts/decision.ts.
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

export type OrbActionType =
  | "ask_user"
  | "continue_conversation"
  | "explore_information"
  | "resolve_conflict"
  | "switch_topic"
  | "defer_response"
  | "observe_state"
  | "follow_up_user";

export type OrbActionPlan = {
  strategy: OrbStrategyType;
  action: OrbActionType;
  executable: boolean;
  requirements: string[];
  missingRequirements: string[];
  reasons: string[];
};

/** Nur lesend genutzt: Strategie muss zur übergebenen Strategie passen. */
export type OrbActionPlanDecisionInput = { strategy: OrbStrategyType } & Record<string, unknown>;

export const ACTION_TYPES: readonly OrbActionType[] = [
  "ask_user",
  "continue_conversation",
  "explore_information",
  "resolve_conflict",
  "switch_topic",
  "defer_response",
  "observe_state",
  "follow_up_user",
];

export const STRATEGY_ACTION: Readonly<Record<OrbStrategyType, OrbActionType>> = {
  continue_focus: "continue_conversation",
  ask_clarification: "ask_user",
  explore_gap: "explore_information",
  resolve_conflict: "resolve_conflict",
  switch_focus: "switch_topic",
  defer: "defer_response",
  observe: "observe_state",
  follow_up: "follow_up_user",
};

type Rule = { requirements: string[]; yes: string; no: string };

const RULES: Readonly<Record<OrbStrategyType, Rule>> = {
  continue_focus: {
    requirements: ["currentFocus"],
    yes: "explicit_current_focus",
    no: "no_current_focus",
  },
  ask_clarification: { requirements: ["candidate"], yes: "candidate_present", no: "no_candidate" },
  explore_gap: { requirements: ["candidate"], yes: "candidate_present", no: "no_candidate" },
  resolve_conflict: {
    requirements: ["conflict"],
    yes: "explicit_conflict",
    no: "no_explicit_conflict",
  },
  switch_focus: {
    requirements: ["currentFocus", "candidate"],
    yes: "focus_and_candidate_present",
    no: "focus_or_candidate_missing",
  },
  defer: { requirements: [], yes: "no_structural_requirements", no: "no_structural_requirements" },
  observe: {
    requirements: [],
    yes: "no_structural_requirements",
    no: "no_structural_requirements",
  },
  follow_up: {
    requirements: ["experience"],
    yes: "previous_experience_present",
    no: "no_previous_experience",
  },
};

function isStrategy(v: unknown): v is OrbStrategyType {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(STRATEGY_ACTION, v);
}

function present(req: string, s: OrbCognitiveSnapshot | null | undefined): boolean {
  switch (req) {
    case "currentFocus":
      return !!s?.currentFocus;
    case "candidate":
      return (s?.candidates?.length ?? 0) > 0;
    case "conflict":
      return (s?.conflicts?.length ?? 0) > 0;
    case "experience":
      return (s?.experiences?.length ?? 0) > 0;
    default:
      return false;
  }
}

export function createActionPlan(
  strategy: unknown,
  snapshot: OrbCognitiveSnapshot,
  decisionCandidate?: OrbActionPlanDecisionInput | null,
): OrbActionPlan | null {
  if (!isStrategy(strategy)) return null;
  if (decisionCandidate && decisionCandidate.strategy !== strategy) return null;
  const rule = RULES[strategy];
  const missing = rule.requirements.filter((r) => !present(r, snapshot));
  const executable = missing.length === 0;
  return {
    strategy,
    action: STRATEGY_ACTION[strategy],
    executable,
    requirements: [...rule.requirements],
    missingRequirements: missing,
    reasons: [executable ? rule.yes : rule.no],
  };
}
