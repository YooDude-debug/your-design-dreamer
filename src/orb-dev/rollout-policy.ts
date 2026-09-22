/**
 * ORB Developer / Repair Environment – Phase 4: Rollout-Richtlinie (rein).
 *
 * Diese Datei enthält KEINEN Dateizugriff, KEINE Prozessausführung, keine
 * Datenbank, keinen Netzzugriff und keinen LLM-Aufruf. Sie beschreibt
 * ausschliesslich, unter welchen Bedingungen ein bereits in der Sandbox
 * getesteter Fix überhaupt Richtung Ziel-System gehen darf.
 *
 * Grundsätze (hart, nicht verhandelbar):
 *   · SANDBOX APPROVAL  != DEPLOYMENT APPROVAL
 *   · FIX APPROVAL      != DEPLOYMENT APPROVAL
 *   · MEMORY / LLM / CHAT != AUTHORIZATION
 *   · Verweigern ist der Standard; erlaubt ist nur, was hier ausdrücklich steht.
 *   · Kein automatischer Neuversuch, kein automatisches Deployment,
 *     kein Rollback ohne ausdrücklich definiertes Kriterium.
 */

import type { FixOperation } from "./fix-model";

/* ----------------------------------------------------------------- Zustände */

/** Zusätzliche Zustände der Deployment-Ebene (Phase 4). */
export const DEPLOYMENT_STATES = [
  "READY_FOR_DEPLOYMENT",
  "DEPLOYMENT_APPROVAL_REQUIRED",
  "DEPLOYMENT_APPROVED",
  "PRE_FLIGHT",
  "DEPLOYING",
  "HEALTH_CHECK",
  "SMOKE_TEST",
  "DEPLOYED",
  "DEPLOYMENT_FAILED",
  "DEPLOYMENT_BLOCKED",
  "DEPLOYMENT_APPROVAL_INVALID",
  "DEPLOYMENT_INTEGRITY_FAILURE",
  "PRODUCTION_BASE_CHANGED",
  "ROLLBACK_REQUIRED",
  "ROLLING_BACK",
  "ROLLED_BACK",
  "DEPLOYMENT_INVALIDATED",
] as const;

export type DeploymentState = (typeof DEPLOYMENT_STATES)[number];

/** Endgültige Fehlzustände: kein automatischer Neuversuch, Human Review nötig. */
export const DEPLOYMENT_FAILURE_STATES: DeploymentState[] = [
  "DEPLOYMENT_FAILED",
  "DEPLOYMENT_BLOCKED",
  "DEPLOYMENT_APPROVAL_INVALID",
  "DEPLOYMENT_INTEGRITY_FAILURE",
  "PRODUCTION_BASE_CHANGED",
  "DEPLOYMENT_INVALIDATED",
];

export function isDeploymentFailure(state: DeploymentState): boolean {
  return DEPLOYMENT_FAILURE_STATES.includes(state);
}

/** Nach jedem Fehlschlag entscheidet ausschliesslich ein Mensch neu. */
export const DEPLOYMENT_AUTO_RETRY_ENABLED = false;

/* ------------------------------------------------------------ Phase-4-Riegel */

/** Phase 4 implementiert Governance und kontrollierten Rollout – nicht mehr. */
export const PHASE4_DEPLOYMENT_GOVERNANCE_ENABLED = true;
/** Es gibt keinen Pfad, der ohne ausdrückliche Menschen-Freigabe deployt. */
export const PHASE4_AUTOMATIC_DEPLOYMENT_ENABLED = false;
/** Sandbox-Erfolg löst niemals ein Deployment aus. */
export const PHASE4_DEPLOY_ON_SANDBOX_PASS_ENABLED = false;
/** Ein Rollout in ein Verifikationsziel (STAGING) ist ausführbar. */
export const PHASE4_STAGING_ROLLOUT_EXECUTION_ENABLED = true;
/**
 * Der letzte Schritt nach Production wird NICHT von ORB ausgeführt. ORB bereitet
 * vor, prüft, verifiziert und protokolliert; die Veröffentlichung selbst löst
 * ausschliesslich ein autorisierter Mensch aus.
 */
