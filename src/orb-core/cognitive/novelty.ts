/**
 * ORB Core – Phase 3: Cognitive Novelty (reine ASSESSMENT LAYER).
 *
 * Wird von KEINEM bestehenden ORB-Pfad importiert. Keine DB, kein fetch,
 * keine Server-/LLM-Aufrufe, kein speak, keine Memory-Writes, kein Retrieval,
 * kein Autonomy Gate. Deterministisch; Eingaben werden nie mutiert.
 *
 * Abgrenzung: Die bestehende `novelty` der Knowledge-Gaps (Engine-Server,
 * initiative.ts, continuity.ts) bleibt unverändert und unbenannt. Sie bewertet
 * Frage-Lücken, nicht Informationen.
 * Cognitive Novelty ≠ Memory Importance ≠ Cognitive Relevance ≠ Recency
 * ≠ Retrieval Score ≠ Curiosity Score.
 *
 * Reactivation, Repetition und Contradiction sind eigene Faktoren und werden
 * nie in "neu" umgedeutet. Kein Gesamtscore, keine Schwellen-Entscheidung.
 * Fehlende Daten = null, niemals implizit 0.
 */
import {
  isInformationSource,
  unitOrNull,
  type OrbInformationSource,
} from "@/orb-core/cognitive/foundation";

export const NOVELTY_FACTOR_KEYS = [
  "memoryNovelty",
  "contextNovelty",
  "detailNovelty",
  "reactivation",
  "repetition",
  "contradiction",
] as const;

export type OrbNoveltyFactorKey = (typeof NOVELTY_FACTOR_KEYS)[number];
export type OrbNoveltyFactors = Record<OrbNoveltyFactorKey, number | null>;

export type OrbKnownStatement = {
  text: string;
  source: OrbInformationSource;
  /** ISO-Zeitpunkt der letzten Aktivierung (nur für reactivation). */
  lastActivatedAt?: string | null;
};

export type OrbNoveltyInput = {
  /** Die zu bewertende Information. */
  statement?: string | null;
  /** Herkunft der zu bewertenden Information. */
  source?: unknown;
  /** Bekannte Informationen. undefined = nicht verfügbar; [] = nichts bekannt. */
  known?: readonly OrbKnownStatement[];
  /** Nachrichten des aktuellen Gesprächs. undefined = nicht verfügbar. */
  context?: readonly string[];
  /** Referenzzeit für reactivation (ISO). */
  now?: string | null;
  /** Explizite Faktorwerte; überschreiben Ableitungen (werden normalisiert). */
  factors?: Partial<Record<OrbNoveltyFactorKey, unknown>>;
};

export type OrbContradiction = {
  /** Beide Seiten bleiben erhalten; es wird NICHT entschieden, was wahr ist. */
  incoming: OrbInformationSource;
  existing: OrbInformationSource;
  existingText: string;
};

export type OrbNoveltyAssessment = {
  factors: OrbNoveltyFactors;
  /** Anteil bestimmter Faktoren (Datenabdeckung, keine Gewichtung). */
  confidence: number;
  provenance: OrbInformationSource;
  /** true, wenn die bewertete Information eine Schlussfolgerung ist. */
  basedOnInference: boolean;
  contradictions: OrbContradiction[];
  unknownFactors: OrbNoveltyFactorKey[];
  invalidFactors: OrbNoveltyFactorKey[];
};

/** Horizont, ab dem reactivation = 1 gilt (Tage). Keine Novelty-Gewichtung. */
export const REACTIVATION_HORIZON_DAYS = 180;
/** Mindest-Überlappung, ab der ein Thema als "bekannt/verwandt" gilt. */
export const RELATED_OVERLAP = 0.2;

const STOP = new Set(
  "der die das ein eine einen und oder ich du er sie es wir ihr mit für von zu im in am an auf ist sind war hat habe weiterhin noch auch the a an and or i you is are was of to in on for with still".split(
    " ",
  ),
);
const COPULA = /\s(?:ist|sind|war|is|are|was)\s/i;

