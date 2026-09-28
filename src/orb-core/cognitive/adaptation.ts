/**
 * ORB Core – Phase 16: Cognitive Learning / Adaptation Foundation (passiv).
 *
 * Beschreibt nur, welche Adaptationsinformation aus einem explizit
 * beobachteten Outcome folgt. Wendet nichts an, speichert nichts.
 *
 * Signale (alle gleichrangig, keine Quelle gewinnt):
 *   positiv: matched, usefulness >= 0.8, positive, success === true
 *   negativ: not_matched, usefulness <= 0.2, negative, success === false
 *   offen:   partially_observed, partially_matched, 0.2 < usefulness < 0.8,
 *            neutral, success === null (nur wenn Evidence übergeben wurde)
 * Typ:
 *   positiv + negativ           → observe_more, + "mixed_evidence", conf 0.5
 *   nur positiv / nur negativ   → reinforce / caution; conf 1, mit offenen
 *                                 Signalen 0.5
 *   nur offen                   → observe_more, conf 0.5
 *   keine Signale, Status unknown → no_adaptation, conf 0
 *   keine Signale, Status beobachtet → observe_more, conf 0
 *   (unknown_success allein gilt nicht als verwertbare Evidenz)
 *   Outcome kein Objekt         → no_adaptation, conf null
 * usefulness/userFeedback in evidence: übereinstimmend oder nur eine Seite
 * vorhanden → dieser Wert; beide vorhanden und verschieden → null/"unknown",
 * beide Signale zählen.
 *
 * Outcome-Typen strukturgleich lokal: der eingefrorene Phase-15-Test verbietet
 * jeden Import von outcome.ts. Keine Imports, von keinem Modul importiert.
 * Keine Uhr, kein Zufall, keine DB/API/LLM.
 */

export type OrbOutcomeStatus = "observed" | "partially_observed" | "unknown";
export type OrbOutcomeMatch = "matched" | "partially_matched" | "not_matched" | "unknown";
export type OrbUserFeedback = "positive" | "negative" | "neutral" | "unknown";

export type OrbAdaptationOutcomeInput = {
  outcomeStatus: OrbOutcomeStatus;
  outcomeMatch: OrbOutcomeMatch;
  usefulness: number | null;
  userFeedback: OrbUserFeedback;
} & Record<string, unknown>;

export type OrbAdaptationType = "reinforce" | "caution" | "observe_more" | "no_adaptation";

export type OrbLearningEvidence = {
  success: boolean | null;
  usefulness: number | null;
  userFeedback: OrbUserFeedback;
};

export type OrbAdaptationReason =
  | "matched_outcome"
  | "high_usefulness"
  | "positive_feedback"
  | "explicit_success"
  | "not_matched_outcome"
  | "low_usefulness"
  | "negative_feedback"
  | "explicit_failure"
  | "partial_observation"
  | "partial_match"
  | "neutral_feedback"
  | "unknown_success"
  | "mixed_evidence"
  | "no_observable_evidence";

export type OrbAdaptationObservation = {
  type: OrbAdaptationType;
  evidence: {
    outcomeStatus: OrbOutcomeStatus;
    outcomeMatch: OrbOutcomeMatch;
    usefulness: number | null;
    userFeedback: OrbUserFeedback;
    success: boolean | null;
  };
  confidence: number | null;
  reasons: OrbAdaptationReason[];
  source: "explicit_outcome";
};

export const ADAPTATION_REASONS: readonly OrbAdaptationReason[] = [
  "matched_outcome",
  "high_usefulness",
  "positive_feedback",
  "explicit_success",
  "not_matched_outcome",
  "low_usefulness",
  "negative_feedback",
  "explicit_failure",
  "partial_observation",
  "partial_match",
  "neutral_feedback",
  "unknown_success",
  "mixed_evidence",
  "no_observable_evidence",
];

const STATUS = ["observed", "partially_observed", "unknown"];
const MATCH = ["matched", "partially_matched", "not_matched", "unknown"];
const FEEDBACK = ["positive", "negative", "neutral", "unknown"];

