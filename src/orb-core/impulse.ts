/**
 * ORB Core – Proactive Impulse Decision, reine Logik.
 *
 * Diese Datei enthält KEINE Datenbank- und keine Netzwerkzugriffe und ruft
 * keine KI auf. Sie entscheidet deterministisch aus erkannten Lücken:
 *
 *   SPEAK  – es gibt einen nachvollziehbaren Mehrwert für den Nutzer
 *   SILENT – alles andere
 *
 * Goldene Regel: nicht möglichst viel sagen, sondern möglichst oft genau dann,
 * wenn es wirklich sinnvoll ist. Weniger, aber bessere Impulse.
 */

import { clamp01 } from "@/orb-core/core";
import type { DetectedGap, GapType } from "@/orb-core/gaps";
import { similarity } from "@/orb-core/memory";
import { PROACTIVE_COOLDOWN_MS, curiosityBand } from "@/orb-core/presence";

/* --------------------------------------------------------------- Prioritäten */

export type ImpulsePriority = "P0" | "P1" | "P2" | "P3" | "P4";

/** Priorität je Lückenart. P4 wird grundsätzlich nicht proaktiv gefragt. */
export const GAP_PRIORITY: Record<GapType, ImpulsePriority> = {
  contradiction: "P1",
  pending_decision: "P1",
  unresolved_question: "P1",
  incomplete_project: "P2",
  incomplete_goal: "P2",
  ambiguous_preference: "P2",
  missing_information: "P2",
  outdated_information: "P3",
  missing_context: "P3",
  potential_relationship: "P3",
  repeated_topic: "P3",
};

const PRIORITY_ORDER: ImpulsePriority[] = ["P0", "P1", "P2", "P3", "P4"];

/** Ab dieser Priorität wird nicht mehr von selbst gesprochen. */
export const LOWEST_PROACTIVE_PRIORITY: ImpulsePriority = "P3";

export function isProactivePriority(priority: ImpulsePriority): boolean {
  return PRIORITY_ORDER.indexOf(priority) <= PRIORITY_ORDER.indexOf(LOWEST_PROACTIVE_PRIORITY);
}

/** Gewicht der Priorität im Punktwert (nur Bewertung, keine Speicherformel). */
const PRIORITY_BENEFIT: Record<ImpulsePriority, number> = {
  P0: 1,
  P1: 0.95,
  P2: 0.8,
  P3: 0.55,
  P4: 0.2,
};

/* ----------------------------------------------------------------- Punktwert */

export const IMPULSE_MIN_SCORE = 0.2;

/** Ab dieser Ähnlichkeit gilt ein Impuls als bereits gegeben. */
export const IMPULSE_DUPLICATE_SIMILARITY = 0.6;

export type ImpulseScoreInput = {
  gapImportance: number;
  confidence: number;
  futureRelevance: number;
  conversationalFit: number;
  userBenefit: number;
};

/**
 * impulse_score = gap_importance × confidence × future_relevance
 *                 × conversational_fit × user_benefit
 */
export function impulseScore(input: ImpulseScoreInput): number {
  return clamp01(
    clamp01(input.gapImportance) *
      clamp01(input.confidence) *
      clamp01(input.futureRelevance) *
      clamp01(input.conversationalFit) *
      clamp01(input.userBenefit),
  );
}

/* --------------------------------------------------------- Nutzerkontrolle */

const DECLINE_RE =
  /(nicht jetzt|später|spaeter|unwichtig|egal|keine ahnung|weiss nicht|weiß nicht|lass (das|es)|frag mich .{0,12}(nicht|nie wieder)|hör auf zu fragen|nie wieder fragen)/i;
const INVITE_RE = /\b(frag (ruhig|gern|gerne|einfach)|du kannst (mich )?(ruhig )?fragen)\b/i;
const PERMANENT_RE =
  /\b(nie wieder|niemals wieder|grundsätzlich nicht|immer|dauerhaft|generell)\b/i;

export type UserImpulsePreference = "allow" | "suppress" | "unset";

/** Erkennt aus den letzten Nutzertexten, ob Impulse gerade erwünscht sind. */
export function readUserControl(texts: string[]): {
  preference: UserImpulsePreference;
  permanent: boolean;
  reason: string;
} {
  for (const text of texts) {
    if (DECLINE_RE.test(text)) {
      return {
        preference: "suppress",
        permanent: PERMANENT_RE.test(text),
        reason: "Der Nutzer möchte dieses Thema gerade nicht vertiefen.",
      };
    }
    if (INVITE_RE.test(text)) {
      return {
        preference: "allow",
        permanent: PERMANENT_RE.test(text),
        reason: "Der Nutzer hat ausdrücklich um Rückfragen gebeten.",
      };
    }
  }
  return { preference: "unset", permanent: false, reason: "Keine Angabe des Nutzers." };
}

/* ------------------------------------------------------------ Entscheidung */