export const PHASE4_PRODUCTION_ROLLOUT_EXECUTION_BY_ORB_ENABLED = false;
/** Rollback nur nach ausdrücklich definierten Kriterien. */
export const PHASE4_UNCONDITIONAL_AUTOMATIC_ROLLBACK_ENABLED = false;

/* -------------------------------------------------------------------- Ziele */

export const DEPLOY_TARGETS = ["STAGING", "PRODUCTION"] as const;
export type DeployTarget = (typeof DEPLOY_TARGETS)[number];

/** Es gibt kein „AUTO“ und keine Vorauswahl: das Ziel wird immer benannt. */
export const DEFAULT_DEPLOY_TARGET: null = null;

export function isDeployTarget(value: string): value is DeployTarget {
  return (DEPLOY_TARGETS as readonly string[]).includes(value);
}

/** Wörtliche Bestätigung für Production (Doppelbestätigung, Punkt 19). */
export const PRODUCTION_CONFIRMATION_PHRASE =
  "I confirm deployment of this exact approved and tested fix to Production.";

export const STAGING_CONFIRMATION_PHRASE =
  "I confirm deployment of this exact approved and tested fix to Staging.";

export function confirmationPhraseFor(target: DeployTarget): string {
  return target === "PRODUCTION" ? PRODUCTION_CONFIRMATION_PHRASE : STAGING_CONFIRMATION_PHRASE;
}

/* ------------------------------------------------------------------ Nachweise */

export type VerificationStep = { command: string; exitCode: number | null };

/** Tatsächliche Ausführungsdaten aus der Phase-3-Sandbox. Nicht gesetzte Flags gelten als „nicht erfüllt“. */
export type SandboxEvidence = {
  executionId: string;
  fixId: string;
  fixVersion: number | null;
  fingerprint: string;
  baseCommit: string;
  state: string;
  patchApplied: boolean;
  integrityOk: boolean;
  reproductionConfirmed: boolean;
  steps: VerificationStep[];
  finalDiff: string;
};

/** Pflichtprüfungen, die durch echte Ausführungsdaten belegt sein müssen. */
export const REQUIRED_CHECKS = ["typecheck", "lint", "tests", "build"] as const;
export type RequiredCheck = (typeof REQUIRED_CHECKS)[number];

const CHECK_MATCHERS: Record<RequiredCheck, RegExp> = {
  typecheck: /(tsgo\s+--noEmit|bun run typecheck)/i,
  lint: /(bunx eslint|bun run lint)/i,
  tests: /(vitest run|bun run test)/i,
  build: /(bun run build|vite build)/i,
};

export type CheckResult = { check: RequiredCheck; ok: boolean; detail: string };

/**
 * Bewertet ausschliesslich echte Schritt-Ergebnisse. Ein manuell gesetzter
 * Status („passed“ als Text) genügt nie – es zählt nur exitCode === 0 zu einem
 * Befehl, der die jeweilige Prüfung tatsächlich ausführt.
 */
export function evaluateRequiredChecks(steps: VerificationStep[]): CheckResult[] {
  return REQUIRED_CHECKS.map((check) => {
    const matching = steps.filter((s) => CHECK_MATCHERS[check].test(s.command ?? ""));
    if (matching.length === 0)
      return { check, ok: false, detail: "Keine Ausführungsdaten vorhanden." };
    const failed = matching.filter((s) => s.exitCode !== 0);
    return failed.length > 0
      ? { check, ok: false, detail: `Fehlgeschlagen: ${failed[0]?.command ?? ""}` }
      : { check, ok: true, detail: matching.map((s) => s.command).join(", ") };
  });
}

export type EvidenceVerdict = { ok: true } | { ok: false; state: DeploymentState; reason: string };

