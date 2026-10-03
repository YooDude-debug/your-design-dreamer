/**
 * ORB Core – Causal Trace (reine Funktionen, keine Datenbank, kein Modell).
 *
 * Hält fest, WELCHE tatsächlich ausgeführte Entscheidung zu einer ORB-Aktion
 * geführt hat: Build-Kennung, geprüfter Bereich, Gate-Ergebnisse, Grenzwerte
 * und die stärksten Kandidaten (nur IDs + Werte, nie Inhalte oder Prompts).
 *
 * Die Funktionen lesen ausschliesslich bereits berechnete Entscheidungswerte
 * und verändern keine Entscheidung. Fehlt ein Wert, steht `null` bzw.
 * `"not_available"` – es wird nichts nachträglich erklärt oder erfunden.
 */

export const NOT_AVAILABLE = "not_available" as const;

/** Wird zur Buildzeit von Vite gesetzt (vite.config.ts → define). */
declare const __ORB_BUILD_ID__: string | undefined;

/**
 * Kennung der tatsächlich gebauten Codeversion (Inhalts-Hash der zur Buildzeit
 * gelesenen Quelldateien). Ohne Build-Wert: `"not_available"`.
 */
export function orbBuildId(): string {
  try {
    return typeof __ORB_BUILD_ID__ === "string" && __ORB_BUILD_ID__.length > 0
      ? __ORB_BUILD_ID__
      : NOT_AVAILABLE;
  } catch {
    return NOT_AVAILABLE;
  }
}

/** Ortsunabhängiger, stabiler ID-Vergleich als letzter Tie-Breaker. */
export function compareIds(a: string | null | undefined, b: string | null | undefined): number {
  const x = a ?? "";
  const y = b ?? "";
  return x < y ? -1 : x > y ? 1 : 0;
}

/* ------------------------------------------------------------- Bereich */

export type ScopeCheckResult = "pass" | "blocked" | "explicit_request";

export type ScopeCheck = {
  /** Fest deklarierte, zulässige Bereiche für autonome Fragen ("a|b|c"). */
  declared_allowed: string;
  /** Bereich, in dem der Aufruf tatsächlich lief (aus dem Datenzugang). */
  requested: string | null;
  /** Bereich, den die serverseitige Prüfung tatsächlich verglichen hat. */
  checked: string | null;
  result: ScopeCheckResult;
};

/**
 * Bildet genau die serverseitige Bereichsprüfung ab: ausdrückliche Aufforderung
 * ist keine autonome Frage; sonst nur einer der deklarierten Chat-Bereiche.
 * Ohne Bereichsbindung (null) oder `unassigned` bleibt ORB still.
 */
export function scopeCheckOf(input: {
  allowedScopes: readonly string[];
  runtimeScope: string | null;
  explicit: boolean;
}): ScopeCheck {
  const result: ScopeCheckResult = input.explicit
    ? "explicit_request"
    : input.runtimeScope !== null && input.allowedScopes.includes(input.runtimeScope)
      ? "pass"
      : "blocked";
  return {
    declared_allowed: input.allowedScopes.join("|"),
    requested: input.runtimeScope,
    checked: input.runtimeScope,
    result,
  };
}

/* ------------------------------------------------------------- Gates */

export type GateName = "suppressed" | "no_candidate" | "energy" | "pass";

/**
 * Boolesche Gate-Ergebnisse in Prüfreihenfolge von `finalAutonomyGate`.
 * Nicht mehr erreichte Prüfungen bleiben `null` (nicht ausgewertet).
 */
export function gateFlags(gate: GateName | string | null): {
  suppressed: boolean | null;
  candidate_present: boolean | null;
  energy_ok: boolean | null;
} {
  switch (gate) {
    case "suppressed":
      return { suppressed: true, candidate_present: null, energy_ok: null };
    case "no_candidate":
      return { suppressed: false, candidate_present: false, energy_ok: null };
    case "energy":
      return { suppressed: false, candidate_present: true, energy_ok: false };
    case "pass":
      return { suppressed: false, candidate_present: true, energy_ok: true };
    default:
      return { suppressed: null, candidate_present: null, energy_ok: null };
  }
}

/* ------------------------------------------------------------- Kandidaten */

export type TraceCandidate = { memory_id: string | null; score: number };

/** Die stärksten n Kandidaten – stabil: Wert absteigend, dann ID aufsteigend. */
export function topCandidates(
  list: { memoryId: string | null | undefined; score: number }[],
  n = 3,
): TraceCandidate[] {
  return list
    .map((c) => ({ memory_id: c.memoryId ?? null, score: c.score }))
    .sort((a, b) => b.score - a.score || compareIds(a.memory_id, b.memory_id))
    .slice(0, n);
}

export type LinkLookupStatus = "ok" | "failed" | "not_available";

export type AutonomyTrace = {
  build_id: string;
  scope_check: ScopeCheck;
  gates: ReturnType<typeof gateFlags> & {
    gate: string | null;
    /** Eingangswert: lag eine eigene offene Frage vor? */
    open_question: boolean | null;
  };
  thresholds: {
    min_energy: number;
    impulse_min_score: number;
    question_memory_lock_ms: number;
  };
  energy: number | null;
  curiosity_action: string | null;
  impulse_action: string | null;
  curiosity_top: TraceCandidate[];
  impulse_top: TraceCandidate[];
  selected: { source: string | null; memory_id: string | null; score: number | null } | null;
  impulse: { type: string; priority: string; form: string } | null;
  blocked_reason: string | null;
  link_lookup: LinkLookupStatus;
};

export function buildAutonomyTrace(input: {
  buildId: string;
  scopeCheck: ScopeCheck;
  gate: string | null;
  openQuestion: boolean | null;
  thresholds: AutonomyTrace["thresholds"];
  energy: number | null;
  curiosityAction: string | null;
  impulseAction: string | null;
  curiosityCandidates: { memoryId: string | null | undefined; score: number }[];
  impulseCandidates: { memoryId: string | null | undefined; score: number }[];
  selected: AutonomyTrace["selected"];
  impulse: AutonomyTrace["impulse"];
  blockedReason: string | null;
  linkLookup: LinkLookupStatus;
}): AutonomyTrace {
  return {
    build_id: input.buildId,
    scope_check: input.scopeCheck,
    gates: { gate: input.gate, open_question: input.openQuestion, ...gateFlags(input.gate) },
    thresholds: input.thresholds,
    energy: input.energy,
    curiosity_action: input.curiosityAction,
    impulse_action: input.impulseAction,
    curiosity_top: topCandidates(input.curiosityCandidates),
    impulse_top: topCandidates(input.impulseCandidates),
    selected: input.selected,
    impulse: input.impulse,
    blocked_reason: input.blockedReason,
    link_lookup: input.linkLookup,
  };
}
