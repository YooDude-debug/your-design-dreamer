/**
 * ORB Developer / Repair Environment – Phase 4: Sicherheits- und Regeltests.
 *
 * Diese Tests führen keinen Rollout aus. Sie prüfen ausschliesslich die
 * Entscheidungslogik: ohne gültige, separate Deployment-Freigabe darf nichts
 * passieren, und jede Abweichung entwertet die Freigabe.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import {
  DEPLOYMENT_AUTO_RETRY_ENABLED,
  DEPLOYMENT_FAILURE_STATES,
  DEPLOY_TARGETS,
  DEFAULT_DEPLOY_TARGET,
  FORBIDDEN_DEPLOYMENT_SOURCES,
  PHASE4_AUTOMATIC_DEPLOYMENT_ENABLED,
  PHASE4_DEPLOY_ON_SANDBOX_PASS_ENABLED,
  PHASE4_PRODUCTION_ROLLOUT_EXECUTION_BY_ORB_ENABLED,
  PHASE4_UNCONDITIONAL_AUTOMATIC_ROLLBACK_ENABLED,
  PRODUCTION_CONFIRMATION_PHRASE,
  ROLLBACK_CRITERIA,
  checkDeploymentApproval,
  checkMigrationScope,
  confirmationPhraseFor,
  decideRollback,
  deploymentAuthorityFrom,
  deploymentFingerprint,
  diffFingerprint,
  evaluateRequiredChecks,
  isDeploymentFailure,
  orbMayDeployItself,
  runPreflight,
  scopeFromOperations,
  verifyDeployedState,
  verifySandboxEvidence,
  type DeploymentApprovalBinding,
  type SandboxEvidence,
  type StoredDeploymentApproval,
} from "@/orb-dev/rollout-policy";
import {
  PHASE4_AUTONOMOUS_DEPLOYMENT_ENABLED,
  checkAutonomousDeploymentAllowed,
  fixApprovalCoversDeployment,
} from "@/orb-dev/fix-model";

/* ------------------------------------------------------------------ Fixtures */

const FINAL_DIFF =
  "--- a/src/orb-core/memory.ts\n+++ b/src/orb-core/memory.ts\n@@\n+const X = 1;\n";

const STEPS = [
  { command: "bunx tsgo --noEmit", exitCode: 0 },
  { command: "bunx eslint src/orb-core", exitCode: 0 },
  { command: "bunx vitest run tests/orb-memory-recall-age.regression.test.ts", exitCode: 0 },
  { command: "bun run build", exitCode: 0 },
];

function evidence(overrides: Partial<SandboxEvidence> = {}): SandboxEvidence {
  return {
    executionId: "ORB-EXEC-TEST01",
    fixId: "ORB-FIX-0001",
    fixVersion: 1,
    fingerprint: "a".repeat(16),
    baseCommit: "b".repeat(40),
    state: "PASSED",
    patchApplied: true,
    integrityOk: true,
    reproductionConfirmed: true,
    steps: STEPS,
    finalDiff: FINAL_DIFF,
    ...overrides,
  };
}

const SCOPE = scopeFromOperations({
  files: ["src/orb-core/memory.ts", "src/orb-core/recall.ts"],
  operations: [
    { kind: "edit_file", path: "src/orb-core/memory.ts" },
    { kind: "run_command", command: "bunx vitest run tests/orb-memory.test.ts" },
  ],
  expectedEffects: ["Erinnerung wird wieder gefunden"],
});

function binding(overrides: Partial<DeploymentApprovalBinding> = {}): DeploymentApprovalBinding {
  return {
    fixId: "ORB-FIX-0001",
    fixVersion: 1,
    proposalFingerprint: "a".repeat(16),
    finalDiffFingerprint: diffFingerprint(FINAL_DIFF),
    sandboxExecutionId: "ORB-EXEC-TEST01",
    sandboxResult: "PASSED",
    baseCommit: "b".repeat(40),
    target: "PRODUCTION",
    scope: SCOPE,
    migrationsApproved: false,
    rollbackTarget: "c".repeat(40),
    ...overrides,
  };
}