/** Phase-3-Ergebnis muss echt und vollständig bestanden sein (Punkt 4). */
export function verifySandboxEvidence(
  evidence: SandboxEvidence | null,
  extraSteps: VerificationStep[] = [],
): EvidenceVerdict {
  if (!evidence)
    return {
      ok: false,
      state: "DEPLOYMENT_BLOCKED",
      reason: "Kein Phase-3-Sandbox-Ergebnis vorhanden.",
    };
  if (evidence.state !== "PASSED")
    return {
      ok: false,
      state: "DEPLOYMENT_BLOCKED",
      reason: `Sandbox-Ergebnis ist nicht PASSED (${evidence.state}).`,
    };
  if (!evidence.patchApplied)
    return {
      ok: false,
      state: "DEPLOYMENT_BLOCKED",
      reason: "Patch wurde in der Sandbox nicht angewendet.",
    };
  if (!evidence.integrityOk)
    return {
      ok: false,
      state: "DEPLOYMENT_INTEGRITY_FAILURE",
      reason: "Diff-Integrität der Sandbox-Ausführung war nicht in Ordnung.",
    };
  if (!evidence.reproductionConfirmed)
    return {
      ok: false,
      state: "DEPLOYMENT_BLOCKED",
      reason: "Der behobene Fehler war im Basisstand nicht nachgewiesen.",
    };
  if (evidence.finalDiff.trim().length === 0)
    return { ok: false, state: "DEPLOYMENT_BLOCKED", reason: "Kein Final-Diff vorhanden." };
  const checks = evaluateRequiredChecks([...evidence.steps, ...extraSteps]);
  const missing = checks.filter((c) => !c.ok);
  if (missing.length > 0)
    return {
      ok: false,
      state: "DEPLOYMENT_BLOCKED",
      reason: `Pflichtprüfung nicht belegt: ${missing.map((m) => `${m.check} (${m.detail})`).join("; ")}`,
    };
  return { ok: true };
}

/* ----------------------------------------------------------------- Scope */

export type DeploymentScope = {
  files: string[];
  services: string[];
  databaseAreas: string[];
  migrations: string[];
  configuration: string[];
  expectedEffects: string[];
};

/** Der Scope wird aus dem genehmigten Fix abgeleitet – nichts Verstecktes. */
export function scopeFromOperations(args: {
  files: string[];
  operations: FixOperation[];
  expectedEffects: string[];
}): DeploymentScope {
  const migrations = args.operations
    .filter(
      (o): o is Extract<FixOperation, { kind: "run_migration" }> => o.kind === "run_migration",
    )
    .map((o) => o.name);
  const services = new Set<string>();
  for (const f of args.files) {
    if (f.startsWith("src/orb-core/")) services.add("ORB Core (Server-Logik)");
    else if (f.startsWith("src/routes/api/")) services.add("HTTP-Endpunkte");
    else if (f.startsWith("src/components/") || f.startsWith("src/routes/"))
      services.add("Web-Oberfläche");
    else if (f.startsWith("tests/")) services.add("Testsuite (nicht ausgeliefert)");
    else services.add("Anwendungscode");
  }
  return {
    files: [...args.files].sort(),
    services: [...services].sort(),
    databaseAreas: migrations.length > 0 ? ["laut Migration – gesondert freizugeben"] : [],
    migrations,
    configuration: args.files.filter((f) => /\.(json|toml|ya?ml|env)$/i.test(f)),
    expectedEffects: args.expectedEffects,
  };
}

export type MigrationVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Eine Datenbankmigration wird niemals mitgezogen, nur weil sie Teil des Fixes
 * ist. Sie muss im Deployment-Scope ausdrücklich freigegeben sein (Punkt 14).
 */
export function checkMigrationScope(
  scope: DeploymentScope,
  migrationsApproved: boolean,
): MigrationVerdict {
  if (scope.migrations.length === 0) {
    if (migrationsApproved)
      return {
        ok: false,
        reason: "Migrationsfreigabe ohne Migration im Scope – widersprüchliche Freigabe.",
      };
    return { ok: true };
  }
  if (!migrationsApproved)
    return {
      ok: false,
      reason: `DB Migration BLOCKED: ${scope.migrations.join(", ")} ist nicht Teil des genehmigten Deployment-Scope.`,
    };
  return { ok: true };
}

