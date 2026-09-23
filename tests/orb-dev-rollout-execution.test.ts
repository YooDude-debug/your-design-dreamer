/**
 * P16: Die Fallvorlage ist synthetisch (tests/helpers/orb-dev-synthetic-fix.ts).
 * Geprüft wird die Rollout-Eigenschaft, nicht ein bestimmter ORB-Fehler; der
 * Produktionscode wird nicht in einen früheren Fehlerzustand zurückversetzt.
 *
 * ORB Developer / Repair Environment – Phase 4: echte, kontrollierte Ausführung.
 *
 * Diese Tests führen den Rollout-Ablauf tatsächlich aus – ausschliesslich in
 * einer isolierten Rollout-Umgebung unter /tmp. Der laufende Code, die
 * veröffentlichte App und die Datenbank bleiben unberührt; das wird nach jedem
 * Durchlauf überprüft.
 *
 * Nachgewiesen werden:
 *   · DEPLOY → HEALTH → SMOKE → VERIFY → DEPLOYED
 *   · DEPLOY → FAILURE → DETECT → ROLLBACK → VERIFY PREVIOUS STATE
 *   · Production wird von ORB nicht selbst veröffentlicht
 *   · ohne gültige Deployment-Freigabe passiert nichts
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

import { fixFingerprint } from "@/orb-dev/fix-model";
import { executeControlledRollout } from "@/orb-dev/rollout.server";
import {
  confirmationPhraseFor,
  deploymentFingerprint,
  diffFingerprint,
  type DeployTarget,
  type DeploymentApprovalBinding,
  type SandboxEvidence,
  type StoredDeploymentApproval,
} from "@/orb-dev/rollout-policy";

import { SYNTHETIC_REGRESSION_TEST, syntheticProposal } from "./helpers/orb-dev-synthetic-fix";

const ROOT = process.cwd();

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).toString().trim();
}

const HEAD = git("rev-parse", "HEAD");
const PREVIOUS = git("rev-parse", "HEAD~1");

const PROVEN_STEPS = [
  { command: "bunx tsgo --noEmit", exitCode: 0 },
  { command: "bunx eslint src/orb-core", exitCode: 0 },
  { command: `bunx vitest run ${SYNTHETIC_REGRESSION_TEST}`, exitCode: 0 },
  { command: "bun run build", exitCode: 0 },
];

function buildCase(target: DeployTarget) {
  const candidate = syntheticProposal("ORB-FIX-0001");
  const proposal = { ...candidate, version: 1, fingerprint: fixFingerprint(candidate) };

  const evidence: SandboxEvidence = {
    executionId: "ORB-EXEC-PHASE4TEST",
    fixId: proposal.fixId,
    fixVersion: 1,
    fingerprint: proposal.fingerprint,
    baseCommit: HEAD,
    state: "PASSED",
    patchApplied: true,
    integrityOk: true,
    reproductionConfirmed: true,
    steps: PROVEN_STEPS,
    finalDiff: proposal.diff,
  };

  const binding: DeploymentApprovalBinding = {
    fixId: proposal.fixId,
    fixVersion: 1,
    proposalFingerprint: proposal.fingerprint,
    finalDiffFingerprint: diffFingerprint(proposal.diff),
    sandboxExecutionId: evidence.executionId,
    sandboxResult: "PASSED",
    baseCommit: HEAD,
    target,
    scope: {
      files: proposal.files,
      services: ["ORB Core (Server-Logik)"],
      databaseAreas: [],
      migrations: [],
      configuration: [],
      expectedEffects: proposal.expectedEffects,
    },
    migrationsApproved: false,
    rollbackTarget: PREVIOUS,
  };

  const approval: StoredDeploymentApproval = {
    ...binding,
    deploymentApprovalId: "dep-test",
    deploymentFingerprint: deploymentFingerprint(binding),
    confirmation: confirmationPhraseFor(target),
    status: "DEPLOYMENT_APPROVED",
    approvedBy: "admin-test",
    approvedAt: new Date().toISOString(),
    source: "admin_ui",
  };

  return { proposal, evidence, approval };
}

function treeClean(): boolean {
  return git("status", "--porcelain", "src/orb-core").length === 0;
}

describe("Phase 4 · kontrollierter Rollout (echte Ausführung)", () => {
  it("STAGING: DEPLOY → HEALTH → SMOKE → VERIFY → DEPLOYED, Live-Code unverändert", async () => {
    const { proposal, evidence, approval } = buildCase("STAGING");
    const record = await executeControlledRollout({
      proposal,
      evidence,
      approval,
      deploymentApprovalId: approval.deploymentApprovalId,
      fixApprovalValid: true,
      target: "STAGING",
      targetExplicitlyConfirmed: true,
      confirmation: approval.confirmation,
      executor: "test",
      projectRoot: ROOT,
      verificationCommands: [`bunx vitest run ${SYNTHETIC_REGRESSION_TEST}`],
      smokeCommands: ["bunx vitest run tests/orb-core-health.smoke.test.ts"],
    });

    expect(record.preflight.ok).toBe(true);
    expect(record.verification.every((v) => v.exitCode === 0)).toBe(true);
    expect(record.smoke.every((s) => s.exitCode === 0)).toBe(true);
    expect(record.state).toBe("DEPLOYED");
    expect(record.rollback.performed).toBe(false);
    expect(record.liveCodeChanged).toBe(false);
    expect(record.publishedAppChanged).toBe(false);
    expect(record.databaseChanged).toBe(false);
    expect(record.cleanedUp).toBe(true);
    expect(record.log.map((l) => l.phase)).toEqual(
      expect.arrayContaining([
        "PRE_FLIGHT",
        "APPROVAL_VERIFICATION",
        "BASELINE_VERIFICATION",
        "DEPLOY_START",
        "PATCH_APPLICATION",
        "VERIFICATION",
        "HEALTH_CHECK",
        "SMOKE_TEST",
        "POST_DEPLOY_VERIFICATION",
      ]),
    );
    expect(treeClean()).toBe(true);
  }, 600_000);

  it("STAGING mit Fehlerinjektion: FAILURE → DETECT → ROLLBACK → VERIFY PREVIOUS STATE", async () => {
    const { proposal, evidence, approval } = buildCase("STAGING");
    const record = await executeControlledRollout({
      proposal,
      evidence,
      approval,
      fixApprovalValid: true,
      target: "STAGING",
      targetExplicitlyConfirmed: true,
      confirmation: approval.confirmation,
      executor: "test",
      projectRoot: ROOT,
      failureInjection: "smoke",
      verificationCommands: [`bunx vitest run ${SYNTHETIC_REGRESSION_TEST}`],
      smokeCommands: ["bunx vitest run tests/orb-core-health.smoke.test.ts"],
    });

    expect(record.smoke.some((s) => s.exitCode !== 0)).toBe(true);
    expect(record.rollback.performed).toBe(true);
    expect(record.rollback.criterion).toBe("definierter Smoke Test fehlgeschlagen");
    expect(record.rollback.verified).toBe(true);
    expect(record.state).toBe("ROLLED_BACK");
    expect(record.liveCodeChanged).toBe(false);
    expect(treeClean()).toBe(true);
  }, 600_000);

  it("kritischer Health-Fehler löst denselben kontrollierten Rollback aus", async () => {
    const { proposal, evidence, approval } = buildCase("STAGING");
    const record = await executeControlledRollout({
      proposal,
      evidence,
      approval,
      fixApprovalValid: true,
      target: "STAGING",
      targetExplicitlyConfirmed: true,
      confirmation: approval.confirmation,
      executor: "test",
      projectRoot: ROOT,
      failureInjection: "health",
      verificationCommands: [`bunx vitest run ${SYNTHETIC_REGRESSION_TEST}`],
      smokeCommands: ["bunx vitest run tests/orb-core-health.smoke.test.ts"],
    });

    expect(record.rollback.performed).toBe(true);
    expect(record.rollback.criterion).toBe("kritischer Health Check fehlgeschlagen");
    expect(record.rollback.verified).toBe(true);
    expect(record.state).toBe("ROLLED_BACK");
    expect(record.smoke.length).toBe(0);
    expect(treeClean()).toBe(true);
  }, 600_000);

  it("PRODUCTION: ORB veröffentlicht nicht selbst – Halt vor der Veröffentlichung", async () => {
    const { proposal, evidence, approval } = buildCase("PRODUCTION");
    const record = await executeControlledRollout({
      proposal,
      evidence,
      approval,
      fixApprovalValid: true,
      target: "PRODUCTION",
      targetExplicitlyConfirmed: true,
      confirmation: approval.confirmation,
      executor: "test",
      projectRoot: ROOT,
    });

    expect(record.preflight.ok).toBe(true);
    expect(record.state).toBe("READY_FOR_DEPLOYMENT");
    expect(record.awaitingHumanProductionAction).toBe(true);
    expect(record.verification.length).toBe(0);
    expect(record.liveCodeChanged).toBe(false);
    expect(record.publishedAppChanged).toBe(false);
    expect(treeClean()).toBe(true);
  });

  it("ohne Deployment-Freigabe passiert nichts", async () => {
    const { proposal, evidence } = buildCase("STAGING");
    const record = await executeControlledRollout({
      proposal,
      evidence,
      approval: null,
      fixApprovalValid: true,
      target: "STAGING",
      targetExplicitlyConfirmed: true,
      executor: "test",
      projectRoot: ROOT,
    });
    expect(record.state).toBe("DEPLOYMENT_APPROVAL_REQUIRED");
    expect(record.verification.length).toBe(0);
    expect(treeClean()).toBe(true);
  });

  it("nach der Freigabe geänderter Diff blockiert den Rollout", async () => {
    const { proposal, evidence, approval } = buildCase("STAGING");
    const record = await executeControlledRollout({
      proposal,
      evidence: { ...evidence, finalDiff: `${evidence.finalDiff}\n# nachträglich geändert\n` },
      approval,
      fixApprovalValid: true,
      target: "STAGING",
      targetExplicitlyConfirmed: true,
      confirmation: approval.confirmation,
      executor: "test",
      projectRoot: ROOT,
    });
    expect(record.state).toBe("DEPLOYMENT_APPROVAL_INVALID");
    expect(record.verification.length).toBe(0);
    expect(treeClean()).toBe(true);
  });

  it("veränderter Zielstand seit dem Sandbox-Test blockiert den Rollout", async () => {
    const { proposal, evidence, approval } = buildCase("STAGING");
    const stale = { ...approval, baseCommit: PREVIOUS };
    const record = await executeControlledRollout({
      proposal,
      evidence: { ...evidence, baseCommit: PREVIOUS },
      approval: { ...stale, deploymentFingerprint: deploymentFingerprint(stale) },
      fixApprovalValid: true,
      target: "STAGING",
      targetExplicitlyConfirmed: true,
      confirmation: approval.confirmation,
      executor: "test",
      projectRoot: ROOT,
    });
    expect(record.state).toBe("PRODUCTION_BASE_CHANGED");
    expect(record.verification.length).toBe(0);
    expect(treeClean()).toBe(true);
  });
});
