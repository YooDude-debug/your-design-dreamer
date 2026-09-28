/**
 * ORB Core – Phase 4: Cognitive Uncertainty (reine ASSESSMENT LAYER).
 *
 * Wird von KEINEM bestehenden ORB-Pfad importiert. Keine DB, kein fetch,
 * keine Server-/LLM-Aufrufe, keine Nachrichten, keine Memory-Writes, kein
 * Retrieval, kein Autonomy Gate. Deterministisch (keine Uhr, kein Zufall).
 *
 * Hoher Wert = MEHR Unsicherheit (0 = keine, 1 = maximal).
 * Cognitive Uncertainty ≠ 1 - confidence ≠ Relevance ≠ Novelty
 * ≠ Memory Importance ≠ Retrieval Score ≠ Curiosity ≠ Autonomy.
 * Bestehende confidence-Werte (Memory/Extraction) bleiben unverändert.
 *
 * Es wird nie entschieden, was wahr ist. Fehlende Evidenz ≠ falsch.
 * Kein Gesamtscore, keine Gewichtung. Nicht bestimmbar = null.
 */
import {
  isInformationSource,
  unitOrNull,
  type OrbInformationSource,
} from "@/orb-core/cognitive/foundation";
import { assessCognitiveNovelty, type OrbContradiction } from "@/orb-core/cognitive/novelty";

export const UNCERTAINTY_FACTOR_KEYS = [
  "sourceCertainty",
  "sourceAgreement",
  "contradiction",
  "inferenceDependency",
  "recencyUncertainty",
  "missingEvidence",
] as const;

export type OrbUncertaintyFactorKey = (typeof UNCERTAINTY_FACTOR_KEYS)[number];
export type OrbUncertaintyFactors = Record<OrbUncertaintyFactorKey, number | null>;

/**
 * Quellenklarheit als Unsicherheitsbeitrag je Herkunftsart. Nur Ordnung
 * (memory < conversation < inference < unknown), keine Wahrheitsaussage.
 */
export const SOURCE_UNCERTAINTY: Readonly<Record<OrbInformationSource["type"], number>> =
  Object.freeze({
    memory: 0.1,
    conversation: 0.2,
    inference: 0.6,
    unknown: 1,
  });

/** Tage, nach denen zeitabhängige Information maximal unsicher gilt. */
export const TIME_DEPENDENT_HORIZON_DAYS = 30;
/** Ab dieser Wort-Übereinstimmung stimmt eine andere Quelle überein. */
export const AGREEMENT_MIN_REPETITION = 0.5;

export type OrbSourcedStatement = { text: string; source: OrbInformationSource };

export type OrbUncertaintyInput = {
  statement?: string | null;
  source?: unknown;
  /** Ableitungsstufen einer Inference (A→B→C = 2). Standard 1. */
  inferenceDepth?: number;
  /** Andere Quellen zum selben Sachverhalt. undefined = nicht verfügbar. */
  others?: readonly OrbSourcedStatement[];
  /** Nur wenn true, darf Zeit Unsicherheit erhöhen. undefined = unbekannt. */
  timeDependent?: boolean;
  observedAt?: string | null;
  now?: string | null;
  factors?: Partial<Record<OrbUncertaintyFactorKey, unknown>>;
};

export type OrbUncertaintyAssessment = {
  factors: OrbUncertaintyFactors;
  /** Nur Anteil bestimmbarer Faktoren – KEINE Aussage über Sicherheit. */
  confidence: number;
  provenance: OrbInformationSource;
  basedOnInference: boolean;
  contradictions: OrbContradiction[];
  agreeingSources: OrbInformationSource[];
  unknownFactors: OrbUncertaintyFactorKey[];
  invalidFactors: OrbUncertaintyFactorKey[];
};

function cloneSource(s: OrbInformationSource): OrbInformationSource {
  return s.type === "inference" ? { type: "inference", sourceIds: [...s.sourceIds] } : { ...s };
}

export function assessCognitiveUncertainty(
  input: OrbUncertaintyInput = {},
): OrbUncertaintyAssessment {
  const source: OrbInformationSource = isInformationSource(input.source)
    ? cloneSource(input.source)
    : { type: "unknown" };
  const f: OrbUncertaintyFactors = {
    sourceCertainty: SOURCE_UNCERTAINTY[source.type],
    sourceAgreement: null,
    contradiction: null,
    inferenceDependency: null,
    recencyUncertainty: null,
    missingEvidence: source.type === "unknown" ? 1 : 0,
  };

  if (source.type === "memory" || source.type === "conversation") f.inferenceDependency = 0;
  if (source.type === "inference") {
    const d = input.inferenceDepth;
    const depth = typeof d === "number" && Number.isFinite(d) && d >= 1 ? Math.floor(d) : 1;
    f.inferenceDependency = 1 - Math.pow(0.5, depth);
  }

  let contradictions: OrbContradiction[] = [];
  const agreeingSources: OrbInformationSource[] = [];
  const text = typeof input.statement === "string" ? input.statement.trim() : "";
  if (input.others !== undefined && text) {
    const valid = input.others.filter(
      (o) => typeof o?.text === "string" && isInformationSource(o.source),
    );
    const nov = assessCognitiveNovelty({ statement: text, source, known: valid });
    contradictions = nov.contradictions;
    f.contradiction = contradictions.length > 0 ? 1 : 0;
    let agree = 0;
    for (const o of valid) {
      const r = assessCognitiveNovelty({ statement: text, known: [o] });
      if (r.contradictions.length > 0) continue;
      if ((r.factors.repetition ?? 0) >= AGREEMENT_MIN_REPETITION) {
        agree++;
        agreeingSources.push(cloneSource(o.source));
      }
    }
    const disagree = contradictions.length;
    if (agree + disagree > 0) f.sourceAgreement = disagree / (agree + disagree);
  }

  if (input.timeDependent === false) f.recencyUncertainty = 0;
  else if (input.timeDependent === true) {
    const obs = input.observedAt ? Date.parse(input.observedAt) : NaN;
    const now = input.now ? Date.parse(input.now) : NaN;
    if (Number.isFinite(obs) && Number.isFinite(now)) {
      const days = Math.max(0, now - obs) / 86_400_000;
      f.recencyUncertainty = Math.min(1, days / TIME_DEPENDENT_HORIZON_DAYS);
    }
  }

  const invalidFactors: OrbUncertaintyFactorKey[] = [];
  const overrides = input.factors ?? {};
  for (const key of UNCERTAINTY_FACTOR_KEYS) {
    if (!(key in overrides)) continue;
    const v = overrides[key];
    if (v === undefined || v === null) {
      f[key] = null;
      continue;
    }
    const n = unitOrNull(v);
    f[key] = n;
    if (n === null) invalidFactors.push(key);
  }
  const unknownFactors = UNCERTAINTY_FACTOR_KEYS.filter((k) => f[k] === null);
  return {
    factors: f,
    confidence:
      (UNCERTAINTY_FACTOR_KEYS.length - unknownFactors.length) / UNCERTAINTY_FACTOR_KEYS.length,
    provenance: source,
    basedOnInference: source.type === "inference",
    contradictions,
    agreeingSources,
    unknownFactors,
    invalidFactors,
  };
}
