/**
 * ORB Core – Phase 15: Cognitive Outcome & Feedback Foundation (passiv).
 *
 * Beantwortet nur: "Was ist nach einer Handlung bekannt?" – ausschließlich
 * aus explizit übergebenen Werten. Kein Vergleich von Erwartung und
 * Ergebnis, keine Textauswertung, keine Stimmungserkennung, kein Lernen,
 * keine Anpassung. Ungültige Enum-Werte → "unknown"; ungültige usefulness
 * (außerhalb 0..1, NaN, Nicht-Zahl) → null, ohne Begrenzen. Texte werden
 * wörtlich übernommen, Nicht-Texte → null. Provenance: tiefe Kopie mit
 * identischem Inhalt (nicht kopierbar → unveränderte Referenz); fehlt sie,
 * bleibt sie undefined. Keine Uhr, kein Zufall, keine IDs, keine DB/API/LLM.
 * Keine Imports, von keinem Modul importiert.
 */

export type OrbOutcomeStatus = "observed" | "partially_observed" | "unknown";
export type OrbOutcomeMatch = "matched" | "partially_matched" | "not_matched" | "unknown";
export type OrbUserFeedback = "positive" | "negative" | "neutral" | "unknown";

export type OrbOutcome = {
  actionId: string | null;
  expectedOutcome: string | null;
  actualOutcome: string | null;
  outcomeStatus: OrbOutcomeStatus;
  outcomeMatch: OrbOutcomeMatch;
  usefulness: number | null;
  userFeedback: OrbUserFeedback;
  source: string | null;
  createdAt: string | null;
  provenance: unknown;
};

export type OrbOutcomeInput = {
  actionId?: string | null;
  expectedOutcome?: string | null;
  actualOutcome?: string | null;
  outcomeStatus?: OrbOutcomeStatus;
  outcomeMatch?: OrbOutcomeMatch;
  usefulness?: number | null;
  userFeedback?: OrbUserFeedback;
  source?: string | null;
  createdAt?: string | null;
  provenance?: unknown;
};

const STATUS: readonly string[] = ["observed", "partially_observed", "unknown"];
const MATCH: readonly string[] = ["matched", "partially_matched", "not_matched", "unknown"];
const FEEDBACK: readonly string[] = ["positive", "negative", "neutral", "unknown"];

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function oneOf<T extends string>(v: unknown, allowed: readonly string[]): T | "unknown" {
  return typeof v === "string" && allowed.includes(v) ? (v as T) : "unknown";
}

function unit(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
}

function copyProvenance(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  try {
    return structuredClone(v);
  } catch {
    return v;
  }
}

export function createOutcome(input?: OrbOutcomeInput | null): OrbOutcome {
  const i: Record<string, unknown> = input && typeof input === "object" ? input : {};
  return {
    actionId: str(i.actionId),
    expectedOutcome: str(i.expectedOutcome),
    actualOutcome: str(i.actualOutcome),
    outcomeStatus: oneOf<OrbOutcomeStatus>(i.outcomeStatus, STATUS),
    outcomeMatch: oneOf<OrbOutcomeMatch>(i.outcomeMatch, MATCH),
    usefulness: unit(i.usefulness),
    userFeedback: oneOf<OrbUserFeedback>(i.userFeedback, FEEDBACK),
    source: str(i.source),
    createdAt: str(i.createdAt),
    provenance: copyProvenance(i.provenance),
  };
}
