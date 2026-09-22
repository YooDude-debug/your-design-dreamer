/**
 * ORB Developer / Repair Environment – Phase 3: isolierte Reparatur-Sandbox.
 *
 * Ablauf:
 *   BASE COMMIT → ISOLIERTER WORKSPACE → REPRODUKTION DES FEHLERS →
 *   RESET → GENEHMIGTER PATCH → DIFF-INTEGRITÄT → TESTPIPELINE → ERGEBNIS
 *
 * Harte Grenzen:
 *   · es wird ausschliesslich der freigegebene Patch angewendet
 *   · es werden ausschliesslich freigegebene Befehle ausgeführt
 *   · der laufende ORB, Production, Staging und jedes Deployment bleiben unberührt
 *   · die Sandbox erhält weder Secrets noch Datenbank- oder Netz-Zugangsdaten
 *   · nach einem Fehlzustand gibt es keinen automatischen Neuversuch
 *
 * Diese Datei braucht echte Prozesse (Git, patch, Tests) und läuft deshalb NUR
 * in einer Node-/Bun-Umgebung (Runner-Skript, Tests) – niemals im laufenden
 * Serverprozess des veröffentlichten ORB.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

import type { FixApproval, FixProposal } from "./fix-model";
import {
  SANDBOX_LIMITS,
  checkSandboxExecutionRequest,
  sandboxEnv,
  type SandboxState,
} from "./sandbox-policy";
import { compareChangedFiles, compareDiffText, newTestFiles, patchPaths } from "./diff-integrity";

/* ------------------------------------------------------------------ Typen */

export type SandboxStep = {
  command: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  output: string;
};

export type SandboxExecutionRecord = {
  executionId: string;
  sandboxId: string;
  fixId: string;
  fixVersion: number | null;
  approvalId: string | null;
  fingerprint: string;
  baseCommit: string;
  executor: string;
  startedAt: string;
  finishedAt: string;
  state: SandboxState;
  reason: string | null;
  reproduction: { attempted: boolean; failureConfirmed: boolean; output: string };
  patchApplied: boolean;
  patchOutput: string;
  integrity: {
    ok: boolean;
    changedFiles: string[];
    unexpected: string[];
    missing: string[];
    deterministic: boolean;
    diffTextMatches: boolean;
  };
  steps: SandboxStep[];
  finalDiff: string;
  cleanedUp: boolean;
};

export type SandboxExecutionArgs = {
  proposal: FixProposal;
  approval: FixApproval | null;
  approvalId?: string | null;
  fixVersion?: number | null;
  approvedVersion?: number;
  currentVersion?: number;
  executor: string;
  projectRoot?: string;
  workRoot?: string;
};

/* ---------------------------------------------------------------- Helfer */

const SECRET_RE =
  /(sb_secret_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(?:SERVICE_ROLE_KEY|API_KEY|ACCESS_TOKEN|PASSWORD|SECRET)\s*[:=]\s*\S+)/g;

/** Kein Secret darf in Log, Audit, UI oder Bericht landen. */
export function redact(text: string): string {
  return (text ?? "").replace(SECRET_RE, "[REDACTED]");
}

function cap(text: string): string {
  const t = redact(text ?? "");
  return t.length > SANDBOX_LIMITS.maxOutputBytes
    ? `${t.slice(0, SANDBOX_LIMITS.maxOutputBytes)}\n… [gekürzt]`
    : t;
}

function shellWords(command: string): { file: string; args: string[] } {
  const parts = command.trim().split(/\s+/);
  return { file: parts[0] as string, args: parts.slice(1) };
}

function runRaw(
  file: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env?: Record<string, string>,
): { status: number | null; timedOut: boolean; output: string } {
  const res = spawnSync(file, args, {
    cwd,
    timeout: timeoutMs,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: env ?? sandboxEnv(process.env),
  });
  const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  return { status: res.status, timedOut: res.error?.name === "Error" && res.signal === "SIGTERM", output };
}

function extractBase(projectRoot: string, commit: string, target: string, tarPath: string): void {
  mkdirSync(target, { recursive: true });
  execFileSync("git", ["archive", "--format=tar", "-o", tarPath, commit], {
    cwd: projectRoot,
    stdio: "ignore",
  });
  execFileSync("tar", ["-x", "-f", tarPath, "-C", target], { stdio: "ignore" });
}