export function noveltyTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of text.toLowerCase().split(/[^\p{L}\p{N}-]+/u)) {
    if (t.length > 1 && !STOP.has(t)) out.add(t);
  }
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** "X ist A" vs "X ist B": gleiches Subjekt, anderes Prädikat. Keine Wahrheitsentscheidung. */
function isContradiction(a: string, b: string): boolean {
  const pa = a.split(COPULA);
  const pb = b.split(COPULA);
  if (pa.length !== 2 || pb.length !== 2) return false;
  const sa = noveltyTokens(pa[0]);
  const sb = noveltyTokens(pb[0]);
  if (sa.size === 0 || jaccard(sa, sb) < 1) return false;
  const qa = noveltyTokens(pa[1]);
  const qb = noveltyTokens(pb[1]);
  return qa.size > 0 && qb.size > 0 && jaccard(qa, qb) === 0;
}

function cloneSource(s: OrbInformationSource): OrbInformationSource {
  return s.type === "inference" ? { type: "inference", sourceIds: [...s.sourceIds] } : { ...s };
}

function derive(input: OrbNoveltyInput): {
  factors: OrbNoveltyFactors;
  contradictions: OrbContradiction[];
  incoming: OrbInformationSource;
} {
  const incoming = isInformationSource(input.source)
    ? cloneSource(input.source)
    : { type: "unknown" as const };
  const f: OrbNoveltyFactors = {
    memoryNovelty: null,
    contextNovelty: null,
    detailNovelty: null,
    reactivation: null,
    repetition: null,
    contradiction: null,
  };
  const contradictions: OrbContradiction[] = [];
  const text = typeof input.statement === "string" ? input.statement.trim() : "";
  if (!text) return { factors: f, contradictions, incoming };
  const tok = noveltyTokens(text);

  if (input.context !== undefined) {
    let max = 0;
    for (const m of input.context) max = Math.max(max, jaccard(tok, noveltyTokens(m)));
    f.contextNovelty = 1 - max;
  }

  if (input.known !== undefined) {
    let rep = 0;
    const related: OrbKnownStatement[] = [];
    for (const k of input.known) {
      const kt = noveltyTokens(k.text);
      rep = Math.max(rep, jaccard(tok, kt));
      if (overlap(tok, kt) >= RELATED_OVERLAP) related.push(k);
      if (isContradiction(text, k.text) && isInformationSource(k.source)) {
        contradictions.push({
          incoming: cloneSource(incoming),
          existing: cloneSource(k.source),
          existingText: k.text,
        });
      }
    }
    f.repetition = rep;
    f.memoryNovelty = 1 - rep;
    f.contradiction = contradictions.length > 0 ? 1 : 0;
    if (related.length > 0) {
      const union = new Set<string>();
      for (const r of related) for (const t of noveltyTokens(r.text)) union.add(t);
      let fresh = 0;
      for (const t of tok) if (!union.has(t)) fresh++;
      f.detailNovelty = tok.size ? fresh / tok.size : null;

      const nowMs = input.now ? Date.parse(input.now) : NaN;
      let latest = NaN;
      for (const r of related) {
        const ms = r.lastActivatedAt ? Date.parse(r.lastActivatedAt) : NaN;
        if (Number.isFinite(ms) && !(latest >= ms)) latest = ms;
      }
      if (Number.isFinite(nowMs) && Number.isFinite(latest)) {
        const days = Math.max(0, nowMs - latest) / 86_400_000;
        f.reactivation = Math.min(1, days / REACTIVATION_HORIZON_DAYS);
      }
    }
  }
  return { factors: f, contradictions, incoming };
}

export function assessCognitiveNovelty(input: OrbNoveltyInput = {}): OrbNoveltyAssessment {
  const { factors, contradictions, incoming } = derive(input);
  const overrides = input.factors ?? {};
  const invalidFactors: OrbNoveltyFactorKey[] = [];
  for (const key of NOVELTY_FACTOR_KEYS) {
    if (!(key in overrides)) continue;
    const v = overrides[key];
    if (v === undefined || v === null) {
      factors[key] = null;
      continue;
    }
    const n = unitOrNull(v);
    factors[key] = n;
    if (n === null) invalidFactors.push(key);
  }
  for (const key of NOVELTY_FACTOR_KEYS) {
    const v = factors[key];
    if (v !== null) factors[key] = unitOrNull(v);
  }
  const unknownFactors = NOVELTY_FACTOR_KEYS.filter((k) => factors[k] === null);
  return {
    factors,
    confidence: (NOVELTY_FACTOR_KEYS.length - unknownFactors.length) / NOVELTY_FACTOR_KEYS.length,
    provenance: incoming,
    basedOnInference: incoming.type === "inference",
    contradictions,
    unknownFactors,
    invalidFactors,
  };
}