function approval(
  overrides: Partial<StoredDeploymentApproval> = {},
  bindingOverrides: Partial<DeploymentApprovalBinding> = {},
): StoredDeploymentApproval {
  const b = binding(bindingOverrides);
  return {
    ...b,
    deploymentApprovalId: "dep-1",
    deploymentFingerprint: deploymentFingerprint(b),
    confirmation: confirmationPhraseFor(b.target),
    status: "DEPLOYMENT_APPROVED",
    approvedBy: "admin-1",
    approvedAt: new Date().toISOString(),
    source: "admin_ui",
    ...overrides,
  };
}

function preflight(overrides: Record<string, unknown> = {}) {
  const current = binding();
  return runPreflight({
    fixId: "ORB-FIX-0001",
    fixVersion: 1,
    proposalFingerprint: "a".repeat(16),
    proposalState: "APPROVED",
    fixApprovalValid: true,
    evidence: evidence(),
    extraSteps: [],
    deploymentApproval: approval(),
    current,
    requestedTarget: "PRODUCTION",
    targetExplicitlyConfirmed: true,
    currentProductionCommit: "b".repeat(40),
    rollbackTarget: "c".repeat(40),
    healthChecksAvailable: true,
    confirmation: PRODUCTION_CONFIRMATION_PHRASE,
    ...overrides,
  } as Parameters<typeof runPreflight>[0]);
}

/* ------------------------------------------------------- Grundvoraussetzungen */

describe("Phase 4 · Grenze: Sandbox-Erfolg ist kein Deployment", () => {
  it("Fix-Freigabe deckt kein Deployment", () => {
    expect(fixApprovalCoversDeployment()).toBe(false);
    expect(PHASE4_AUTONOMOUS_DEPLOYMENT_ENABLED).toBe(false);
    expect(checkAutonomousDeploymentAllowed().allowed).toBe(false);
  });

  it("kein automatisches Deployment, auch nicht nach bestandener Sandbox", () => {
    expect(PHASE4_AUTOMATIC_DEPLOYMENT_ENABLED).toBe(false);
    expect(PHASE4_DEPLOY_ON_SANDBOX_PASS_ENABLED).toBe(false);
    expect(PHASE4_PRODUCTION_ROLLOUT_EXECUTION_BY_ORB_ENABLED).toBe(false);
    expect(PHASE4_UNCONDITIONAL_AUTOMATIC_ROLLBACK_ENABLED).toBe(false);
    expect(orbMayDeployItself()).toBe(false);
  });

  it("Memory, LLM, Chat und Sandbox-Erfolg autorisieren nichts", () => {
    for (const source of FORBIDDEN_DEPLOYMENT_SOURCES) {
      expect(deploymentAuthorityFrom(source).authorized).toBe(false);
    }
  });

  it("kein automatischer Neuversuch; Fehlzustände sind endgültig", () => {
    expect(DEPLOYMENT_AUTO_RETRY_ENABLED).toBe(false);
    for (const state of DEPLOYMENT_FAILURE_STATES) expect(isDeploymentFailure(state)).toBe(true);
  });

  it("Ziel ist niemals vorausgewählt und kennt kein AUTO", () => {
    expect(DEFAULT_DEPLOY_TARGET).toBeNull();
    expect([...DEPLOY_TARGETS]).toEqual(["STAGING", "PRODUCTION"]);
    expect((DEPLOY_TARGETS as readonly string[]).includes("AUTO")).toBe(false);
  });
});

/* --------------------------------------------------------- Sicherheitsmatrix */

