/**
 * ORB Core – Phase 5: Cognitive Goal Pressure (reine ASSESSMENT LAYER).
 *
 * Wird von KEINEM bestehenden ORB-Pfad importiert. Keine DB, kein fetch,
 * keine Server-/LLM-Aufrufe, keine Nachrichten, keine Uhr, kein Zufall.
 * Ziele werden nur gelesen – nie erstellt, geändert, priorisiert, pausiert
 * oder abgeschlossen. Keine implizite Zielerkennung.
 *
 * Abgrenzung: bestehende priority-Werte (Impulse/Engine) bleiben unverändert.
 * Goal Pressure ≠ Goal Priority ≠ Relevance ≠ Memory Importance ≠ Urgency
 * ≠ Curiosity ≠ Autonomy. Kein Gesamtwert, keine Gewichtung, keine Schwelle.
 * Nicht bestimmbar = null (nicht raten).
 */
import {
  isGoalStatus,
  isInformationSource,
  unitOrNull,
  type OrbGoalStatus,
  type OrbInformationSource,
} from "@/orb-core/cognitive/foundation";

export const GOAL_PRESSURE_FACTOR_KEYS = [
  "goalPriority",
  "contextAlignment",
  "taskContribution",
  "goalRecency",
  "goalStatus",
  "userSignal",
] as const;

export type OrbGoalPressureFactorKey = (typeof GOAL_PRESSURE_FACTOR_KEYS)[number];
export type OrbGoalPressureFactors = Record<OrbGoalPressureFactorKey, number | null>;

/** active kann Druck erzeugen; paused/completed nicht (≠ unwichtig). */
export const GOAL_STATUS_PRESSURE: Readonly<Record<OrbGoalStatus, number>> = Object.freeze({
  active: 1,
  paused: 0,
  completed: 0,
});

/** Tage, nach denen goalRecency 0 erreicht. Kein Prioritätseffekt. */
export const GOAL_RECENCY_HORIZON_DAYS = 30;

/** Nur explizite Benutzeraussagen. Verhalten (Schweigen, Länge, Emoji …) zählt nie. */
export type OrbExplicitGoalSignal = {
  kind: "explicit_user_statement";
  /** 0 = zurückgestellt ("später"), 1 = "wichtigstes Ziel". */
  strength: number;
  messageId?: string;
};

export type OrbGoalPressureInput = {
  goal?: unknown;
  /** Extern bestimmte Werte; ohne Angabe null (keine eigene Semantik-KI). */
  contextAlignment?: unknown;
  taskContribution?: unknown;
  /** Zeitpunkt einer ausdrücklichen Erwähnung durch den Benutzer (ISO). */
  explicitlyMentionedAt?: string | null;
  now?: string | null;
  userSignal?: unknown;
  source?: unknown;
};

export type OrbGoalPressureAssessment = {
  goalId: string | null;
  factors: OrbGoalPressureFactors;
  /** Nur Anteil bestimmbarer Faktoren. */
  confidence: number;
  provenance: OrbInformationSource;
  basedOnInference: boolean;
  unknownFactors: OrbGoalPressureFactorKey[];
  invalidFactors: OrbGoalPressureFactorKey[];
};

function cloneSource(s: OrbInformationSource): OrbInformationSource {
  return s.type === "inference" ? { type: "inference", sourceIds: [...s.sourceIds] } : { ...s };
}

function isExplicitSignal(v: unknown): v is OrbExplicitGoalSignal {
  return (
    !!v && typeof v === "object" && (v as { kind?: unknown }).kind === "explicit_user_statement"
  );
}

export function assessCognitiveGoalPressure(
  input: OrbGoalPressureInput = {},
): OrbGoalPressureAssessment {
  const invalidFactors: OrbGoalPressureFactorKey[] = [];
  const unit = (key: OrbGoalPressureFactorKey, v: unknown): number | null => {
    if (v === undefined || v === null) return null;
    const n = unitOrNull(v);
    if (n === null) invalidFactors.push(key);
    return n;
  };

  const g =
    input.goal && typeof input.goal === "object" ? (input.goal as Record<string, unknown>) : null;
  const goalId = g && typeof g.id === "string" && g.id ? g.id : null;

  const f: OrbGoalPressureFactors = {
    goalPriority: g ? unit("goalPriority", g.priority) : null,
    contextAlignment: unit("contextAlignment", input.contextAlignment),
    taskContribution: unit("taskContribution", input.taskContribution),
    goalRecency: null,
    goalStatus: g && isGoalStatus(g.status) ? GOAL_STATUS_PRESSURE[g.status] : null,
    userSignal: isExplicitSignal(input.userSignal)
      ? unit("userSignal", input.userSignal.strength)
      : null,
  };

  const nowMs = input.now ? Date.parse(input.now) : NaN;
  let latest = NaN;
  for (const t of [g?.createdAt, g?.updatedAt, input.explicitlyMentionedAt]) {
    const ms = typeof t === "string" ? Date.parse(t) : NaN;
    if (Number.isFinite(ms) && !(latest >= ms)) latest = ms;
  }
  if (Number.isFinite(nowMs) && Number.isFinite(latest)) {
    const days = Math.max(0, nowMs - latest) / 86_400_000;
    f.goalRecency = Math.max(0, 1 - days / GOAL_RECENCY_HORIZON_DAYS);
  }

  const provenance: OrbInformationSource = isInformationSource(input.source)
    ? cloneSource(input.source)
    : { type: "unknown" };
  const unknownFactors = GOAL_PRESSURE_FACTOR_KEYS.filter((k) => f[k] === null);
  return {
    goalId,
    factors: f,
    confidence:
      (GOAL_PRESSURE_FACTOR_KEYS.length - unknownFactors.length) / GOAL_PRESSURE_FACTOR_KEYS.length,
    provenance,
    basedOnInference: provenance.type === "inference",
    unknownFactors,
    invalidFactors,
  };
}
