/**
 * ORB Core – Validierung und Deduplizierung der Memory-Kandidaten.
 *
 * Rein und deterministisch: keine KI, keine Datenbank, keine Netzabfrage. Der
 * Validator entscheidet allein, was ins Spiderweb darf. Bestehende Formeln
 * (Wichtigkeit, Schwelle 0.35, Relevanz, Verfall, Reaktivierung) werden hier
 * nicht berührt; VERGESSEN ≠ LÖSCHEN.
 */

import { isSameMemory, normKey, similarity } from "@/orb-core/memory";
import { isReliableMemoryContent } from "@/orb-core/eligibility";
import {
  SCOPE_DECAY,
  type MemoryCandidate,
  type OrbTemporalScope,
} from "@/orb-core/analysis/schema";

export type ExistingNode = {
  id: string;
  content: string;
  normKey: string | null;
  category: string | null;
  longTermValue: number;
  temporalScope: OrbTemporalScope;
};

export type CandidateDecision = "accepted" | "rejected" | "duplicate" | "update" | "contradiction";

export type ValidatedCandidate = {
  candidate: MemoryCandidate;
  decision: CandidateDecision;
  reason: string;
  /** Betroffener bestehender Knoten (bei duplicate / update / contradiction). */
  nodeId: string | null;
  /** Endgültige, vom Core bestätigte Werte. */
  relevance: number;
  longTermValue: number;
  confidence: number;
  temporalScope: OrbTemporalScope;
  decayRate: number;
};

/** Mindest-Sicherheit: darunter wird nichts als Tatsache übernommen. */
export const MIN_CONFIDENCE = 0.55;
/** Mindest-Langzeitwert für einen neuen dauerhaften Knoten. */
export const MIN_LONG_TERM_VALUE = 0.3;
/** Ab hier gelten zwei Inhalte als dasselbe Thema (Vergleich, kein Zusammenführen). */
export const SAME_TOPIC_SIMILARITY = 0.5;

/* ------------------------------------------------ Ausdrückliche Nutzerwünsche */

const REMEMBER_RE = /\b(merk(?:e|st)?\s+dir|speicher|behalte?|nicht\s+vergessen|remember)\b/i;
const TODAY_ONLY_RE =
  /\b(nur\s+(?:für\s+)?(?:heute|jetzt|diesmal|kurz)|nur\s+kurz|für\s+heute|just\s+for\s+today)\b/i;
const FORGET_RE =
  /\b(vergiss|vergessen\s+(?:bitte|das)|lösch(?:e|en)?\s+das|forget\s+(?:that|it))\b/i;

/** Widerspruchsmarker: eine ausdrückliche Änderung gegenüber früher. */
const CHANGE_RE =
  /\b(ab\s+jetzt|ab\s+heute|nicht\s+mehr|stattdessen|neuerdings|inzwischen|doch\s+nicht|from\s+now\s+on)\b/i;

/** Negation im Inhalt – „mag Pizza“ ≠ „mag keine Pizza“. */
const NEGATION_RE = /\b(kein|keine|keinen|nicht|nie|niemals|no|not|never)\b/i;

export type UserSignals = {
  explicitRemember: boolean;
  temporaryOnly: boolean;
  forget: boolean;
  change: boolean;
};

/** Ausdrückliche Steuerbefehle des Benutzers aus dem verfügbaren Kontext. */
export function userSignalsFrom(texts: string[]): UserSignals {
  const joined = texts.join(" \n ");
  return {
    explicitRemember: REMEMBER_RE.test(joined),
    temporaryOnly: TODAY_ONLY_RE.test(joined),
    forget: FORGET_RE.test(joined),
    change: CHANGE_RE.test(joined),
  };
}

function hasNegation(text: string): boolean {
  return NEGATION_RE.test(text);
}

/**
 * Lebenszyklus eines Knotens aus Zeitbezug und Alter. „Vergessen“ heisst hier
 * Gewichts- und Stufenverlust – niemals Löschen.
 */
export type Lifecycle = "active" | "weak" | "stale" | "archived" | "forgotten";

const DAY = 86_400_000;

export function lifecycleFor(input: {
  temporalScope: OrbTemporalScope;
  ageMs: number;
  lastAccessedAgeMs: number;
  forgotten?: boolean;
}): Lifecycle {
  if (input.forgotten) return "forgotten";
  if (input.temporalScope === "persistent") return "active";
  const idleDays = input.lastAccessedAgeMs / DAY;
  if (input.temporalScope === "one_time") {
    if (idleDays >= 7) return "archived";
    if (idleDays >= 1) return "stale";
    return "active";
  }
  if (input.temporalScope === "temporary") {
    if (idleDays >= 30) return "archived";
    if (idleDays >= 7) return "stale";
    if (idleDays >= 2) return "weak";
    return "active";
  }
  // long_term
  if (idleDays >= 180) return "stale";
  if (idleDays >= 60) return "weak";
  return "active";
}

/* ------------------------------------------------------------- Validierung */