/* ------------------------------------------------- Deployment-Fingerabdruck */

export type DeploymentApprovalBinding = {
  fixId: string;
  fixVersion: number;
  proposalFingerprint: string;
  finalDiffFingerprint: string;
  sandboxExecutionId: string;
  sandboxResult: string;
  baseCommit: string;
  target: DeployTarget;
  scope: DeploymentScope;
  migrationsApproved: boolean;
  rollbackTarget: string;
};

function fnv1a(payload: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash ^ BigInt(payload.charCodeAt(i))) * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

/** Deterministischer Fingerabdruck über den genau getesteten Inhalt. */
export function diffFingerprint(diff: string): string {
  return fnv1a(diff.replace(/\r\n/g, "\n"));
}

/**
 * FIX + VERSION + FINAL DIFF + BASE COMMIT + SANDBOX RESULT + TARGET + SCOPE
 * = DEPLOYMENT FINGERPRINT. Ändert sich ein Bestandteil, ist die Freigabe tot.
 */
export function deploymentFingerprint(binding: DeploymentApprovalBinding): string {
  return fnv1a(
    JSON.stringify({
      fixId: binding.fixId,
      fixVersion: binding.fixVersion,
      proposalFingerprint: binding.proposalFingerprint,
      finalDiffFingerprint: binding.finalDiffFingerprint,
      sandboxExecutionId: binding.sandboxExecutionId,
      sandboxResult: binding.sandboxResult,
      baseCommit: binding.baseCommit,
      target: binding.target,
      migrationsApproved: binding.migrationsApproved,
      rollbackTarget: binding.rollbackTarget,
      scope: {
        files: [...binding.scope.files].sort(),
        migrations: [...binding.scope.migrations].sort(),
        services: [...binding.scope.services].sort(),
        databaseAreas: [...binding.scope.databaseAreas].sort(),
        configuration: [...binding.scope.configuration].sort(),
      },
    }),
  );
}

export type StoredDeploymentApproval = DeploymentApprovalBinding & {
  deploymentApprovalId: string;
  deploymentFingerprint: string;
  confirmation: string;
  status: "DEPLOYMENT_APPROVED" | "DEPLOYMENT_INVALIDATED" | "CONSUMED";
  approvedBy: string;
  approvedAt: string;
  source: "admin_ui";
};

/** Nur diese Quelle darf eine Deployment-Freigabe erzeugen. */
export const DEPLOYMENT_APPROVAL_SOURCES = ["admin_ui"] as const;

export type DeploymentApprovalVerdict =
  | { valid: true }
  | { valid: false; state: DeploymentState; reason: string };

/**
 * Erneute Prüfung der Deployment-Freigabe gegen den aktuellen Stand. Jede
 * Abweichung in Version, Diff, Fingerabdruck, Base Commit, Sandbox-Ergebnis,
 * Ziel oder Scope macht die Freigabe sofort ungültig (Punkt 22).
 */
