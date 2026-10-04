/**
 * ORB Digital Brain – Phase 2F + 2G: Reversible Memory Lifecycle mit Schutz.
 *
 * Eine einzige, reine Entscheidungsregel: keine DB, keine Persistenz, keine KI,
 * nicht im Chat. Zustände sind logische Entscheidungen (keine Spalten).
 *
 * Feste Reihenfolge: Schutz → Widerspruch → Nutzungsnachweis → Lebenszyklus.
 */
export type BrainState = "active" | "dormant" | "expired" | "protected";

/** Kategorien, die dauerhaft schützen (2G). */
export type ProtectionCategory =
  | "identity"
  | "long_term_preference"
  | "skill_background"
  | "long_term_project"
  | "important_decision"
  | "user_marked_durable"
  | "medical";

export interface LifecycleParams {
  /** Zeit ohne belegten Beitrag (2E „contributed") bis zur Ruhe. */
  dormantAfterMs?: number;
  /** Ruhezeit bis zum Auslaufen. */
  expireAfterMs?: number;
  /** Ab dieser gespeicherten Wichtigkeit ist eine Erinnerung geschützt. */
  importanceThreshold?: number;
}

const DAY = 24 * 60 * 60 * 1000;
/** Verbindliche Parameter aus Phase 2G. */
export const PHASE_2G_PARAMS: Required<LifecycleParams> = {
  dormantAfterMs: 90 * DAY,
  expireAfterMs: 180 * DAY,
  importanceThreshold: 0.75,
};

export interface LifecycleMemory {
  state: BrainState | null | undefined;
  importance: number | null | undefined;
  /** Dauerhafte Schutzkategorie, falls belegt. */
  category?: ProtectionCategory | null;
  /** @deprecated Alias für category="user_marked_durable". */
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
  /** Nutzer markiert ausdrücklich als dauerhaft. */
  userMarkedDurable?: boolean;
  /** Schutzgrund nachvollziehbar weggefallen (z. B. Nutzer hebt Markierung auf). */
  protectionWithdrawn?: boolean;
  /** Mögliche Veränderung erkannt (z. B. neue, abweichende Aussage). */
  possibleChange?: boolean;
}

export type LifecycleReason =
  | "unknown_data"
  | "parameter_missing"
  | "protected_importance"
  | "protected_category"
  | "protected_user_confirmed"
  | "protection_withdrawn"
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
  /** Ausgelaufen + Bestätigung: neue Aussage anlegen, keine stille Reaktivierung. */
  requiresNewStatement?: boolean;
  /** Aktualität ungeklärt: alte Angabe nicht blind als aktuell darstellen. */
  currency?: "unresolved";
}

const STATES: readonly BrainState[] = ["active", "dormant", "expired", "protected"];
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function protectionReason(
  m: LifecycleMemory,
  p: LifecycleParams,
  s: LifecycleSignals,
): LifecycleReason | null {
  if (s.protectionWithdrawn) return null;
  if (m.category || m.durable) return "protected_category";
  if (s.userMarkedDurable) return "protected_user_confirmed";
  if (finite(m.importance) && finite(p.importanceThreshold) && m.importance >= p.importanceThreshold) {
    return "protected_importance";
  }
  return null;
}

export function decideLifecycle(
  m: LifecycleMemory,
  p: LifecycleParams,
  s: LifecycleSignals,
): LifecycleDecision {
  const make = (from: BrainState, to: BrainState, reason: LifecycleReason): LifecycleDecision => {
    const d: LifecycleDecision = { next: to, changed: from !== to, reason };
    if (s.possibleChange && (m.category === "medical" || to === "protected")) d.currency = "unresolved";
    return d;
  };

  // Unbekannte/unvollständige Daten: konservativ, keine Änderung, abrufbar bleiben.
  if (!m.state || !STATES.includes(m.state) || !finite(s.now)) return make("active", "active", "unknown_data");
  const state = m.state;

  // Ausgelaufen: nie automatisch zurück; Bestätigung → neue Aussage.
  if (state === "expired") {
    if (s.userConfirmed || s.userMarkedDurable) {
      return { ...make("expired", "expired", "expired_needs_new_statement"), requiresNewStatement: true };
    }
    return make("expired", "expired", "expired_final");
  }

  // 1. Schutz (Vorrang). Häufigkeit und fehlender Nachweis spielen hier keine Rolle.
  const prot = protectionReason(m, p, s);
  if (prot) return make(state, "protected", prot);
  if (state === "protected") {
    // Aufhebung nur bei nachvollziehbar weggefallenem Grund; sonst halten.
    if (s.protectionWithdrawn) return make(state, "active", "protection_withdrawn");
    if (!finite(p.importanceThreshold) || !finite(m.importance)) {
      return make(state, "protected", "parameter_missing");
    }
    return make(state, "protected", "protected_importance");
  }

  // 2. Offener Widerspruch: Zustand unverändert.
  if (m.inOpenContradiction) return make(state, state, "open_contradiction_hold");

  // 3. Nutzungsnachweis.
  if (s.contributedAgain || s.userConfirmed) {
    return make(state, "active", state === "dormant" ? "reactivated" : "still_relevant");
  }

  // 4. Lebenszyklus.
  if (state === "dormant") {
    if (!finite(p.expireAfterMs)) return make(state, state, "parameter_missing");
    if (!finite(m.dormantSince)) return make(state, state, "unknown_data");
    return s.now - m.dormantSince >= p.expireAfterMs
      ? make(state, "expired", "retention_elapsed")
      : make(state, state, "dormant_within_retention");
  }
  if (!finite(p.dormantAfterMs) || !finite(p.importanceThreshold)) return make(state, state, "parameter_missing");
  if (!finite(m.importance)) return make(state, state, "unknown_data");
  if (!finite(m.lastContributedAt)) return make(state, state, "no_usage_evidence_hold");
  return s.now - m.lastContributedAt >= p.dormantAfterMs
    ? make(state, "dormant", "relevance_declined")
    : make(state, state, "still_relevant");
}
