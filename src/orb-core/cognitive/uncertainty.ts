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
  contradictions: OrbUncertaintyContradiction[];
  agreeingSources: OrbInformationSource[];
  unknownFactors: OrbUncertaintyFactorKey[];
  invalidFactors: OrbUncertaintyFactorKey[];
};

/** Beide Seiten eines Widerspruchs bleiben erhalten; keine Wahrheitsentscheidung. */
export type OrbUncertaintyContradiction = {
  incoming: OrbInformationSource;
  existing: OrbInformationSource;
  existingText: string;
};

// Lokale Kopie der Phase-3-Idee ("X ist A" vs "X ist B"); Phase 3 bleibt
// unverändert und wird bewusst nicht importiert (Isolation der Schichten).
const STOP = new Set(
  "der die das ein eine einen und oder ich du er sie es wir ihr mit für von zu im in am an auf ist sind war hat habe weiterhin noch auch the a an and or i you is are was of to in on for with still".split(
    " ",
  ),
);
const COPULA = /\s(?:ist|sind|war|is|are|was)\s/i;
function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of text.toLowerCase().split(/[^\p{L}\p{N}-]+/u))
    if (t.length > 1 && !STOP.has(t)) out.add(t);
  return out;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
function contradicts(a: string, b: string): boolean {
  const pa = a.split(COPULA);
  const pb = b.split(COPULA);
  if (pa.length !== 2 || pb.length !== 2) return false;
  const sa = tokens(pa[0]);
  if (sa.size === 0 || jaccard(sa, tokens(pb[0])) < 1) return false;
  const qa = tokens(pa[1]);
  const qb = tokens(pb[1]);
  return qa.size > 0 && qb.size > 0 && jaccard(qa, qb) === 0;
}

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

  const contradictions: OrbUncertaintyContradiction[] = [];
  const agreeingSources: OrbInformationSource[] = [];
  const text = typeof input.statement === "string" ? input.statement.trim() : "";
  if (input.others !== undefined && text) {
    const valid = input.others.filter(
      (o) => typeof o?.text === "string" && isInformationSource(o.source),
    );
    const tok = tokens(text);
    for (const o of valid) {
      if (contradicts(text, o.text)) {
        contradictions.push({
          incoming: cloneSource(source),
          existing: cloneSource(o.source),
          existingText: o.text,
        });
      } else if (jaccard(tok, tokens(o.text)) >= AGREEMENT_MIN_REPETITION) {
        agreeingSources.push(cloneSource(o.source));
      }
    }
    f.contradiction = contradictions.length > 0 ? 1 : 0;
    const agree = agreeingSources.length;
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
