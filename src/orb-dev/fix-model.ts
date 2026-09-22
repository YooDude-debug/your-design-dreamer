/**
 * ORB Developer / Repair Environment – reines Modell (browser- und servertauglich).
 *
 * Diese Datei enthält KEINE Schreiboperationen, keinen Dateizugriff, keine
 * Datenbank und keinen LLM-Aufruf. Sie definiert ausschliesslich:
 *  · Phasenmodell (ANALYZING … COMPLETED / ROLLED_BACK)
 *  · Fix-ID und Fix-Fingerabdruck
 *  · Approval-Bindung und Approval-Invalidierung
 *  · Root-Cause-Klassifizierung
 *
 * Grundsatz: Memory, LLM, Graph oder Systemprompt können niemals eine
 * Berechtigung erzeugen. Nur eine ausdrückliche Administrator-Freigabe zählt.
 */

/* ------------------------------------------------------------------ Phasen */

export const FIX_STATES = [
  "DRAFT",
  "ANALYZING",
  "DIAGNOSIS_READY",
  "FIX_PROPOSED",
  "WAITING_FOR_ADMIN_APPROVAL",
  "APPROVED",
  "INVALIDATED",
  "EXECUTION_QUEUED",
  "EXECUTING",
  "PATCH_APPLIED",
  "TESTING",
  "PASSED",
  "FAILED",
  "EXECUTION_FAILED",
  "TEST_FAILED",
  "UNEXPECTED_CHANGE",
  "APPROVAL_INVALID",
  "BLOCKED_OPERATION",
  "TIMEOUT",
  "RESOURCE_LIMIT",
  "SANDBOX_ERROR",
  "COMPLETED",
  "ROLLED_BACK",
] as const;

export type FixState = (typeof FIX_STATES)[number];

/** Erlaubte Übergänge. Alles andere ist ungültig (keine Abkürzungen). */
export const ALLOWED_TRANSITIONS: Record<FixState, FixState[]> = {
  DRAFT: ["ANALYZING", "FAILED"],
  ANALYZING: ["DIAGNOSIS_READY", "FAILED"],
  DIAGNOSIS_READY: ["FIX_PROPOSED", "FAILED"],
  FIX_PROPOSED: ["WAITING_FOR_ADMIN_APPROVAL", "FAILED"],
  WAITING_FOR_ADMIN_APPROVAL: ["APPROVED", "INVALIDATED", "FAILED"],
  APPROVED: ["EXECUTION_QUEUED", "EXECUTING", "INVALIDATED", "FAILED"],
  INVALIDATED: [],
  EXECUTION_QUEUED: [
    "EXECUTING",
    "APPROVAL_INVALID",
    "BLOCKED_OPERATION",
    "SANDBOX_ERROR",
    "FAILED",
  ],
  EXECUTING: [
    "PATCH_APPLIED",
    "TESTING",
    "EXECUTION_FAILED",
    "UNEXPECTED_CHANGE",
    "TIMEOUT",
    "RESOURCE_LIMIT",
    "SANDBOX_ERROR",
    "FAILED",
  ],
  PATCH_APPLIED: ["TESTING", "UNEXPECTED_CHANGE", "EXECUTION_FAILED", "SANDBOX_ERROR", "FAILED"],
  TESTING: ["PASSED", "TEST_FAILED", "TIMEOUT", "RESOURCE_LIMIT", "FAILED"],
  PASSED: ["COMPLETED", "ROLLED_BACK"],
  FAILED: ["ROLLED_BACK"],
  // Fehlzustände sind endgültig: kein automatischer Neuversuch, kein Weiterlauf.
  EXECUTION_FAILED: [],
  TEST_FAILED: [],
  UNEXPECTED_CHANGE: [],
  APPROVAL_INVALID: [],
  BLOCKED_OPERATION: [],
  TIMEOUT: [],
  RESOURCE_LIMIT: [],
  SANDBOX_ERROR: [],
  COMPLETED: [],
  ROLLED_BACK: [],
};