describe("Phase 4 · Sicherheitsmatrix der Deployment-Freigabe", () => {
  const current = binding();

  it("NO APPROVAL → BLOCK", () => {
    const v = checkDeploymentApproval({
      approval: null,
      current,
      requestedTarget: "PRODUCTION",
    });
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.state).toBe("DEPLOYMENT_APPROVAL_REQUIRED");
  });

  it("FIX APPROVAL WITHOUT DEPLOYMENT APPROVAL → BLOCK", () => {
    const p = preflight({ deploymentApproval: null });
    expect(p.ok).toBe(false);
    expect(String(p.blockedReason)).toContain("Deployment-Freigabe");
  });

  it("CHANGED DIFF → BLOCK", () => {
    const v = checkDeploymentApproval({
      approval: approval(),
      current: { ...current, finalDiffFingerprint: diffFingerprint(`${FINAL_DIFF}extra`) },
      requestedTarget: "PRODUCTION",
    });
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.state).toBe("DEPLOYMENT_APPROVAL_INVALID");
  });

  it("CHANGED FINGERPRINT → BLOCK", () => {
    const v = checkDeploymentApproval({
      approval: approval({ deploymentFingerprint: "0".repeat(16) }),
      current,
      requestedTarget: "PRODUCTION",
    });
    expect(v.valid).toBe(false);
  });

  it("CHANGED VERSION → BLOCK", () => {
    const v = checkDeploymentApproval({
      approval: approval(),
      current: { ...current, fixVersion: 2 },
      requestedTarget: "PRODUCTION",
    });
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toContain("Fix-Version");
  });

  it("CHANGED PRODUCTION BASE → BLOCK", () => {
    const v = checkDeploymentApproval({
      approval: approval(),
      current: { ...current, baseCommit: "d".repeat(40) },
      requestedTarget: "PRODUCTION",
    });
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.state).toBe("PRODUCTION_BASE_CHANGED");
  });

  it("WRONG TARGET → BLOCK", () => {
    const v = checkDeploymentApproval({
      approval: approval({}, { target: "STAGING" }),
      current,
      requestedTarget: "PRODUCTION",
    });
    expect(v.valid).toBe(false);
  });

  it("entwertete Freigabe → BLOCK", () => {
    const v = checkDeploymentApproval({
      approval: approval({ status: "DEPLOYMENT_INVALIDATED" }),
      current,
      requestedTarget: "PRODUCTION",
    });
    expect(v.valid).toBe(false);
  });

  it("fehlende oder falsche Doppelbestätigung → BLOCK", () => {
    const v = checkDeploymentApproval({
      approval: approval(),
      current,
      requestedTarget: "PRODUCTION",
      confirmation: "ja mach schon",
    });
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toContain("Doppelbestätigung");
  });

  it("gültige Freigabe mit wörtlicher Bestätigung → erlaubt", () => {
    const v = checkDeploymentApproval({
      approval: approval(),
      current,
      requestedTarget: "PRODUCTION",
      confirmation: PRODUCTION_CONFIRMATION_PHRASE,
    });
    expect(v.valid).toBe(true);
  });

  it("MISSING ROLLBACK TARGET → BLOCK", () => {
    const p = preflight({ rollbackTarget: null });
    expect(p.ok).toBe(false);
    expect(String(p.blockedReason)).toContain("Rollback-Ziel");
  });

  it("UNAPPROVED DB MIGRATION → BLOCK", () => {
    const scope = scopeFromOperations({
      files: ["src/orb-core/memory.ts"],
      operations: [{ kind: "run_migration", name: "0050_example" }],
      expectedEffects: [],
    });
    expect(checkMigrationScope(scope, false).ok).toBe(false);
    expect(checkMigrationScope(scope, true).ok).toBe(true);
    // Freigabe ohne Migration im Scope ist ebenfalls widersprüchlich.
    expect(checkMigrationScope(SCOPE, true).ok).toBe(false);
  });
});

/* ----------------------------------------------- Nachweise statt Behauptungen */