export function checkDeploymentApproval(args: {
  approval: StoredDeploymentApproval | null;
  current: DeploymentApprovalBinding;
  requestedTarget: DeployTarget;
  confirmation?: string;
}): DeploymentApprovalVerdict {
  const { approval, current, requestedTarget } = args;
  if (!approval)
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_REQUIRED",
      reason:
        "Keine Deployment-Freigabe vorhanden. Eine Fix-Freigabe aus Phase 2 genügt für ein Deployment nicht.",
    };
  if (approval.status !== "DEPLOYMENT_APPROVED")
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: `Deployment-Freigabe ist nicht aktiv (${approval.status}).`,
    };
  if (approval.source !== "admin_ui")
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: `Freigabequelle nicht erlaubt: ${approval.source}`,
    };
  if (approval.target !== requestedTarget)
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: `Freigabe gilt für ${approval.target}, angefragt wurde ${requestedTarget}.`,
    };
  if (approval.fixId !== current.fixId)
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: "Freigabe gehört zu einer anderen Fix-ID.",
    };
  if (approval.fixVersion !== current.fixVersion)
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: `Fix-Version geändert (${approval.fixVersion} → ${current.fixVersion}).`,
    };
  if (approval.proposalFingerprint !== current.proposalFingerprint)
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: "Fix-Inhalt wurde nach der Deployment-Freigabe geändert.",
    };
  if (approval.finalDiffFingerprint !== current.finalDiffFingerprint)
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: "Final-Diff weicht vom freigegebenen Stand ab.",
    };
  if (approval.sandboxExecutionId !== current.sandboxExecutionId)
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: "Freigabe bezieht sich auf eine andere Sandbox-Ausführung.",
    };
  if (approval.sandboxResult !== "PASSED" || current.sandboxResult !== "PASSED")
    return {
      valid: false,
      state: "DEPLOYMENT_BLOCKED",
      reason: "Deployment ist nur nach bestandener Sandbox-Ausführung möglich.",
    };
  if (approval.baseCommit !== current.baseCommit)
    return {
      valid: false,
      state: "PRODUCTION_BASE_CHANGED",
      reason: `Basisstand hat sich geändert (${approval.baseCommit.slice(0, 8)} → ${current.baseCommit.slice(0, 8)}). Fix muss erneut validiert werden.`,
    };
  if (approval.migrationsApproved !== current.migrationsApproved)
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: "Migrationsumfang weicht von der Freigabe ab.",
    };
  if (approval.rollbackTarget !== current.rollbackTarget)
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: "Rollback-Ziel weicht von der Freigabe ab.",
    };
  const expected = deploymentFingerprint(current);
  if (approval.deploymentFingerprint !== expected)
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: "Deployment-Fingerabdruck stimmt nicht mehr – neue Freigabe erforderlich.",
    };
  if (approval.confirmation !== confirmationPhraseFor(approval.target))
    return {
      valid: false,
      state: "DEPLOYMENT_APPROVAL_INVALID",
      reason: "Bestätigungssatz fehlt oder weicht ab.",
    };
  if (
    args.confirmation !== undefined &&
    args.confirmation !== confirmationPhraseFor(requestedTarget)
  )
    return {
      valid: false,
      state: "DEPLOYMENT_BLOCKED",
      reason: "Doppelbestätigung fehlt oder ist nicht wörtlich.",
    };
  return { valid: true };
}

/* -------------------------------------------------------------- Pre-flight */

export type PreflightInput = {
  fixId: string;
  fixVersion: number | null;
  proposalFingerprint: string | null;
  proposalState: string | null;
  fixApprovalValid: boolean;
  evidence: SandboxEvidence | null;
  extraSteps?: VerificationStep[];
  deploymentApproval: StoredDeploymentApproval | null;
  current: DeploymentApprovalBinding | null;
  requestedTarget: DeployTarget | null;
  targetExplicitlyConfirmed: boolean;
  currentProductionCommit: string | null;
  rollbackTarget: string | null;
  healthChecksAvailable: boolean;
  confirmation?: string;
};

export type PreflightResult = {
  ok: boolean;
  state: DeploymentState;
  checks: { name: string; ok: boolean; detail: string }[];
  blockedReason: string | null;
};