export function canTransition(from: FixState, to: FixState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Harter Sicherheitszustand: ohne Freigabe niemals eine Schreiboperation. */
export const APPROVAL_GATE_STATE: FixState = "WAITING_FOR_ADMIN_APPROVAL";

/* ------------------------------------------------------------- Root Cause */

export const ROOT_CAUSE_LEVELS = [
  "ROOT_CAUSE_PROVEN",
  "ROOT_CAUSE_PLAUSIBLE",
  "ROOT_CAUSE_UNKNOWN",
] as const;

export type RootCauseLevel = (typeof ROOT_CAUSE_LEVELS)[number];

/** Nur eine bewiesene Ursache darf überhaupt zu einem Fix-Vorschlag führen. */
export function mayProposeRepair(level: RootCauseLevel): boolean {
  return level === "ROOT_CAUSE_PROVEN";
}

/* ----------------------------------------------------------------- Fix-ID */

/** `ORB-FIX-0001` – stabil, fortlaufend, nicht wiederverwendbar. */
export function formatFixId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("Invalid fix sequence");
  return `ORB-FIX-${String(sequence).padStart(4, "0")}`;
}

export const FIX_ID_RE = /^ORB-FIX-\d{4}$/;

export function isFixId(value: string): boolean {
  return FIX_ID_RE.test(value);
}

/* ------------------------------------------------------------ Fix-Vorschlag */

export type FixOperation =
  | { kind: "edit_file"; path: string }
  | { kind: "run_command"; command: string }
  | { kind: "run_migration"; name: string };

export type FixProposal = {
  fixId: string;
  createdAt: string;
  /** Quelle des Vorschlags – dokumentarisch, niemals berechtigend. */
  createdBy: "orb_diagnostic" | "admin";
  rootCause: string;
  rootCauseLevel: RootCauseLevel;
  files: string[];
  /** Exakter, vollständiger Diff-Text. */
  diff: string;
  /** Geplante, ausdrücklich erlaubte Operationen. */
  operations: FixOperation[];
  testPlan: string[];
  expectedEffects: string[];
  risks: string[];
  rollbackPlan: string[];
  state: FixState;
};

/**
 * Deterministischer Fingerabdruck über alles, was eine Freigabe bindet.
 * Ändert sich Diff, Datei, Befehl, Migration oder Testplan, ändert sich der
 * Fingerabdruck – und die alte Freigabe ist damit ungültig.
 */
export function fixFingerprint(p: FixProposal): string {
  const payload = JSON.stringify({
    fixId: p.fixId,
    rootCause: p.rootCause,
    rootCauseLevel: p.rootCauseLevel,
    files: [...p.files].sort(),
    diff: p.diff,
    operations: p.operations.map((o) => JSON.stringify(o)).sort(),
    testPlan: p.testPlan,
  });
  // FNV-1a (64 Bit über BigInt) – deterministisch, ohne Node-Abhängigkeit.
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash ^ BigInt(payload.charCodeAt(i))) * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

/* --------------------------------------------------------------- Approval */

/** Nur diese Quelle darf eine Freigabe erzeugen. */
export const APPROVAL_SOURCES = ["admin_ui"] as const;

/** Quellen, die ausdrücklich NIE eine Freigabe erzeugen dürfen. */
export const FORBIDDEN_APPROVAL_SOURCES = [
  "llm",
  "memory",
  "graph",
  "system_prompt",
  "autonomous",
] as const;

export type ApprovalSource = (typeof APPROVAL_SOURCES)[number];

export type FixApproval = {
  fixId: string;
  /** Fingerabdruck des genau freigegebenen Fix-Vorschlags. */
  fingerprint: string;
  /** Ausschliesslich diese Operationen sind freigegeben. */
  operations: FixOperation[];
  approvedBy: string;
  approvedAt: string;
  source: ApprovalSource;
};

export function isApprovalSourceAllowed(source: string): source is ApprovalSource {
  return (APPROVAL_SOURCES as readonly string[]).includes(source);
}

export type ApprovalCheck = { valid: true } | { valid: false; reason: string };

/**
 * Prüft eine Freigabe gegen den aktuellen Vorschlag. Zusätzlich muss die
 * gewünschte Operation wörtlich in der Freigabe enthalten sein.
 */
