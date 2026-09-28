/**
 * ORB Core – Phase 6: Cognitive Attention (reine ASSESSMENT LAYER).
 *
 * Wird von KEINEM bestehenden ORB-Pfad importiert. Keine DB, kein fetch,
 * keine Server-/LLM-Aufrufe, keine Nachrichten, keine Impulse, keine Uhr,
 * kein Zufall. Zeit nur als Input.
 *
 * Abgrenzung: bestehende Presence-/Idle-/Activity-Logik (presence.ts,
 * use-orb-presence, adaptive trigger) sowie Memory-Activation/-Decay und
 * Energy bleiben unverändert und werden nicht verwendet.
 * Attention ≠ Relevance ≠ Novelty ≠ Uncertainty ≠ Goal Pressure ≠ Curiosity
 * ≠ Autonomy ≠ Priority ≠ Energy. Kein Gesamtscore, keine Schwelle,
 * kein "höchster Wert gewinnt". Nicht bestimmbar = null.
 */
import {
  isInformationSource,
  unitOrNull,
  type OrbInformationSource,
} from "@/orb-core/cognitive/foundation";

export const ATTENTION_FACTOR_KEYS = [
  "currentFocus",
  "focusContinuity",
  "focusSwitchCost",
  "interruption",
  "attentionAvailability",
  "recentAttention",
  "attentionDecay",
] as const;

export type OrbAttentionFactorKey = (typeof ATTENTION_FACTOR_KEYS)[number];
export type OrbAttentionFactors = Record<OrbAttentionFactorKey, number | null>;

/** Minuten, nach denen recentAttention 0 erreicht. */
export const RECENT_ATTENTION_HORIZON_MIN = 60;
/** Minuten, nach denen ein vorheriger Fokus vollständig abgeklungen ist. */
export const ATTENTION_DECAY_HORIZON_MIN = 30;

/** Explizit übergebener Fokus – wird nie erfunden. */
export type OrbAttentionFocus = {
  kind: "conversation" | "task" | "thread" | "user_set";
  id: string;
};

export type OrbAttentionInput = {
  /** Ohne expliziten Fokus sind focus-bezogene Faktoren null. */
  focus?: unknown;
  /** Extern bestimmte Werte (keine eigene Semantik-Interpretation). */
  currentFocus?: unknown;
  focusContinuity?: unknown;
  focusSwitchCost?: unknown;
  interruption?: unknown;
  attentionAvailability?: unknown;
  /** Letzte Aufmerksamkeit für den Kandidaten (ISO). */
  lastAttendedAt?: string | null;
  /** Letzte Aktivität des vorherigen Fokus (ISO). */
  previousFocusLastActiveAt?: string | null;
  now?: string | null;
  source?: unknown;
};

export type OrbAttentionAssessment = {
  focus: OrbAttentionFocus | null;
  factors: OrbAttentionFactors;
  /** Nur Anteil bestimmbarer Faktoren. */
  confidence: number;
  provenance: OrbInformationSource;
  unknownFactors: OrbAttentionFactorKey[];
  invalidFactors: OrbAttentionFactorKey[];
};

const FOCUS_KINDS = new Set(["conversation", "task", "thread", "user_set"]);

function readFocus(v: unknown): OrbAttentionFocus | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  if (typeof f.kind !== "string" || !FOCUS_KINDS.has(f.kind)) return null;
  if (typeof f.id !== "string" || f.id.length === 0) return null;
  return { kind: f.kind as OrbAttentionFocus["kind"], id: f.id };
}

function cloneSource(s: OrbInformationSource): OrbInformationSource {
  return s.type === "inference" ? { type: "inference", sourceIds: [...s.sourceIds] } : { ...s };
}

function minutesBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  const a = typeof from === "string" ? Date.parse(from) : NaN;
  const b = typeof to === "string" ? Date.parse(to) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, b - a) / 60_000;
}

export function assessCognitiveAttention(input: OrbAttentionInput = {}): OrbAttentionAssessment {
  const invalidFactors: OrbAttentionFactorKey[] = [];
  const unit = (key: OrbAttentionFactorKey, v: unknown): number | null => {
    if (v === undefined || v === null) return null;
    const n = unitOrNull(v);
    if (n === null) invalidFactors.push(key);
    return n;
  };
  const focus = readFocus(input.focus);

  const f: OrbAttentionFactors = {
    currentFocus: focus ? unit("currentFocus", input.currentFocus) : null,
    focusContinuity: focus ? unit("focusContinuity", input.focusContinuity) : null,
    focusSwitchCost: focus ? unit("focusSwitchCost", input.focusSwitchCost) : null,
    interruption: unit("interruption", input.interruption),
    attentionAvailability: unit("attentionAvailability", input.attentionAvailability),
    recentAttention: null,
    attentionDecay: null,
  };

  const sinceAttended = minutesBetween(input.lastAttendedAt, input.now);
  if (sinceAttended !== null)
    f.recentAttention = Math.max(0, 1 - sinceAttended / RECENT_ATTENTION_HORIZON_MIN);
  const sincePrev = minutesBetween(input.previousFocusLastActiveAt, input.now);
  if (sincePrev !== null) f.attentionDecay = Math.min(1, sincePrev / ATTENTION_DECAY_HORIZON_MIN);

  const provenance: OrbInformationSource = isInformationSource(input.source)
    ? cloneSource(input.source)
    : { type: "unknown" };
  const unknownFactors = ATTENTION_FACTOR_KEYS.filter((k) => f[k] === null);
  return {
    focus,
    factors: f,
    confidence:
      (ATTENTION_FACTOR_KEYS.length - unknownFactors.length) / ATTENTION_FACTOR_KEYS.length,
    provenance,
    unknownFactors,
    invalidFactors,
  };
}