/** Vollständiger Pre-flight. Ein einziger fehlgeschlagener Punkt blockiert. */
export function runPreflight(input: PreflightInput): PreflightResult {
  const checks: { name: string; ok: boolean; detail: string }[] = [];
  let state: DeploymentState = "PRE_FLIGHT";
  let blockedReason: string | null = null;

  const add = (name: string, ok: boolean, detail: string, failState: DeploymentState) => {
    checks.push({ name, ok, detail });
    if (!ok && blockedReason === null) {
      blockedReason = `${name}: ${detail}`;
      state = failState;
    }
  };

  add(
    "Fix-ID gültig",
    /^ORB-FIX-\d{4}$/.test(input.fixId),
    input.fixId || "(leer)",
    "DEPLOYMENT_BLOCKED",
  );
  add(
    "Fix-Version gültig",
    typeof input.fixVersion === "number" && input.fixVersion >= 1,
    String(input.fixVersion ?? "(unbekannt)"),
    "DEPLOYMENT_BLOCKED",
  );
  add(
    "Fix-Fingerabdruck gültig",
    typeof input.proposalFingerprint === "string" &&
      /^[0-9a-f]{16}$/.test(input.proposalFingerprint),
    input.proposalFingerprint ?? "(fehlt)",
    "DEPLOYMENT_BLOCKED",
  );
  add(
    "Phase-2-Fix-Freigabe gültig",
    input.fixApprovalValid,
    input.fixApprovalValid ? "vorhanden" : "fehlt oder entwertet",
    "DEPLOYMENT_BLOCKED",
  );

  const evidence = verifySandboxEvidence(input.evidence, input.extraSteps ?? []);
  add(
    "Phase-3-Sandbox-Ergebnis belegt",
    evidence.ok,
    evidence.ok ? (input.evidence?.executionId ?? "") : evidence.reason,
    evidence.ok ? "PRE_FLIGHT" : evidence.state,
  );

  const checkResults = evaluateRequiredChecks([
    ...(input.evidence?.steps ?? []),
    ...(input.extraSteps ?? []),
  ]);
  for (const c of checkResults)
    add(`Pflichtprüfung ${c.check}`, c.ok, c.detail, "DEPLOYMENT_BLOCKED");

  add(
    "Ziel ausdrücklich gewählt",
    input.requestedTarget !== null && input.targetExplicitlyConfirmed,
    input.requestedTarget ?? "(kein Ziel gewählt – es gibt kein AUTO)",
    "DEPLOYMENT_BLOCKED",
  );

  if (input.requestedTarget !== null && input.current !== null) {
    const verdict = checkDeploymentApproval({
      approval: input.deploymentApproval,
      current: input.current,
      requestedTarget: input.requestedTarget,
      confirmation: input.confirmation,
    });
    add(
      "Separate Deployment-Freigabe gültig",
      verdict.valid,
      verdict.valid ? (input.deploymentApproval?.deploymentFingerprint ?? "") : verdict.reason,
      verdict.valid ? "PRE_FLIGHT" : verdict.state,
    );
    const migration = checkMigrationScope(input.current.scope, input.current.migrationsApproved);
    add(
      "Migrationsumfang freigegeben",
      migration.ok,
      migration.ok ? "keine unfreigegebene Migration" : migration.reason,
      "DEPLOYMENT_BLOCKED",
    );
  } else {
    add(
      "Separate Deployment-Freigabe gültig",
      false,
      "Kein Ziel bzw. kein vergleichbarer aktueller Stand vorhanden.",
      "DEPLOYMENT_APPROVAL_REQUIRED",
    );
  }

  const baseKnown =
    typeof input.currentProductionCommit === "string" && input.currentProductionCommit.length >= 7;
  add(
    "Aktueller Zielstand bekannt",
    baseKnown,
    input.currentProductionCommit ?? "(unbekannt)",
    "DEPLOYMENT_BLOCKED",
  );
  if (baseKnown && input.deploymentApproval)
    add(
      "Zielstand unverändert seit Sandbox-Test",
      input.deploymentApproval.baseCommit === input.currentProductionCommit,
      `${input.deploymentApproval.baseCommit.slice(0, 8)} vs ${String(input.currentProductionCommit).slice(0, 8)}`,
      "PRODUCTION_BASE_CHANGED",
    );

  add(
    "Rollback-Ziel bekannt",
    typeof input.rollbackTarget === "string" && input.rollbackTarget.length >= 7,
    input.rollbackTarget ?? "(fehlt)",
    "DEPLOYMENT_BLOCKED",
  );
  add(
    "Health Checks verfügbar",
    input.healthChecksAvailable,
    input.healthChecksAvailable ? "definiert" : "keine Health Checks definiert",
    "DEPLOYMENT_BLOCKED",
  );

  const ok = checks.every((c) => c.ok);
  return { ok, state: ok ? "PRE_FLIGHT" : state, checks, blockedReason };
}