/** Geänderte Dateien zwischen unberührtem Basisstand und Arbeitskopie. */
function changedFilesBetween(pristine: string, work: string): string[] {
  const res = spawnSync(
    "diff",
    ["-rq", "--exclude=node_modules", "--exclude=.patch", pristine, work],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const out = `${res.stdout ?? ""}`;
  const files: string[] = [];
  for (const line of out.split("\n")) {
    const differ = /^Files .*? and (.*?) differ$/.exec(line);
    if (differ?.[1]) {
      files.push(differ[1].replace(`${work}/`, ""));
      continue;
    }
    const only = /^Only in (.*?): (.*)$/.exec(line);
    if (only) {
      const dir = (only[1] ?? "").replace(work, "").replace(pristine, "").replace(/^\//, "");
      const name = only[2] ?? "";
      files.push(dir.length > 0 ? `${dir}/${name}` : name);
    }
  }
  return [...new Set(files)].sort();
}

function unifiedDiff(pristine: string, work: string): string {
  const res = spawnSync(
    "diff",
    ["-ruN", "--exclude=node_modules", "--exclude=.patch", pristine, work],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return cap(`${res.stdout ?? ""}`);
}

function emptyRecord(base: Partial<SandboxExecutionRecord>): SandboxExecutionRecord {
  const now = new Date().toISOString();
  return {
    executionId: base.executionId ?? `ORB-EXEC-${Date.now()}`,
    sandboxId: base.sandboxId ?? "",
    fixId: base.fixId ?? "",
    fixVersion: base.fixVersion ?? null,
    approvalId: base.approvalId ?? null,
    fingerprint: base.fingerprint ?? "",
    baseCommit: base.baseCommit ?? "",
    executor: base.executor ?? "",
    startedAt: base.startedAt ?? now,
    finishedAt: now,
    state: base.state ?? "SANDBOX_ERROR",
    reason: base.reason ?? null,
    reproduction: base.reproduction ?? { attempted: false, failureConfirmed: false, output: "" },
    patchApplied: base.patchApplied ?? false,
    patchOutput: base.patchOutput ?? "",
    integrity: base.integrity ?? {
      ok: false,
      changedFiles: [],
      unexpected: [],
      missing: [],
      deterministic: false,
      diffTextMatches: false,
    },
    steps: base.steps ?? [],
    finalDiff: base.finalDiff ?? "",
    cleanedUp: base.cleanedUp ?? true,
  };
}

/* ------------------------------------------------------------ Ausführung */

export async function executeApprovedFixInSandbox(
  args: SandboxExecutionArgs,
): Promise<SandboxExecutionRecord> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const executionId = `ORB-EXEC-${startMs.toString(36).toUpperCase()}`;
  const sandboxId = `sbx-${startMs.toString(36)}`;
  const projectRoot = args.projectRoot ?? process.cwd();
  const workRoot = args.workRoot ?? join("/tmp", "orb-repair-sandbox", sandboxId);
  const { proposal, approval } = args;

  const paths = patchPaths(proposal.diff);
  const gate = checkSandboxExecutionRequest({
    proposal,
    approval,
    approvedVersion: args.approvedVersion,
    currentVersion: args.currentVersion,
    diffToExecute: proposal.diff,
    patchPaths: paths,
  });

  const head = {
    executionId,
    sandboxId,
    fixId: proposal.fixId,
    fixVersion: args.fixVersion ?? null,
    approvalId: args.approvalId ?? null,
    fingerprint: approval?.fingerprint ?? "",
    executor: args.executor,
    startedAt,
  };

  if (!gate.allowed)
    return emptyRecord({ ...head, state: gate.state, reason: gate.reason, cleanedUp: true });

  let baseCommit = "";
  try {
    baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" })
      .toString()
      .trim();
  } catch {
    return emptyRecord({
      ...head,
      state: "SANDBOX_ERROR",
      reason: "Basisstand konnte nicht bestimmt werden.",
    });
  }

  const work = join(workRoot, "work");
  const pristine = join(workRoot, "pristine");
  const reference = join(workRoot, "reference");
  const tarPath = join(workRoot, "base.tar");
  const patchPath = join(workRoot, "approved.patch");
  const env = sandboxEnv(process.env);
  const steps: SandboxStep[] = [];
  let reproduction = { attempted: false, failureConfirmed: false, output: "" };
  let patchApplied = false;
  let patchOutput = "";

  const finish = (state: SandboxState, reason: string | null, extra: Partial<SandboxExecutionRecord> = {}) => {
    try {
      rmSync(workRoot, { recursive: true, force: true });
    } catch {
      /* Aufräumen darf das Ergebnis nicht verfälschen. */
    }
    return emptyRecord({
      ...head,
      baseCommit,
      state,
      reason,
      reproduction,
      patchApplied,
      patchOutput: cap(patchOutput),
      steps,
      cleanedUp: !existsSync(workRoot),
      ...extra,
    });
  };

  try {
    mkdirSync(workRoot, { recursive: true });
    extractBase(projectRoot, baseCommit, work, tarPath);
    extractBase(projectRoot, baseCommit, pristine, tarPath);
    extractBase(projectRoot, baseCommit, reference, tarPath);
    const modules = join(projectRoot, "node_modules");
    if (existsSync(modules)) {
      symlinkSync(modules, join(work, "node_modules"));
      symlinkSync(modules, join(reference, "node_modules"));
    }
    writeFileSync(patchPath, proposal.diff, "utf8");
  } catch (err) {
    return finish("SANDBOX_ERROR", `Sandbox konnte nicht aufgebaut werden: ${redact(String(err))}`);
  }

  // 1 · Bekannten Fehler im unveränderten Basisstand reproduzieren.
  const regressionCommand = gate.commands.find((c) => c.startsWith("bunx vitest run"));
  const testsFromPatch = newTestFiles(proposal.diff);
  if (regressionCommand && testsFromPatch.length > 0) {
    for (const file of testsFromPatch) {
      const target = join(work, file.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content, "utf8");
    }
    const probe = runRaw(
      shellWords(regressionCommand).file,
      shellWords(regressionCommand).args,
      work,
      SANDBOX_LIMITS.commandTimeoutMs,
      env,
    );
    reproduction = {
      attempted: true,
      failureConfirmed: probe.status !== 0,
      output: cap(probe.output),
    };
    // Arbeitskopie danach wieder exakt auf den Basisstand zurücksetzen.
    rmSync(work, { recursive: true, force: true });
    try {
      extractBase(projectRoot, baseCommit, work, tarPath);
      if (existsSync(modules_(projectRoot))) symlinkSync(modules_(projectRoot), join(work, "node_modules"));
    } catch (err) {
      return finish("SANDBOX_ERROR", `Reset fehlgeschlagen: ${redact(String(err))}`);
    }
    if (!reproduction.failureConfirmed)
      return finish(
        "EXECUTION_FAILED",
        "Der bekannte Fehler war im Basisstand nicht reproduzierbar – kein Nachweis, kein Fix.",
      );
  }

  // 2 · Ausschliesslich den genehmigten Patch anwenden.
  const apply = runRaw(
    "patch",
    ["-p1", "--forward", "--batch", "--no-backup-if-mismatch", "-i", patchPath],
    work,
    60_000,
    env,
  );
  patchOutput = apply.output;
  patchApplied = apply.status === 0;
  if (!patchApplied)
    return finish("EXECUTION_FAILED", "Genehmigter Patch konnte nicht exakt angewendet werden.");

  const applyRef = runRaw(
    "patch",
    ["-p1", "--forward", "--batch", "--no-backup-if-mismatch", "-i", patchPath],
    reference,
    60_000,
    env,
  );

  // 3 · Diff-Integrität: EXPECTED == ACTUAL.
  const actualChanged = changedFilesBetween(pristine, work);
  const fileCheck = compareChangedFiles(paths, actualChanged);
  const deterministic =
    applyRef.status === 0 && changedFilesBetween(reference, work).length === 0;
  const finalDiff = unifiedDiff(pristine, work);
  const textCheck = compareDiffText(proposal.diff, finalDiff);
  const integrity = {
    ok: fileCheck.ok && deterministic,
    changedFiles: actualChanged,
    unexpected: fileCheck.ok ? [] : fileCheck.unexpected,
    missing: fileCheck.ok ? [] : fileCheck.missing,
    deterministic,
    diffTextMatches: textCheck.ok,
  };
  if (!integrity.ok)
    return finish(
      "UNEXPECTED_CHANGE",
      fileCheck.ok ? "Patch-Anwendung war nicht deterministisch." : fileCheck.reason,
      { integrity, finalDiff },
    );

  // 4 · Nur freigegebene Befehle, in freigegebener Reihenfolge.
  for (const command of gate.commands) {
    if (Date.now() - startMs > SANDBOX_LIMITS.totalTimeoutMs)
      return finish("TIMEOUT", "Gesamtlaufzeit überschritten.", { integrity, finalDiff });
    const { file, args: cmdArgs } = shellWords(command);
    const begun = Date.now();
    const res = runRaw(file, cmdArgs, work, SANDBOX_LIMITS.commandTimeoutMs, env);
    const step: SandboxStep = {
      command,
      exitCode: res.status,
      durationMs: Date.now() - begun,
      timedOut: res.status === null,
      output: cap(res.output),
    };
    steps.push(step);
    if (step.timedOut)
      return finish("TIMEOUT", `Befehl überschritt die Zeitgrenze: ${command}`, {
        integrity,
        finalDiff,
      });
    if (step.exitCode !== 0)
      return finish("TEST_FAILED", `Befehl fehlgeschlagen: ${command}`, { integrity, finalDiff });
  }

  return finish("PASSED", null, { integrity, finalDiff });
}

function modules_(projectRoot: string): string {
  return join(projectRoot, "node_modules");
}
