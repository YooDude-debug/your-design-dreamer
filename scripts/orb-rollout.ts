/**
 * ORB Developer / Repair Environment – Phase 4: Rollout-Runner.
 *
 * Bewusst ausserhalb des laufenden ORB-Serverprozesses: der veröffentlichte
 * Serverprozess darf keine Prozesse starten, keinen Code anwenden und nichts
 * veröffentlichen. Dieser Runner führt einen kontrollierten Rollout eines
 * bereits in der Sandbox bestandenen und gesondert freigegebenen Fixes in eine
 * isolierte Rollout-Umgebung durch.
 *
 * Aufruf:
 *   bun run scripts/orb-rollout.ts <ORB-FIX-0001> <STAGING|PRODUCTION> \
 *       <deployment-approval.json> <sandbox-report.json> [--inject-failure=health|smoke]
 *
 * Ohne gültige, separate Deployment-Freigabe passiert nichts. Für PRODUCTION
 * endet der Runner grundsätzlich vor der Veröffentlichung: diese löst
 * ausschliesslich ein autorisierter Mensch aus.
 */

import { readFileSync } from "node:fs";

import { diagnoseMemoryRecallCase, proposalFromDiagnosis } from "@/orb-dev/diagnose.server";
import { fixFingerprint } from "@/orb-dev/fix-model";
import { executeControlledRollout } from "@/orb-dev/rollout.server";
import type {
  DeployTarget,
  SandboxEvidence,
  StoredDeploymentApproval,
} from "@/orb-dev/rollout-policy";

async function main(): Promise<void> {
  const [fixId, target, approvalPath, reportPath, ...rest] = process.argv.slice(2);
  if (!fixId || !target || !approvalPath || !reportPath) {
    console.error(
      "Aufruf: bun run scripts/orb-rollout.ts <FIX-ID> <STAGING|PRODUCTION> <deployment-approval.json> <sandbox-report.json>",
    );
    process.exit(2);
    return;
  }
  if (target !== "STAGING" && target !== "PRODUCTION") {
    console.error("Ziel muss ausdrücklich STAGING oder PRODUCTION sein – es gibt kein AUTO.");
    process.exit(2);
    return;
  }

  const injection = rest.find((a) => a.startsWith("--inject-failure="));
  const failureInjection = injection
    ? (injection.split("=")[1] as "health" | "smoke" | undefined)
    : null;

  const diagnosis = await diagnoseMemoryRecallCase();
  const candidate = proposalFromDiagnosis(diagnosis, fixId);
  if ("error" in candidate) {
    console.error(candidate.error);
    process.exit(3);
    return;
  }

  const approval = JSON.parse(readFileSync(approvalPath, "utf8")) as StoredDeploymentApproval;
  const evidence = JSON.parse(readFileSync(reportPath, "utf8")) as SandboxEvidence;

  const record = await executeControlledRollout({
    proposal: {
      ...candidate,
      version: approval.fixVersion,
      fingerprint: fixFingerprint(candidate),
    },
    evidence,
    approval,
    deploymentApprovalId: approval.deploymentApprovalId,
    fixApprovalValid: true,
    target: target as DeployTarget,
    targetExplicitlyConfirmed: true,
    confirmation: approval.confirmation,
    executor: `rollout-runner:${process.env["USER"] ?? "unknown"}`,
    approver: approval.approvedBy,
    projectRoot: process.cwd(),
    failureInjection: failureInjection ?? null,
  });

  console.log(
    JSON.stringify(
      {
        deploymentId: record.deploymentId,
        fixId: record.fixId,
        fixVersion: record.fixVersion,
        target: record.target,
        deploymentApprovalId: record.deploymentApprovalId,
        deploymentFingerprint: record.deploymentFingerprint,
        sandboxExecutionId: record.sandboxExecutionId,
        baseCommit: record.baseCommit,
        productionCommitBefore: record.productionCommitBefore,
        productionCommitAfter: record.productionCommitAfter,
        rollbackTarget: record.rollbackTarget,
        state: record.state,
        reason: record.reason,
        awaitingHumanProductionAction: record.awaitingHumanProductionAction,
        preflight: record.preflight,
        verification: record.verification,
        health: record.health,
        smoke: record.smoke,
        rollback: record.rollback,
        log: record.log,
        liveCodeChanged: record.liveCodeChanged,
        publishedAppChanged: record.publishedAppChanged,
        databaseChanged: record.databaseChanged,
        cleanedUp: record.cleanedUp,
      },
      null,
      2,
    ),
  );
  process.exit(
    record.state === "DEPLOYED" ||
      record.state === "READY_FOR_DEPLOYMENT" ||
      record.state === "ROLLED_BACK"
      ? 0
      : 1,
  );
}

void main();
