/**
 * ORB Digital Brain – Phase 2F: Reversible Memory Lifecycle.
 *
 * Reine Entscheidungsregel: keine DB, keine Persistenz, keine KI, nicht im Chat.
 * Zustände sind logische Entscheidungen (keine Spalten).
 *
 * Fristen und Schwelle werden NICHT erfunden: fehlen sie, entscheidet die Regel
 * nicht automatisch (`parameter_missing`).
 */
export type BrainState = "active" | "dormant" | "expired" | "protected";

export interface LifecycleParams {
  /** Zeit ohne belegten Beitrag (Phase 2E „contributed") bis zur Ruhe. */
  dormantAfterMs?: number;
  /** Ruhezeit bis zum Auslaufen. */
  expireAfterMs?: number;
  /** Ab dieser gespeicherten Wichtigkeit ist eine Erinnerung geschützt. */
  importanceThreshold?: number;
}

export interface LifecycleMemory {
  state: BrainState | null | undefined;
  importance: number | null | undefined;
  /** Ausdrücklich dauerhaft relevant (z. B. Name, Allergie). */
  durable?: boolean;
  knowledgeClass: "confirmed" | "inferred" | null | undefined;
  /** Letzter belegter Beitrag (2E). Abruf/Häufigkeit zählt hier nie. */
  lastContributedAt: number | null | undefined;
  dormantSince?: number | null;
  /** Steht in einem offenen Widerspruch (2D). */
  inOpenContradiction?: boolean;
}

export interface LifecycleSignals {
  now: number;
  /** Erneut belegt beigetragen (2E contributed). */
  contributedAgain?: boolean;
  /** Nutzer hat den Inhalt ausdrücklich bestätigt. */
  userConfirmed?: boolean;
}

export type LifecycleReason =
  | "unknown_data"
  | "parameter_missing"
  | "protected_importance"
  | "protected_durable"
  | "open_contradiction_hold"
  | "no_usage_evidence_hold"
  | "still_relevant"
  | "relevance_declined"
  | "reactivated"
  | "dormant_within_retention"
  | "retention_elapsed"
  | "expired_needs_new_statement"
  | "expired_final";

export interface LifecycleDecision {
  next: BrainState;
  changed: boolean;
  reason: LifecycleReason;
  /** Nur bei ausgelaufenen Einträgen: Bestätigung erzeugt neue Aussage, keine stille Reaktivierung. */
  requiresNewStatement?: boolean;
}

const STATES: readonly BrainState[] = ["active", "dormant", "expired", "protected"];
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function decideLifecycle(
  m: LifecycleMemory,
  p: LifecycleParams,
  s: LifecycleSignals,
): LifecycleDecision {
  const keep = (state: BrainState, reason: LifecycleReason): LifecycleDecision => ({
    next: state,
    changed: false,
    reason,
  });
  const go = (from: BrainState, to: BrainState, reason: LifecycleReason): LifecycleDecision => ({
    next: to,
    changed: from !== to,
    reason,
  });

  // Unbekannte/unvollständige Daten: konservativ, keine Änderung, abrufbar bleiben.
  if (!m.state || !STATES.includes(m.state) || !finite(s.now)) return keep("active", "unknown_data");
  const state = m.state;

  // Ausgelaufen: nie automatisch zurück; Bestätigung → neue Aussage.
  if (state === "expired") {
    if (s.userConfirmed) return { ...keep("expired", "expired_needs_new_statement"), requiresNewStatement: true };
    return keep("expired", "expired_final");
  }

  // Schutz: nur gespeicherte Wichtigkeit oder ausdrücklich dauerhaft – nie Häufigkeit.
  if (m.durable) return go(state, "protected", "protected_durable");
  if (finite(m.importance) && finite(p.importanceThreshold) && m.importance >= p.importanceThreshold) {
    return go(state, "protected", "protected_importance");
  }
  if (state === "protected") {
    // Schutzgrund nicht mehr belegbar (z. B. Schwelle fehlt) → konservativ halten.
    if (!finite(p.importanceThreshold) || !finite(m.importance)) return keep("protected", "parameter_missing");
    return go(state, "active", "still_relevant");
  }

  // Widersprüche werden nicht automatisch über den Lebenszyklus aufgelöst.
  if (m.inOpenContradiction) return keep(state, "open_contradiction_hold");

  if (state === "dormant") {
    if (s.contributedAgain || s.userConfirmed) return go(state, "active", "reactivated");
    if (!finite(p.expireAfterMs)) return keep("dormant", "parameter_missing");
    if (!finite(m.dormantSince)) return keep("dormant", "unknown_data");
    return s.now - m.dormantSince >= p.expireAfterMs
      ? go(state, "expired", "retention_elapsed")
      : keep("dormant", "dormant_within_retention");
  }

  // active
  if (s.contributedAgain || s.userConfirmed) return keep("active", "still_relevant");
  if (!finite(p.dormantAfterMs) || !finite(p.importanceThreshold)) return keep("active", "parameter_missing");
  if (!finite(m.importance)) return keep("active", "unknown_data");
  // Ohne jeden Nutzungsnachweis kann kein Rückgang belegt werden.
  if (!finite(m.lastContributedAt)) return keep("active", "no_usage_evidence_hold");
  return s.now - m.lastContributedAt >= p.dormantAfterMs
    ? go(state, "dormant", "relevance_declined")
    : keep("active", "still_relevant");
}