/* ------------------------------------------------------- Health / Rollback */

export type HealthCheckResult = {
  name: string;
  critical: boolean;
  ok: boolean;
  detail: string;
};

/**
 * Ausdrückliche, abschliessende Rollback-Kriterien. Ein beliebiger Einzelfehler
 * löst KEIN Rollback aus (Punkt 13).
 */
export const ROLLBACK_CRITERIA = [
  "Zielsystem nicht erreichbar",
  "kritischer Health Check fehlgeschlagen",
  "definierter Smoke Test fehlgeschlagen",
  "kritische Regression erkannt",
] as const;

export type RollbackDecision =
  | { rollback: false; reason: string }
  | { rollback: true; criterion: (typeof ROLLBACK_CRITERIA)[number]; reason: string };

export function decideRollback(args: {
  reachable: boolean;
  health: HealthCheckResult[];
  smoke: VerificationStep[];
  criticalRegression?: boolean;
}): RollbackDecision {
  if (!args.reachable)
    return {
      rollback: true,
      criterion: "Zielsystem nicht erreichbar",
      reason: "Das Zielsystem antwortete nach dem Rollout nicht.",
    };
  const criticalFailure = args.health.find((h) => h.critical && !h.ok);
  if (criticalFailure)
    return {
      rollback: true,
      criterion: "kritischer Health Check fehlgeschlagen",
      reason: `${criticalFailure.name}: ${criticalFailure.detail}`,
    };
  const smokeFailure = args.smoke.find((s) => s.exitCode !== 0);
  if (smokeFailure)
    return {
      rollback: true,
      criterion: "definierter Smoke Test fehlgeschlagen",
      reason: `Smoke Test fehlgeschlagen: ${smokeFailure.command}`,
    };
  if (args.criticalRegression === true)
    return {
      rollback: true,
      criterion: "kritische Regression erkannt",
      reason: "Eine kritische Regression wurde nach dem Rollout festgestellt.",
    };
  return { rollback: false, reason: "Kein definiertes Rollback-Kriterium erfüllt." };
}

/* ------------------------------------------ Nachverifikation des Deployments */

export type IntegrityVerdict = { ok: true } | { ok: false; reason: string };

/** DEPLOYED == APPROVED, sonst DEPLOYMENT_INTEGRITY_FAILURE (Punkt 12). */
export function verifyDeployedState(args: {
  deployedCommit: string;
  approvedCommit: string;
  deployedFingerprint: string;
  approvedFingerprint: string;
}): IntegrityVerdict {
  if (args.deployedCommit !== args.approvedCommit)
    return {
      ok: false,
      reason: `Laufender Stand ${args.deployedCommit.slice(0, 8)} entspricht nicht dem genehmigten Stand ${args.approvedCommit.slice(0, 8)}.`,
    };
  if (args.deployedFingerprint !== args.approvedFingerprint)
    return {
      ok: false,
      reason: "Laufender Fingerabdruck entspricht nicht dem genehmigten Deployment-Fingerabdruck.",
    };
  return { ok: true };
}

/* --------------------------------------------------- Autorisierungsgrenzen */

/** Quellen, die niemals ein Deployment auslösen dürfen. */
export const FORBIDDEN_DEPLOYMENT_SOURCES = [
  "llm",
  "memory",
  "graph",
  "chat",
  "system_prompt",
  "autonomous",
  "sandbox_pass",
] as const;

export function deploymentAuthorityFrom(source: string): { authorized: false; reason: string } {
  return {
    authorized: false,
    reason:
      `Quelle „${source}“ kann kein Deployment autorisieren. ` +
      "Nur eine gültige, ausdrücklich erteilte Deployment-Freigabe eines autorisierten Administrators zählt.",
  };
}

/** ORB darf vorbereiten, prüfen, auswerten – aber nie selbst deployen. */
export function orbMayDeployItself(): false {
  return false;
}