describe("Phase 4 · Phase-3-Ergebnis muss echt bestanden sein", () => {
  it("fehlender Nachweis → BLOCK", () => {
    const v = verifySandboxEvidence(null);
    expect(v.ok).toBe(false);
  });

  it("FAILED SANDBOX TEST → BLOCK", () => {
    expect(verifySandboxEvidence(evidence({ state: "TEST_FAILED" })).ok).toBe(false);
  });

  it("Integritätsfehler → BLOCK", () => {
    const v = verifySandboxEvidence(evidence({ integrityOk: false }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.state).toBe("DEPLOYMENT_INTEGRITY_FAILURE");
  });

  it("fehlende Reproduktion des Fehlers → BLOCK", () => {
    expect(verifySandboxEvidence(evidence({ reproductionConfirmed: false })).ok).toBe(false);
  });

  it("FAILED TYPECHECK / LINT / REGRESSION / BUILD → jeweils BLOCK", () => {
    for (const command of [
      "bunx tsgo --noEmit",
      "bunx eslint src/orb-core",
      "bunx vitest run tests/orb-memory-recall-age.regression.test.ts",
      "bun run build",
    ]) {
      const steps = STEPS.map((s) => (s.command === command ? { ...s, exitCode: 1 } : s));
      expect(verifySandboxEvidence(evidence({ steps })).ok).toBe(false);
    }
  });

  it("fehlende Pflichtprüfung gilt nicht als bestanden", () => {
    const steps = STEPS.filter((s) => s.command !== "bun run build");
    const v = verifySandboxEvidence(evidence({ steps }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("build");
  });

  it("ein behaupteter Status ohne Ausführungsdaten zählt nicht", () => {
    const checks = evaluateRequiredChecks([{ command: "status: passed", exitCode: 0 }]);
    expect(checks.every((c) => !c.ok)).toBe(true);
  });

  it("vollständiger, echter Nachweis → erlaubt", () => {
    expect(verifySandboxEvidence(evidence()).ok).toBe(true);
  });
});

/* -------------------------------------------------------------- Pre-flight */

describe("Phase 4 · Pre-flight", () => {
  it("vollständige Voraussetzungen → Pre-flight bestanden", () => {
    const p = preflight();
    expect(p.ok).toBe(true);
    expect(p.checks.every((c) => c.ok)).toBe(true);
  });

  it("kein Ziel gewählt → BLOCK", () => {
    const p = preflight({ requestedTarget: null, targetExplicitlyConfirmed: false, current: null });
    expect(p.ok).toBe(false);
  });

  it("Ziel nicht ausdrücklich bestätigt → BLOCK", () => {
    const p = preflight({ targetExplicitlyConfirmed: false });
    expect(p.ok).toBe(false);
  });

  it("unbekannter aktueller Zielstand → BLOCK", () => {
    const p = preflight({ currentProductionCommit: null });
    expect(p.ok).toBe(false);
  });

  it("Zielstand nach dem Sandbox-Test verändert → PRODUCTION_BASE_CHANGED", () => {
    const p = preflight({ currentProductionCommit: "e".repeat(40) });
    expect(p.ok).toBe(false);
    expect(p.state).toBe("PRODUCTION_BASE_CHANGED");
  });

  it("ungültige Phase-2-Fix-Freigabe → BLOCK", () => {
    const p = preflight({ fixApprovalValid: false });
    expect(p.ok).toBe(false);
  });

  it("keine Health Checks definiert → BLOCK", () => {
    const p = preflight({ healthChecksAvailable: false });
    expect(p.ok).toBe(false);
  });
});

/* ------------------------------------------------------- Rollback und Integrität */

describe("Phase 4 · Rollback-Kriterien", () => {
  it("kein Kriterium erfüllt → kein Rollback", () => {
    const d = decideRollback({
      reachable: true,
      health: [{ name: "x", critical: false, ok: false, detail: "unkritisch" }],
      smoke: [{ command: "bunx vitest run tests/orb-core-health.smoke.test.ts", exitCode: 0 }],
    });
    expect(d.rollback).toBe(false);
  });

  it("Zielsystem nicht erreichbar → Rollback", () => {
    const d = decideRollback({ reachable: false, health: [], smoke: [] });
    expect(d.rollback).toBe(true);
    if (d.rollback) expect(d.criterion).toBe("Zielsystem nicht erreichbar");
  });

  it("kritischer Health Check fehlgeschlagen → Rollback", () => {
    const d = decideRollback({
      reachable: true,
      health: [{ name: "Dienst", critical: true, ok: false, detail: "weg" }],
      smoke: [],
    });
    expect(d.rollback).toBe(true);
  });

  it("Smoke Test fehlgeschlagen → Rollback", () => {
    const d = decideRollback({
      reachable: true,
      health: [],
      smoke: [{ command: "bunx vitest run tests/orb-core-health.smoke.test.ts", exitCode: 1 }],
    });
    expect(d.rollback).toBe(true);
  });

  it("kritische Regression → Rollback", () => {
    const d = decideRollback({
      reachable: true,
      health: [],
      smoke: [],
      criticalRegression: true,
    });
    expect(d.rollback).toBe(true);
  });

  it("Rollback-Kriterien sind abschliessend definiert", () => {
    expect(ROLLBACK_CRITERIA.length).toBe(4);
  });
});

describe("Phase 4 · Nachverifikation", () => {
  it("DEPLOYED == APPROVED → in Ordnung", () => {
    expect(
      verifyDeployedState({
        deployedCommit: "b".repeat(40),
        approvedCommit: "b".repeat(40),
        deployedFingerprint: "1".repeat(16),
        approvedFingerprint: "1".repeat(16),
      }).ok,
    ).toBe(true);
  });

  it("abweichender Commit → Integritätsfehler", () => {
    expect(
      verifyDeployedState({
        deployedCommit: "f".repeat(40),
        approvedCommit: "b".repeat(40),
        deployedFingerprint: "1".repeat(16),
        approvedFingerprint: "1".repeat(16),
      }).ok,
    ).toBe(false);
  });

  it("abweichender Fingerabdruck → Integritätsfehler", () => {
    expect(
      verifyDeployedState({
        deployedCommit: "b".repeat(40),
        approvedCommit: "b".repeat(40),
        deployedFingerprint: "2".repeat(16),
        approvedFingerprint: "1".repeat(16),
      }).ok,
    ).toBe(false);
  });
});

/* ----------------------------------------------- Autorisierung und Grenzen im Code */

describe("Phase 4 · Autorisierung und Codegrenzen", () => {
  const functions = readFileSync("src/lib/orb-dev.functions.ts", "utf8");
  const rollout = readFileSync("src/orb-dev/rollout.server.ts", "utf8");
  const policySource = readFileSync("src/orb-dev/rollout-policy.ts", "utf8");

  it("jede Phase-4-Server-Funktion verlangt Authentifizierung und Adminrolle", () => {
    for (const name of [
      "orbDevRolloutPlan",
      "orbDevRecordSandboxResult",
      "orbDevRequestDeploymentApproval",
      "orbDevQueueDeployment",
      "orbDevDeploymentEvents",
    ]) {
      const start = functions.indexOf(`export const ${name} = createServerFn`);
      expect(start, name).toBeGreaterThan(-1);
      const segment = functions.slice(start, start + 2500);
      expect(segment, name).toContain("requireSupabaseAuth");
      expect(segment, name).toContain("assertAdmin");
    }
  });

  it("Freigabequelle wird serverseitig fest gesetzt", () => {
    expect(functions).toContain('source: "admin_ui"');
  });

  it("der laufende Serverprozess startet keine Prozesse", () => {
    expect(functions).not.toContain("node:child_process");
    expect(functions).not.toContain("executeControlledRollout");
  });

  it("die Rollout-Ausführung enthält keine Veröffentlichungs- oder Git-Schreibbefehle", () => {
    expect(rollout).not.toMatch(/wrangler|npm publish|git (push|commit|tag|merge)/);
    expect(rollout).toContain("liveCodeChanged: false");
    expect(rollout).toContain("publishedAppChanged: false");
    expect(rollout).toContain("databaseChanged: false");
  });

  it("die Richtlinie ist rein: kein Dateizugriff, kein Prozess, keine Datenbank", () => {
    expect(policySource).not.toContain("node:fs");
    expect(policySource).not.toContain("node:child_process");
    expect(policySource).not.toContain("supabase");
  });

  it("die Bestätigungssätze sind zielgebunden und wörtlich", () => {
    expect(confirmationPhraseFor("PRODUCTION")).toBe(PRODUCTION_CONFIRMATION_PHRASE);
    expect(confirmationPhraseFor("STAGING")).not.toBe(PRODUCTION_CONFIRMATION_PHRASE);
  });
});