export type ImpulseCandidate = {
  gap: DetectedGap;
  priority: ImpulsePriority;
  score: number;
  reason: string;
};

export type ImpulseDecisionInput = {
  gaps: DetectedGap[];
  /** Bestehender Zustandswert `curiosity` (keine zweite Neugier-Variable). */
  curiosity: number;
  /** Themen des laufenden Gesprächs. */
  conversationTopics?: string[];
  /** Letzte Nutzertexte – für Abbruch-/Freigabe-Erkennung. */
  recentUserTexts?: string[];
  /** Dauerhafte Nutzerpräferenz aus dem Stilprofil. */
  storedPreference?: UserImpulsePreference;
  /** Bereits gestellte eigene Fragen bzw. gegebene Impulse. */
  previousImpulses?: string[];
  /** Inhalte, die im Spiderweb bereits beantwortet vorliegen. */
  knownAnswers?: string[];
  /** Eine eigene Frage ist noch unbeantwortet. */
  openQuestion?: boolean;
  /** Zeitpunkt des letzten eigenen Impulses (ms) oder null. */
  lastImpulseAt: number | null;
  now: number;
};

export type ImpulseDecision = {
  action: "SPEAK" | "STAY_SILENT";
  impulse: ImpulseCandidate | null;
  reason: string;
  /** Alle geprüften Kandidaten, nach Priorität und Punktwert sortiert. */
  candidates: ImpulseCandidate[];
  /** Dauerhaft zu merkende Nutzerpräferenz, falls eindeutig formuliert. */
  rememberPreference: UserImpulsePreference | null;
  /** Der Nutzer möchte gerade keine eigenen Impulse. */
  suppressed: boolean;
};

/** Bewertet die Lücken und wählt deterministisch höchstens einen Impuls. */
export function decideImpulse(input: ImpulseDecisionInput): ImpulseDecision {
  const topics = new Set((input.conversationTopics ?? []).filter(Boolean));
  const previous = input.previousImpulses ?? [];
  const known = input.knownAnswers ?? [];
  const control = readUserControl(input.recentUserTexts ?? []);

  const candidates: ImpulseCandidate[] = [];
  for (const gap of input.gaps) {
    if (gap.expiresAt <= input.now) continue;
    const priority = GAP_PRIORITY[gap.type];
    if (!isProactivePriority(priority)) continue;
    // Bereits gestellt oder bereits bekannt: kein neuer Impuls.
    if (
      previous.some((p) => similarity(gap.suggestedQuestion, p) >= IMPULSE_DUPLICATE_SIMILARITY) ||
      known.some((k) => similarity(gap.suggestedQuestion, k) >= IMPULSE_DUPLICATE_SIMILARITY)
    ) {
      continue;
    }
    const conversationalFit = gap.topic && topics.has(gap.topic) ? 1 : 0.6;
    const score = impulseScore({
      gapImportance: gap.importance,
      confidence: gap.confidence,
      futureRelevance: gap.futureRelevance,
      conversationalFit,
      userBenefit: PRIORITY_BENEFIT[priority],
    });
    candidates.push({
      gap,
      priority,
      score,
      reason: `${gap.reason} Priorität ${priority}, Wert ${score.toFixed(2)}.`,
    });
  }

  candidates.sort((a, b) => {
    const byPriority = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    return byPriority !== 0 ? byPriority : b.score - a.score;
  });

  const rememberPreference =
    control.permanent && control.preference !== "unset" ? control.preference : null;
  const effectivePreference =
    control.preference !== "unset" ? control.preference : (input.storedPreference ?? "unset");
  const suppressed = effectivePreference === "suppress";
  const silent = (reason: string): ImpulseDecision => ({
    action: "STAY_SILENT",
    impulse: null,
    reason,
    candidates,
    rememberPreference,
    suppressed,
  });

  if (suppressed) return silent(control.reason);
  if (input.openQuestion) return silent("Eine eigene Frage ist noch offen – ORB wartet.");

  if (input.lastImpulseAt !== null) {
    const band = curiosityBand(input.curiosity);
    if (input.now - input.lastImpulseAt < PROACTIVE_COOLDOWN_MS[band]) {
      return silent("Abkühlphase nach dem letzten eigenen Impuls.");
    }
  }

  const best = candidates[0];
  if (!best) return silent("Keine Lücke mit nachvollziehbarem Mehrwert.");
  if (best.score < IMPULSE_MIN_SCORE) {
    return silent(`Mehrwert noch zu gering (${best.score.toFixed(2)} < ${IMPULSE_MIN_SCORE}).`);
  }

  return {
    action: "SPEAK",
    impulse: best,
    reason: best.reason,
    candidates,
    rememberPreference,
    suppressed,
  };
}

/** Harte Grenze: wirkt ausschliesslich im ORB-Core-Chat. */
export const IMPULSE_SCOPE = "orb_core_chat_only" as const;
export const IMPULSE_SOCIAL_ACTIONS_ENABLED = false;
