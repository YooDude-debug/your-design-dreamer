/**
 * ORB Developer / Repair Environment – Phase 4: kontrollierter Rollout.
 *
 * Ablauf:
 *   PRE-FLIGHT → APPROVAL VERIFICATION → BASELINE VERIFICATION →
 *   DEPLOY START → PATCH ANWENDUNG → VERIFIKATION (typecheck/lint/tests/build) →
 *   HEALTH CHECK → SMOKE TEST → INTEGRITÄTSPRÜFUNG → ERGEBNIS
 *
 * Harte Grenzen:
 *   · Ohne gültige, separate Deployment-Freigabe passiert nichts.
 *   · Der Rollout wirkt ausschliesslich in einer isolierten Rollout-Umgebung
 *     (STAGING-Verifikationsziel). Der laufende ORB, die veröffentlichte App und
 *     die Produktionsdatenbank werden nicht verändert.
 *   · Die Veröffentlichung nach Production führt ORB nicht selbst aus; dafür ist
 *     ausschliesslich eine ausdrückliche Handlung eines autorisierten Menschen
 *     vorgesehen (PHASE4_PRODUCTION_ROLLOUT_EXECUTION_BY_ORB_ENABLED = false).
 *   · Nach einem Fehlschlag gibt es keinen automatischen Neuversuch.
 *   · Rollback nur bei einem ausdrücklich definierten Kriterium.
 *   · Keine Secrets in Ausgabe, Audit oder Bericht.
 *
 * Diese Datei braucht echte Prozesse (git, patch, Tests) und läuft deshalb NUR
 * in einer Node-/Bun-Umgebung (Runner-Skript, Tests) – niemals im laufenden
 * Serverprozess des veröffentlichten ORB.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { FixProposal } from "./fix-model";
import { redact } from "./sandbox.server";
import { SANDBOX_LIMITS, classifyCommand, classifyPatchPaths, sandboxEnv } from "./sandbox-policy";
import { patchPaths } from "./diff-integrity";
import {
  PHASE4_PRODUCTION_ROLLOUT_EXECUTION_BY_ORB_ENABLED,
  checkDeploymentApproval,
  decideRollback,
  deploymentFingerprint,
  diffFingerprint,
  runPreflight,
  verifyDeployedState,
  type DeployTarget,
  type DeploymentApprovalBinding,
  type DeploymentState,
  type HealthCheckResult,
  type SandboxEvidence,
  type StoredDeploymentApproval,
  type VerificationStep,
} from "./rollout-policy";

/* ------------------------------------------------------------------- Befehle */

/** Verifikationspipeline des Rollouts – ausschliesslich Positivliste. */
export const ROLLOUT_VERIFICATION_COMMANDS = [
  "bunx tsgo --noEmit",
  "bunx eslint src/orb-core tests",
  "bunx vitest run tests/orb-memory-recall-age.regression.test.ts tests/orb-memory-recall-fix.test.ts tests/orb-memory.test.ts",
  "bun run build",
];

/** Definierte Smoke Tests nach dem Rollout (Kernfunktion von ORB). */
export const ROLLOUT_SMOKE_COMMANDS = ["bunx vitest run tests/orb-core-health.smoke.test.ts"];

/* --------------------------------------------------------------------- Typen */

export type RolloutPhase =
  | "PRE_FLIGHT"
  | "APPROVAL_VERIFICATION"
  | "BASELINE_VERIFICATION"
  | "DEPLOY_START"
  | "PATCH_APPLICATION"
  | "VERIFICATION"
  | "HEALTH_CHECK"
  | "SMOKE_TEST"
  | "POST_DEPLOY_VERIFICATION"
  | "ROLLBACK";

export type RolloutLogEntry = {
  phase: RolloutPhase;
  at: string;
  ok: boolean;
  detail: string;
};

export type RolloutRecord = {
  deploymentId: string;
  fixId: string;
  fixVersion: number | null;
  proposalFingerprint: string;
  deploymentApprovalId: string | null;
  deploymentFingerprint: string | null;
  sandboxExecutionId: string | null;
  baseCommit: string;
  productionCommitBefore: string;
  productionCommitAfter: string;
  rollbackTarget: string;
  target: DeployTarget | null;
  executor: string;
  approver: string | null;
  startedAt: string;
  finishedAt: string;
  state: DeploymentState;
  reason: string | null;
  awaitingHumanProductionAction: boolean;
  preflight: { ok: boolean; checks: { name: string; ok: boolean; detail: string }[] };
  verification: VerificationStep[];
  health: HealthCheckResult[];
  smoke: VerificationStep[];
  rollback: { performed: boolean; criterion: string | null; verified: boolean; detail: string };
  log: RolloutLogEntry[];
  liveCodeChanged: false;
  publishedAppChanged: false;
  databaseChanged: false;
  cleanedUp: boolean;
};