export function checkApproval(
  proposal: FixProposal,
  approval: FixApproval | null,
  requestedOperation?: FixOperation,
): ApprovalCheck {
  if (!approval) return { valid: false, reason: "Keine Administrator-Freigabe vorhanden." };
  if (!isApprovalSourceAllowed(approval.source))
    return { valid: false, reason: `Freigabequelle nicht erlaubt: ${approval.source}` };
  if (approval.fixId !== proposal.fixId)
    return { valid: false, reason: "Freigabe gehört zu einer anderen Fix-ID." };
  if (approval.fingerprint !== fixFingerprint(proposal))
    return {
      valid: false,
      reason: "Fix wurde nach der Freigabe geändert – Freigabe ist ungültig. Neue Fix-ID nötig.",
    };
  if (proposal.rootCauseLevel !== "ROOT_CAUSE_PROVEN")
    return { valid: false, reason: "Ursache ist nicht bewiesen (ROOT_CAUSE_PROVEN erforderlich)." };
  if (requestedOperation) {
    const wanted = JSON.stringify(requestedOperation);
    if (!approval.operations.some((o) => JSON.stringify(o) === wanted))
      return { valid: false, reason: "Operation ist von dieser Freigabe nicht gedeckt." };
  }
  return { valid: true };
}

/* ------------------------------------------------- Phase-1-Sicherheitsriegel */

/**
 * Phase 1 stellt ausschliesslich die Umgebung bereit. Schreiboperationen am
 * laufenden ORB, Git-Aktionen, Migrationen und Deployments sind hart aus.
 */
export const PHASE1_WRITE_OPERATIONS_ENABLED = false;
export const PHASE1_SELF_MODIFICATION_ENABLED = false;
export const PHASE1_DEPLOYMENT_ENABLED = false;

/**
 * Phase 2 ergänzt ausschliesslich die Persistenz. Ausführung, Selbstveränderung
 * und Deployment bleiben unverändert hart deaktiviert.
 */
export const PHASE2_PERSISTENCE_ENABLED = true;
export const PHASE2_EXECUTION_ENABLED = false;

export type ExecutionCheck = { allowed: false; reason: string };

/**
 * Selbst mit gültiger Freigabe verweigert Phase 1 jede Ausführung. Der
 * laufende ORB kann seinen eigenen Code nicht überschreiben.
 */
export function checkExecutionAllowed(): ExecutionCheck {
  return {
    allowed: false,
    reason:
      "Repair-Ausführung ist deaktiviert (PHASE2_EXECUTION_ENABLED = false). " +
      "Phase 2 speichert nur; Ausführung erfordert eine getrennte Arbeitsumgebung (Phase 3).",
  };
}

/** Memory liefert nur Kontext – niemals Rechte. */
export function memoryGrantsAuthority(): false {
  return false;
}

/* ------------------------------------------------- Phase-3-Sicherheitsriegel */

/**
 * Phase 3 erlaubt ausschliesslich die Ausführung eines bereits freigegebenen
 * Fixes in einer vollständig getrennten Sandbox. Der laufende ORB, Production,
 * Staging und jedes Deployment bleiben unberührt.
 */
export const PHASE3_SANDBOX_EXECUTION_ENABLED = true;
export const PHASE3_LIVE_CODE_WRITE_ENABLED = false;
export const PHASE3_DEPLOYMENT_ENABLED = false;
export const PHASE3_AUTONOMOUS_SELF_REPAIR_ENABLED = false;

/**
 * Ausführung am laufenden Code bleibt unabhängig von jeder Freigabe verboten.
 * Erfolgreiche Sandbox-Tests bedeuten ausschliesslich: der genehmigte Fix
 * funktioniert isoliert. Sie bedeuten nicht „production ready“.
 */
export function checkLiveExecutionAllowed(): ExecutionCheck {
  return {
    allowed: false,
    reason:
      "Änderungen am laufenden oder veröffentlichten Code sind deaktiviert " +
      "(PHASE3_LIVE_CODE_WRITE_ENABLED = false). Erlaubt ist nur die isolierte Sandbox.",
  };
}