function enumOr<T extends string>(v: unknown, allowed: string[]): T {
  return (typeof v === "string" && allowed.includes(v) ? v : "unknown") as T;
}
function unit(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
}
function merged<T>(a: T, b: T, empty: T): T {
  if (a === empty) return b;
  if (b === empty || a === b) return a;
  return empty;
}

export function assessAdaptation(
  outcome: OrbAdaptationOutcomeInput,
  evidence?: OrbLearningEvidence | null,
): OrbAdaptationObservation {
  const valid = !!outcome && typeof outcome === "object";
  const o: Record<string, unknown> = valid ? outcome : {};
  const e: Record<string, unknown> | null = evidence && typeof evidence === "object" ? evidence : null;

  const status = enumOr<OrbOutcomeStatus>(o.outcomeStatus, STATUS);
  const match = enumOr<OrbOutcomeMatch>(o.outcomeMatch, MATCH);
  const uses = [unit(o.usefulness), e ? unit(e.usefulness) : null];
  const feedbacks = [
    enumOr<OrbUserFeedback>(o.userFeedback, FEEDBACK),
    e ? enumOr<OrbUserFeedback>(e.userFeedback, FEEDBACK) : ("unknown" as const),
  ];
  const success = e && typeof e.success === "boolean" ? e.success : null;

  const pos: OrbAdaptationReason[] = [];
  const neg: OrbAdaptationReason[] = [];
  const open: OrbAdaptationReason[] = [];
  const add = (list: OrbAdaptationReason[], r: OrbAdaptationReason) => {
    if (!list.includes(r)) list.push(r);
  };

  if (match === "matched") add(pos, "matched_outcome");
  if (match === "not_matched") add(neg, "not_matched_outcome");
  if (match === "partially_matched") add(open, "partial_match");
  if (status === "partially_observed") add(open, "partial_observation");
  for (const u of uses) {
    if (u === null) continue;
    if (u >= 0.8) add(pos, "high_usefulness");
    else if (u <= 0.2) add(neg, "low_usefulness");
  }
  for (const f of feedbacks) {
    if (f === "positive") add(pos, "positive_feedback");
    if (f === "negative") add(neg, "negative_feedback");
    if (f === "neutral") add(open, "neutral_feedback");
  }
  if (success === true) add(pos, "explicit_success");
  if (success === false) add(neg, "explicit_failure");
  const midUse = uses.some((u) => u !== null && u > 0.2 && u < 0.8);
  const unknownSuccess = !!e && success === null;

  let type: OrbAdaptationType;
  let confidence: number | null;
  let reasons: OrbAdaptationReason[];

  if (!valid) {
    type = "no_adaptation";
    confidence = null;
    reasons = ["no_observable_evidence"];
  } else if (pos.length > 0 && neg.length > 0) {
    type = "observe_more";
    confidence = 0.5;
    reasons = [...pos, ...neg, ...open, ...(unknownSuccess ? ["unknown_success" as const] : []), "mixed_evidence"];
  } else if (pos.length > 0 || neg.length > 0) {
    type = pos.length > 0 ? "reinforce" : "caution";
    const partial = open.length > 0 || midUse;
    confidence = partial ? 0.5 : 1;
    reasons = [...pos, ...neg, ...open];
  } else if (open.length > 0 || midUse) {
    type = "observe_more";
    confidence = 0.5;
    reasons = [...open, ...(unknownSuccess ? ["unknown_success" as const] : [])];
  } else if (status === "unknown") {
    type = "no_adaptation";
    confidence = 0;
    reasons = ["no_observable_evidence"];
  } else {
    type = "observe_more";
    confidence = 0;
    reasons = unknownSuccess ? ["unknown_success"] : ["no_observable_evidence"];
  }

  return {
    type,
    evidence: {
      outcomeStatus: status,
      outcomeMatch: match,
      usefulness: merged<number | null>(uses[0], uses[1], null),
      userFeedback: merged<OrbUserFeedback>(feedbacks[0], feedbacks[1], "unknown"),
      success,
    },
    confidence,
    reasons,
    source: "explicit_outcome",
  };
}