export type RolloutArgs = {
  proposal: FixProposal & { version?: number; fingerprint?: string };
  evidence: SandboxEvidence | null;
  approval: StoredDeploymentApproval | null;
  deploymentApprovalId?: string | null;
  fixApprovalValid: boolean;
  target: DeployTarget | null;
  targetExplicitlyConfirmed: boolean;
  confirmation?: string;
  executor: string;
  approver?: string | null;
  projectRoot?: string;
  workRoot?: string;
  /** Nur für den kontrollierten Rollback-Nachweis in sicherer Umgebung. */
  failureInjection?: "health" | "smoke" | null;
  verificationCommands?: string[];
  smokeCommands?: string[];
};

/* -------------------------------------------------------------------- Helfer */

function cap(text: string): string {
  const t = redact(text ?? "");
  return t.length > SANDBOX_LIMITS.maxOutputBytes
    ? `${t.slice(0, SANDBOX_LIMITS.maxOutputBytes)}\n… [gekürzt]`
    : t;
}

function words(command: string): { file: string; args: string[] } {
  const parts = command.trim().split(/\s+/);
  return { file: parts[0] as string, args: parts.slice(1) };
}

function run(
  command: string,
  cwd: string,
  env: Record<string, string>,
): { exitCode: number | null; output: string } {
  const { file, args } = words(command);
  const res = spawnSync(file, args, {
    cwd,
    env,
    encoding: "utf8",
    timeout: SANDBOX_LIMITS.commandTimeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { exitCode: res.status, output: cap(`${res.stdout ?? ""}${res.stderr ?? ""}`) };
}

function extract(projectRoot: string, commit: string, target: string, tarPath: string): void {
  mkdirSync(target, { recursive: true });
  execFileSync("git", ["archive", "--format=tar", "-o", tarPath, commit], {
    cwd: projectRoot,
    stdio: "ignore",
  });
  execFileSync("tar", ["-x", "-f", tarPath, "-C", target], { stdio: "ignore" });
}

function treeDiffers(a: string, b: string): boolean {
  const res = spawnSync("diff", ["-rq", "--exclude=node_modules", "--exclude=.patch", a, b], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return `${res.stdout ?? ""}`.trim().length > 0;
}

function gitCommit(projectRoot: string, rev: string): string {
  try {
    return execFileSync("git", ["rev-parse", rev], { cwd: projectRoot, encoding: "utf8" })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

/* ---------------------------------------------------------------- Ausführung */

export async function executeControlledRollout(args: RolloutArgs): Promise<RolloutRecord> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const deploymentId = `ORB-DEPLOY-${startMs.toString(36).toUpperCase()}`;
  const projectRoot = args.projectRoot ?? process.cwd();
  const workRoot = args.workRoot ?? join("/tmp", "orb-rollout", deploymentId.toLowerCase());
  const env = sandboxEnv(process.env);
  const log: RolloutLogEntry[] = [];
  const verification: VerificationStep[] = [];
  const health: HealthCheckResult[] = [];
  const smoke: VerificationStep[] = [];

  const note = (phase: RolloutPhase, ok: boolean, detail: string) => {
    log.push({ phase, at: new Date().toISOString(), ok, detail: redact(detail) });
  };

  const productionCommitBefore = gitCommit(projectRoot, "HEAD");
  const rollbackTargetCommit = gitCommit(projectRoot, "HEAD");
  const previousCommit = gitCommit(projectRoot, "HEAD~1");

  const proposalFingerprint = args.proposal.fingerprint ?? "";
  const fixVersion = args.proposal.version ?? null;
  const finalDiff = args.evidence?.finalDiff ?? "";

  const binding: DeploymentApprovalBinding | null =
    args.target !== null && typeof fixVersion === "number" && args.evidence
      ? {
          fixId: args.proposal.fixId,
          fixVersion,
          proposalFingerprint,
          finalDiffFingerprint: diffFingerprint(finalDiff),
          sandboxExecutionId: args.evidence.executionId,
          sandboxResult: args.evidence.state,
          baseCommit: args.evidence.baseCommit,
          target: args.target,
          scope: (args.approval?.scope ?? {
            files: args.proposal.files,
            services: [],
            databaseAreas: [],
            migrations: [],
            configuration: [],
            expectedEffects: args.proposal.expectedEffects,
          }) as DeploymentApprovalBinding["scope"],
          migrationsApproved: args.approval?.migrationsApproved ?? false,
          rollbackTarget: args.approval?.rollbackTarget ?? rollbackTargetCommit,
        }
      : null;

  const finish = (
    state: DeploymentState,
    reason: string | null,
    extra: Partial<RolloutRecord> = {},
  ): RolloutRecord => {
    try {
      rmSync(workRoot, { recursive: true, force: true });
    } catch {
      /* Aufräumen darf das Ergebnis nicht verfälschen. */
    }
    return {
      deploymentId,
      fixId: args.proposal.fixId,
      fixVersion,
      proposalFingerprint,
      deploymentApprovalId: args.deploymentApprovalId ?? null,
      deploymentFingerprint: args.approval?.deploymentFingerprint ?? null,
      sandboxExecutionId: args.evidence?.executionId ?? null,
      baseCommit: args.evidence?.baseCommit ?? "",
      productionCommitBefore,
      productionCommitAfter: productionCommitBefore,
      rollbackTarget: args.approval?.rollbackTarget ?? (previousCommit || rollbackTargetCommit),
      target: args.target,
      executor: args.executor,
      approver: args.approver ?? args.approval?.approvedBy ?? null,
      startedAt,
      finishedAt: new Date().toISOString(),
      state,
      reason: reason === null ? null : redact(reason),
      awaitingHumanProductionAction: false,
      preflight: { ok: false, checks: [] },
      verification,
      health,
      smoke,
      rollback: { performed: false, criterion: null, verified: false, detail: "nicht erforderlich" },
      log,
      liveCodeChanged: false,
      publishedAppChanged: false,
      databaseChanged: false,
      cleanedUp: !existsSync(workRoot),
      ...extra,
    };
  };

  /* 1 · Pre-flight ------------------------------------------------------- */
  const preflight = runPreflight({
    fixId: args.proposal.fixId,
    fixVersion,
    proposalFingerprint,
    proposalState: args.proposal.state,
    fixApprovalValid: args.fixApprovalValid,
    evidence: args.evidence,
    extraSteps: args.evidence?.steps ?? [],
    deploymentApproval: args.approval,
    current: binding,
    requestedTarget: args.target,
    targetExplicitlyConfirmed: args.targetExplicitlyConfirmed,
    currentProductionCommit: productionCommitBefore,
    rollbackTarget: args.approval?.rollbackTarget ?? (previousCommit || rollbackTargetCommit),
    healthChecksAvailable: (args.smokeCommands ?? ROLLOUT_SMOKE_COMMANDS).length > 0,
    confirmation: args.confirmation,
  });
  note("PRE_FLIGHT", preflight.ok, preflight.blockedReason ?? "alle Pre-flight-Prüfungen bestanden");
  if (!preflight.ok)
    return finish(preflight.state, preflight.blockedReason, {
      preflight: { ok: false, checks: preflight.checks },
    });

  /* 2 · Freigabe erneut prüfen (unabhängig von Pre-flight und UI) -------- */
  const approvalVerdict = checkDeploymentApproval({
    approval: args.approval,
    current: binding!,
    requestedTarget: args.target!,
    confirmation: args.confirmation,
  });
  note(
    "APPROVAL_VERIFICATION",
    approvalVerdict.valid,
    approvalVerdict.valid ? "Deployment-Freigabe gültig" : approvalVerdict.reason,
  );
  if (!approvalVerdict.valid)
    return finish(approvalVerdict.state, approvalVerdict.reason, {
      preflight: { ok: true, checks: preflight.checks },
    });

  /* 3 · Baseline: Zielstand darf sich seit dem Sandbox-Test nicht geändert haben */
  if (args.approval!.baseCommit !== productionCommitBefore) {
    note("BASELINE_VERIFICATION", false, "Zielstand wurde nach dem Sandbox-Test verändert");
    return finish(
      "PRODUCTION_BASE_CHANGED",
      `Zielstand geändert: genehmigt ${args.approval!.baseCommit.slice(0, 8)}, aktuell ${productionCommitBefore.slice(0, 8)}. Der Fix muss erneut validiert werden.`,
      { preflight: { ok: true, checks: preflight.checks } },
    );
  }
  note("BASELINE_VERIFICATION", true, `Zielstand bestätigt: ${productionCommitBefore.slice(0, 8)}`);

  /* 4 · Production wird von ORB nicht selbst veröffentlicht -------------- */
  if (args.target === "PRODUCTION" && !PHASE4_PRODUCTION_ROLLOUT_EXECUTION_BY_ORB_ENABLED) {
    note(
      "DEPLOY_START",
      true,
      "Production-Veröffentlichung ist ORB verwehrt – ausschliesslich Menschen-Handlung",
    );
    return finish(
      "READY_FOR_DEPLOYMENT",
      "Alle Voraussetzungen erfüllt. Die Veröffentlichung nach Production löst ausschliesslich ein autorisierter Mensch aus.",
      {
        preflight: { ok: true, checks: preflight.checks },
        awaitingHumanProductionAction: true,
      },
    );
  }

  /* 5 · Isolierte Rollout-Umgebung aufbauen ------------------------------ */
  const paths = patchPaths(args.proposal.diff);
  const pathVerdict = classifyPatchPaths(paths);
  if (!pathVerdict.allowed) {
    note("PATCH_APPLICATION", false, pathVerdict.reason);
    return finish("DEPLOYMENT_BLOCKED", pathVerdict.reason, {
      preflight: { ok: true, checks: preflight.checks },
    });
  }

  const commands = args.verificationCommands ?? ROLLOUT_VERIFICATION_COMMANDS;
  const smokeCommands = args.smokeCommands ?? ROLLOUT_SMOKE_COMMANDS;
  for (const command of [...commands, ...smokeCommands]) {
    const verdict = classifyCommand(command);
    if (!verdict.allowed) {
      note("VERIFICATION", false, verdict.reason);
      return finish("DEPLOYMENT_BLOCKED", verdict.reason, {
        preflight: { ok: true, checks: preflight.checks },
      });
    }
  }

  const work = join(workRoot, "target");
  const pristine = join(workRoot, "rollback");
  const tarPath = join(workRoot, "base.tar");
  const patchPath = join(workRoot, "approved.patch");
  try {
    mkdirSync(workRoot, { recursive: true });
    extract(projectRoot, productionCommitBefore, work, tarPath);
    extract(projectRoot, productionCommitBefore, pristine, tarPath);
    const modules = join(projectRoot, "node_modules");
    if (existsSync(modules)) symlinkSync(modules, join(work, "node_modules"));
    writeFileSync(patchPath, args.proposal.diff, "utf8");
  } catch (err) {
    note("DEPLOY_START", false, `Rollout-Umgebung konnte nicht aufgebaut werden: ${String(err)}`);
    return finish("DEPLOYMENT_FAILED", `Rollout-Umgebung fehlgeschlagen: ${redact(String(err))}`, {
      preflight: { ok: true, checks: preflight.checks },
    });
  }
  note("DEPLOY_START", true, `Rollout-Ziel ${args.target} vorbereitet (${deploymentId})`);

  /* 6 · Genau den genehmigten Patch anwenden ---------------------------- */
  const apply = run(
    `patch -p1 --forward --batch --no-backup-if-mismatch -i ${patchPath}`,
    work,
    env,
  );
  if (apply.exitCode !== 0) {
    note("PATCH_APPLICATION", false, "Genehmigter Patch konnte nicht exakt angewendet werden");
    return finish("DEPLOYMENT_FAILED", "Genehmigter Patch war nicht exakt anwendbar.", {
      preflight: { ok: true, checks: preflight.checks },
    });
  }
  note("PATCH_APPLICATION", true, `Patch angewendet: ${paths.join(", ")}`);

  /* 7 · Verifikationspipeline ------------------------------------------- */
  for (const command of commands) {
    if (Date.now() - startMs > SANDBOX_LIMITS.totalTimeoutMs) {
      note("VERIFICATION", false, "Gesamtlaufzeit überschritten");
      return finish("DEPLOYMENT_FAILED", "Zeitgrenze des Rollouts überschritten.", {
        preflight: { ok: true, checks: preflight.checks },
      });
    }
    const res = run(command, work, env);
    verification.push({ command, exitCode: res.exitCode });
    note("VERIFICATION", res.exitCode === 0, `${command} → ${res.exitCode}`);
    if (res.exitCode !== 0)
      return finish("DEPLOYMENT_FAILED", `Verifikation fehlgeschlagen: ${command}`, {
        preflight: { ok: true, checks: preflight.checks },
      });
  }

  /* 8 · Health Checks --------------------------------------------------- */
  const buildOk = existsSync(join(work, "dist")) || existsSync(join(work, ".output"));
  health.push({
    name: "Dienst-Artefakt vorhanden",
    critical: true,
    ok: args.failureInjection === "health" ? false : buildOk,
    detail:
      args.failureInjection === "health"
        ? "Fehlerinjektion für den Rollback-Nachweis"
        : buildOk
          ? "Build-Ausgabe vorhanden"
          : "Keine Build-Ausgabe gefunden",
  });
  health.push({
    name: "ORB-Core-Module ladbar",
    critical: true,
    ok: existsSync(join(work, "src/orb-core/recall.ts")),
    detail: "Kernmodule im ausgerollten Stand vorhanden",
  });
  health.push({
    name: "Keine unmittelbaren Serverfehler in der Verifikation",
    critical: false,
    ok: verification.every((v) => v.exitCode === 0),
    detail: "Verifikationspipeline ohne Fehler",
  });
  note(
    "HEALTH_CHECK",
    health.every((h) => h.ok || !h.critical),
    health.map((h) => `${h.name}=${h.ok ? "ok" : "fail"}`).join(", "),
  );

  /* 9 · Smoke Tests ----------------------------------------------------- */
  const criticalHealthOk = health.every((h) => !h.critical || h.ok);
  if (criticalHealthOk) {
    // Die Smoke-Suite gehört zum Repair-System, nicht zum Patch: fehlt eine
    // Datei im ausgerollten Stand, wird sie unverändert bereitgestellt.
    for (const command of smokeCommands) {
      for (const token of command.split(/\s+/)) {
        if (!token.endsWith(".ts") && !token.endsWith(".tsx")) continue;
        const inWork = join(work, token);
        const inRepo = join(projectRoot, token);
        if (!existsSync(inWork) && existsSync(inRepo)) {
          mkdirSync(join(work, token.split("/").slice(0, -1).join("/")), { recursive: true });
          copyFileSync(inRepo, inWork);
        }
      }
    }
    for (const command of smokeCommands) {
      const res = run(command, work, env);
      const exitCode = args.failureInjection === "smoke" ? 1 : res.exitCode;
      smoke.push({ command, exitCode });
      note("SMOKE_TEST", exitCode === 0, `${command} → ${exitCode}`);
    }
  }

  /* 10 · Rollback-Entscheidung nach definierten Kriterien ---------------- */
  const decision = decideRollback({ reachable: true, health, smoke });
  if (decision.rollback) {
    note("ROLLBACK", true, `Rollback-Kriterium erfüllt: ${decision.criterion} – ${decision.reason}`);
    // Kontrollierter Rollback: Zielstand wieder exakt auf das Rollback-Ziel setzen.
    let verified = false;
    let detail = "";
    try {
      rmSync(work, { recursive: true, force: true });
      extract(projectRoot, args.approval!.rollbackTarget || productionCommitBefore, work, tarPath);
      verified = !treeDiffers(pristine, work);
      detail = verified
        ? `Vorheriger Stand ${(args.approval!.rollbackTarget || productionCommitBefore).slice(0, 8)} wiederhergestellt und verifiziert`
        : "Rollback konnte nicht verifiziert werden";
    } catch (err) {
      detail = `Rollback fehlgeschlagen: ${redact(String(err))}`;
    }
    note("ROLLBACK", verified, detail);
    return finish(verified ? "ROLLED_BACK" : "ROLLBACK_REQUIRED", decision.reason, {
      preflight: { ok: true, checks: preflight.checks },
      rollback: { performed: true, criterion: decision.criterion, verified, detail },
    });
  }

  /* 11 · Nachverifikation: laufender Stand == genehmigter Stand ---------- */
  const deployedFingerprint = deploymentFingerprint(binding!);
  const integrity = verifyDeployedState({
    deployedCommit: productionCommitBefore,
    approvedCommit: args.approval!.baseCommit,
    deployedFingerprint,
    approvedFingerprint: args.approval!.deploymentFingerprint,
  });
  note(
    "POST_DEPLOY_VERIFICATION",
    integrity.ok,
    integrity.ok ? "Stand entspricht der Freigabe" : integrity.reason,
  );
  if (!integrity.ok)
    return finish("DEPLOYMENT_INTEGRITY_FAILURE", integrity.reason, {
      preflight: { ok: true, checks: preflight.checks },
    });

  return finish("DEPLOYED", null, {
    preflight: { ok: true, checks: preflight.checks },
    productionCommitAfter: productionCommitBefore,
  });
}
