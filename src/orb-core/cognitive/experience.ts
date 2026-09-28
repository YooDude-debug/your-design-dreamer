/**
 * ORB Core – Phase 7: Cognitive Experience (reine BEOBACHTUNGS-STRUKTUR).
 *
 * Wird von KEINEM bestehenden ORB-Pfad importiert. Keine DB, kein fetch,
 * keine Server-/LLM-Aufrufe, kein speak, keine Persistierung, keine Uhr,
 * kein Zufall, keine generierten IDs.
 *
 * Experience ≠ Memory ≠ Learning ≠ Success. Beschreibt nur, was passiert
 * ist – nicht, was ORB daraus tun soll. Kein Learning, kein Gesamtscore.
 *
 * Verhältnis zu Phase 1: `OrbExperience` (foundation.ts) bleibt unverändert.
 * Dort ist `success` eine Pflicht-Zahl; Phase 7 braucht true/false/null
 * (null = nicht bestimmbar) und optionale Felder. Daher eine eigene
 * Assessment-Struktur hier, ohne die Foundation zu ändern und ohne
 * Umrechnung (eine Zahl → boolean wäre eine versteckte Heuristik).
 *
 * Keine Heuristiken: success wird nie aus Expected/Actual abgeleitet,
 * usefulness nie aus Antwortlänge/Emoji/Schweigen/Dauer, Feedback nie aus
 * Sentiment. Alle Werte nur aus expliziten Inputs.
 */
import {
  isInformationSource,
  unitOrNull,
  type OrbInformationSource,
} from "@/orb-core/cognitive/foundation";

export const EXPERIENCE_OUTCOME_STATUSES = ["observed", "partially_observed", "unknown"] as const;
export type OrbExperienceOutcomeStatus = (typeof EXPERIENCE_OUTCOME_STATUSES)[number];

export const EXPERIENCE_FEEDBACK_VALUES = ["positive", "negative", "neutral", "unknown"] as const;
export type OrbExperienceFeedback = (typeof EXPERIENCE_FEEDBACK_VALUES)[number];

export const EXPERIENCE_NUMERIC_KEYS = [
  "expectation",
  "outcomeObservability",
  "outcomeMatch",
  "usefulness",
] as const;
export type OrbExperienceNumericKey = (typeof EXPERIENCE_NUMERIC_KEYS)[number];

export type OrbExperienceFactors = Record<OrbExperienceNumericKey, number | null> & {
  success: boolean | null;
  userFeedback: OrbExperienceFeedback;
};

export type OrbExperienceInput = {
  actionId?: unknown;
  expectedOutcome?: unknown;
  actualOutcome?: unknown;
  outcomeStatus?: unknown;
  expectation?: unknown;
  outcomeObservability?: unknown;
  outcomeMatch?: unknown;
  success?: unknown;
  usefulness?: unknown;
  /** Nur explizites Feedback ("positive" | "negative" | "neutral" | "unknown"). */
  userFeedback?: unknown;
  createdAt?: unknown;
  observedAt?: unknown;
  source?: unknown;
};

export type OrbExperienceAssessment = {
  actionId: string | null;
  expectedOutcome: string | null;
  actualOutcome: string | null;
  outcomeStatus: OrbExperienceOutcomeStatus;
  factors: OrbExperienceFactors;
  createdAt: string | null;
  observedAt: string | null;
  /** Nur Datenvollständigkeit – KEINE Aussage über Wahrheit oder Güte. */
  completeness: number;
  provenance: OrbInformationSource;
  basedOnInference: boolean;
  unknownFields: string[];
  invalidFields: string[];
};

const COMPLETENESS_FIELDS = [
  "expectedOutcome",
  "actualOutcome",
  "outcomeStatus",
  "expectation",
  "outcomeObservability",
  "outcomeMatch",
  "success",
  "usefulness",
  "userFeedback",
] as const;

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function isoOrNull(v: unknown): string | null {
  return typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;
}

function cloneSource(s: OrbInformationSource): OrbInformationSource {
  return s.type === "inference" ? { type: "inference", sourceIds: [...s.sourceIds] } : { ...s };
}

export function assessCognitiveExperience(input: OrbExperienceInput = {}): OrbExperienceAssessment {
  const invalidFields: string[] = [];
  const unit = (key: OrbExperienceNumericKey): number | null => {
    const v = input[key];
    if (v === undefined || v === null) return null;
    const n = unitOrNull(v);
    if (n === null) invalidFields.push(key);
    return n;
  };

  const outcomeStatus: OrbExperienceOutcomeStatus =
    typeof input.outcomeStatus === "string" &&
    (EXPERIENCE_OUTCOME_STATUSES as readonly string[]).includes(input.outcomeStatus)
      ? (input.outcomeStatus as OrbExperienceOutcomeStatus)
      : "unknown";
  if (
    input.outcomeStatus !== undefined &&
    outcomeStatus === "unknown" &&
    input.outcomeStatus !== "unknown"
  ) {
    invalidFields.push("outcomeStatus");
  }

  let success: boolean | null = null;
  if (typeof input.success === "boolean") success = input.success;
  else if (input.success !== undefined && input.success !== null) invalidFields.push("success");

  let userFeedback: OrbExperienceFeedback = "unknown";
  if (
    typeof input.userFeedback === "string" &&
    (EXPERIENCE_FEEDBACK_VALUES as readonly string[]).includes(input.userFeedback)
  ) {
    userFeedback = input.userFeedback as OrbExperienceFeedback;
  } else if (input.userFeedback !== undefined && input.userFeedback !== null) {
    invalidFields.push("userFeedback");
  }

  const factors: OrbExperienceFactors = {
    expectation: unit("expectation"),
    outcomeObservability: unit("outcomeObservability"),
    outcomeMatch: unit("outcomeMatch"),
    usefulness: unit("usefulness"),
    success,
    userFeedback,
  };

  const values: Record<(typeof COMPLETENESS_FIELDS)[number], boolean> = {
    expectedOutcome: text(input.expectedOutcome) !== null,
    actualOutcome: text(input.actualOutcome) !== null,
    outcomeStatus: outcomeStatus !== "unknown",
    expectation: factors.expectation !== null,
    outcomeObservability: factors.outcomeObservability !== null,
    outcomeMatch: factors.outcomeMatch !== null,
    success: factors.success !== null,
    usefulness: factors.usefulness !== null,
    userFeedback: factors.userFeedback !== "unknown",
  };
  const unknownFields = COMPLETENESS_FIELDS.filter((k) => !values[k]);

  const provenance: OrbInformationSource = isInformationSource(input.source)
    ? cloneSource(input.source)
    : { type: "unknown" };

  return {
    actionId: text(input.actionId),
    expectedOutcome: text(input.expectedOutcome),
    actualOutcome: text(input.actualOutcome),
    outcomeStatus,
    factors,
    createdAt: isoOrNull(input.createdAt),
    observedAt: isoOrNull(input.observedAt),
    completeness: (COMPLETENESS_FIELDS.length - unknownFields.length) / COMPLETENESS_FIELDS.length,
    provenance,
    basedOnInference: provenance.type === "inference",
    unknownFields,
    invalidFields,
  };
}