/** Kandidat gegen bestehende Knoten und Nutzerwünsche prüfen. */
export function validateCandidate(
  candidate: MemoryCandidate,
  existing: ExistingNode[],
  signals: UserSignals,
): ValidatedCandidate {
  // Ausdrücklicher Wunsch hat immer Vorrang vor der Bewertung der Analyse.
  let temporalScope = candidate.temporalScope;
  let longTermValue = candidate.longTermValue;
  let confidence = candidate.confidence;

  if (signals.explicitRemember) {
    temporalScope = temporalScope === "one_time" ? "long_term" : temporalScope;
    longTermValue = Math.max(longTermValue, 0.9);
    confidence = Math.max(confidence, 0.9);
  }
  if (signals.temporaryOnly) {
    temporalScope = "temporary";
    longTermValue = Math.min(longTermValue, 0.2);
  }

  const decayRate = signals.temporaryOnly
    ? SCOPE_DECAY.temporary
    : temporalScope === "persistent"
      ? 0
      : candidate.decayRate;

  const base = {
    candidate,
    relevance: candidate.relevance,
    longTermValue,
    confidence,
    temporalScope,
    decayRate,
  };

  // Der Wert muss eine belastbare Angabe sein – keine Frage, keine
  // Aufforderung, kein Fragment (bestehende Belastbarkeitsprüfung).
  if (!isReliableMemoryContent(candidate.value)) {
    return {
      ...base,
      decision: "rejected",
      reason: "Kein belastbarer Aussagesatz (Frage, Aufforderung oder Fragment).",
      nodeId: null,
    };
  }

  const match = findRelatedNode(candidate, existing);

  if (signals.forget) {
    return {
      ...base,
      decision: match ? "update" : "rejected",
      reason: match
        ? "Benutzer möchte dies nicht weiter aktiv verwenden – Gewicht und Stufe sinken, nichts wird gelöscht."
        : "Vergessens-Wunsch ohne passende bestehende Erinnerung.",
      nodeId: match?.id ?? null,
    };
  }

  if (confidence < MIN_CONFIDENCE) {
    return {
      ...base,
      decision: "rejected",
      reason: `Unsichere Ableitung (confidence ${confidence.toFixed(2)} < ${MIN_CONFIDENCE}).`,
      nodeId: null,
    };
  }

  if (match) {
    if (isSameMemory(candidate.value, match.content)) {
      return {
        ...base,
        decision: "duplicate",
        reason: "Inhaltlich identisch zu einer bestehenden Erinnerung – nur verstärken.",
        nodeId: match.id,
      };
    }
    const contradicts =
      hasNegation(candidate.value) !== hasNegation(match.content) || signals.change;
    if (contradicts) {
      return {
        ...base,
        decision: "contradiction",
        reason: signals.change
          ? "Ausdrückliche Änderung gegenüber der bisherigen Angabe – bestehender Knoten wird aktualisiert, Historie bleibt."
          : "Gegensätzliche Aussage zum bestehenden Knoten – Aktualisierung mit Historie, keine zweite Erinnerung.",
        nodeId: match.id,
      };
    }
    // P5-PATCH-02: Ein reiner Kategorie-Treffer mit schwacher Similarity
    // (< SAME_TOPIC_SIMILARITY, ohne gleichen norm_key) darf bei
    // create_or_update keinen Content-Overwrite auslösen. Der Kandidat läuft
    // dann durch den normalen Neu-Memory-Pfad unten. reinforce bleibt
    // unverändert (Patch 01 im Apply-Pfad).
    const weakCategoryHit = candidate.action === "create_or_update" && isWeakCategoryHit(candidate, match);
    if (!weakCategoryHit) {
      return {
        ...base,
        decision: "update",
        reason: "Neuere Ausprägung derselben Angabe – bestehender Knoten wird fortgeschrieben.",
        nodeId: match.id,
      };
    }
  }

  if (longTermValue < MIN_LONG_TERM_VALUE && temporalScope !== "temporary") {
    return {
      ...base,
      decision: "rejected",
      reason: `Kein langfristiger Wert (long_term_value ${longTermValue.toFixed(2)}).`,
      nodeId: null,
    };
  }

  return {
    ...base,
    decision: "accepted",
    reason: "Neue belastbare Information mit langfristigem Wert.",
    nodeId: null,
  };
}

/**
 * Passenden bestehenden Knoten finden: gleicher Schlüssel, gleiche Kategorie
 * oder deutliche Wortüberlappung. Bei Unsicherheit kein Treffer – dann
 * entsteht ein eigener Knoten statt einer falschen Zusammenführung.
 */
export function findRelatedNode(
  candidate: MemoryCandidate,
  existing: ExistingNode[],
): ExistingNode | null {
  const key = normKey(candidate.value);
  let best: { node: ExistingNode; score: number } | null = null;
  for (const node of existing) {
    let score = 0;
    if (key && node.normKey && key === node.normKey) score = 1;
    else {
      const sim = similarity(candidate.value, node.content);
      const sameCategory = candidate.category !== "other" && candidate.category === node.category;
      if (sameCategory && sim >= 0.2) score = 0.9;
      else if (sim >= SAME_TOPIC_SIMILARITY) score = sim;
    }
    if (score > 0 && (!best || score > best.score)) best = { node, score };
  }
  return best ? best.node : null;
}

/**
 * P5-PATCH-02: true, wenn der Treffer nur über „gleiche Kategorie +
 * similarity ≥ 0.2“ entstand – kein gleicher norm_key und similarity unter
 * SAME_TOPIC_SIMILARITY.
 */
export function isWeakCategoryHit(candidate: MemoryCandidate, match: ExistingNode): boolean {
  const key = normKey(candidate.value);
  if (key && match.normKey && key === match.normKey) return false;
  return similarity(candidate.value, match.content) < SAME_TOPIC_SIMILARITY;
}

/** Bündelt die Prüfung aller Kandidaten in stabiler Reihenfolge. */
export function validateCandidates(
  candidates: MemoryCandidate[],
  existing: ExistingNode[],
  signals: UserSignals,
): ValidatedCandidate[] {
  return candidates.map((c) => validateCandidate(c, existing, signals));
}
