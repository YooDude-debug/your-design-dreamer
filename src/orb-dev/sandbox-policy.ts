/**
 * ORB Developer / Repair Environment – Phase 3: Sandbox-Richtlinie (rein).
 *
 * Diese Datei enthält KEINEN Dateizugriff, KEINE Prozessausführung, keine
 * Datenbank und keinen LLM-Aufruf. Sie beschreibt ausschliesslich, was in einer
 * isolierten Reparatur-Sandbox überhaupt erlaubt sein darf:
 *
 *   · welche Pfade ein genehmigter Patch berühren darf
 *   · welche Pfade absolut geschützt sind (das Repair-System selbst)
 *   · welche Befehle die Testpipeline ausführen darf
 *   · welche Ressourcengrenzen gelten
 *   · welche Umgebungsvariablen die Sandbox überhaupt sehen darf
 *
 * Grundsatz: Verweigern ist der Standard. Erlaubt ist nur, was hier steht.
 */

import type { FixApproval, FixOperation, FixProposal } from "./fix-model";
import { checkApproval } from "./fix-model";

/* ----------------------------------------------------------------- Zustände */

/** Zusätzliche Ausführungszustände der Sandbox (Phase 3). */
export const SANDBOX_STATES = [
  "EXECUTION_QUEUED",
  "EXECUTING",
  "PATCH_APPLIED",
  "TESTING",
  "PASSED",
  "EXECUTION_FAILED",
  "TEST_FAILED",
  "UNEXPECTED_CHANGE",
  "APPROVAL_INVALID",
  "BLOCKED_OPERATION",
  "TIMEOUT",
  "RESOURCE_LIMIT",
  "SANDBOX_ERROR",
] as const;

export type SandboxState = (typeof SANDBOX_STATES)[number];

/** Nach einem Fehlzustand gibt es KEINEN automatischen Neuversuch. */
export const SANDBOX_FAILURE_STATES: SandboxState[] = [
  "EXECUTION_FAILED",
  "TEST_FAILED",
  "UNEXPECTED_CHANGE",
  "APPROVAL_INVALID",
  "BLOCKED_OPERATION",
  "TIMEOUT",
  "RESOURCE_LIMIT",
  "SANDBOX_ERROR",
];

export function isSandboxFailure(state: SandboxState): boolean {
  return SANDBOX_FAILURE_STATES.includes(state);
}

/** Ein Neuversuch braucht immer eine neue, ausdrückliche Administrator-Aktion. */
export const SANDBOX_AUTO_RETRY_ENABLED = false;

/* --------------------------------------------------------------- Ressourcen */

export const SANDBOX_LIMITS = {
  /** Harte Obergrenze je Befehl. */
  commandTimeoutMs: 240_000,
  /** Harte Obergrenze der gesamten Ausführung. */
  totalTimeoutMs: 900_000,
  /** Maximale Ausgabe je Befehl, danach wird abgeschnitten. */
  maxOutputBytes: 200_000,
  /** Maximale Anzahl Dateien, die ein Patch berühren darf. */
  maxPatchedFiles: 25,
  /** Maximale Grösse des Patch-Textes. */
  maxDiffBytes: 200_000,
  /** Maximale Anzahl Befehle in der Pipeline. */
  maxCommands: 12,
} as const;

/* -------------------------------------------------------------------- Pfade */

/**
 * Absolut geschützt: das Repair-System selbst, Auth/Rollen, Datenbank,
 * Infrastruktur und Secrets. Ein Fix darf seine eigenen Sicherheitsgrenzen
 * niemals verändern (Regel 16).
 */
export const PROTECTED_PATH_PREFIXES = [
  "src/orb-dev/",
  "src/lib/orb-dev.functions.ts",
  "src/lib/admin.server.ts",
  "src/lib/admin.functions.ts",
  "src/integrations/",
  "src/routes/admin",
  "drizzle/",
  "supabase/",
  "scripts/orb-repair-sandbox.ts",
  "tests/orb-dev-",
  "tests/integration/db-orb-dev-security.test.ts",
  ".env",
  ".github/",
  "package.json",
  "bun.lock",
  "vite.config.ts",
  "wrangler.toml",
  "drizzle.config.ts",
];

/** Nur innerhalb dieser Wurzeln darf ein genehmigter Patch überhaupt wirken. */
export const ALLOWED_PATCH_ROOTS = ["src/orb-core/", "src/lib/", "src/components/", "tests/"];

export type PathVerdict = { allowed: true } | { allowed: false; reason: string };

export function classifyPatchPath(path: string): PathVerdict {
  const p = (path ?? "").trim();
  if (p.length === 0) return { allowed: false, reason: "Leerer Pfad." };
  if (p.startsWith("/") || p.includes("..") || p.includes("\\"))
    return { allowed: false, reason: `Pfad verlässt den Arbeitsbereich: ${p}` };
  if (PROTECTED_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix)))
    return { allowed: false, reason: `Geschützter Bereich des Repair-Systems: ${p}` };
  if (!ALLOWED_PATCH_ROOTS.some((root) => p.startsWith(root)))
    return { allowed: false, reason: `Pfad liegt außerhalb der erlaubten Wurzeln: ${p}` };
  return { allowed: true };
}

export function classifyPatchPaths(paths: string[]): PathVerdict {
  if (paths.length === 0) return { allowed: false, reason: "Patch berührt keine Datei." };
  if (paths.length > SANDBOX_LIMITS.maxPatchedFiles)
    return { allowed: false, reason: `Patch berührt zu viele Dateien (${paths.length}).` };
  for (const p of paths) {
    const verdict = classifyPatchPath(p);
    if (!verdict.allowed) return verdict;
  }
  return { allowed: true };
}

/* ------------------------------------------------------------------ Befehle */

/** Ausschliesslich diese Befehlsformen sind in der Sandbox zugelassen. */
export const ALLOWED_COMMAND_PREFIXES = [
  "bunx tsgo --noEmit",
  "bunx eslint",
  "bunx vitest run",
  "bun run build",
  "bun run typecheck",
  "bun run lint",
];

/** Niemals erlaubt – auch nicht als Teil eines erlaubten Befehls. */
export const FORBIDDEN_COMMAND_RE =
  /(deploy|publish|wrangler|git\s+(push|commit|merge|checkout|reset|rebase|tag)|supabase|psql|drizzle-kit|migrate|migration|curl|wget|ssh|scp|docker|kubectl|sudo|chmod|chown|printenv|\benv\b|npm\s+publish|rm\s+-rf\s+\/|>\s*\/dev\/(?!null)|\|\||&&|;|`|\$\(|>>?\s*\S*\.env)/i;

export type CommandVerdict = { allowed: true } | { allowed: false; reason: string };

export function classifyCommand(command: string): CommandVerdict {
  const c = (command ?? "").trim();
  if (c.length === 0) return { allowed: false, reason: "Leerer Befehl." };
  if (FORBIDDEN_COMMAND_RE.test(c))
    return { allowed: false, reason: `Befehl enthält eine verbotene Operation: ${c}` };
  if (!ALLOWED_COMMAND_PREFIXES.some((prefix) => c === prefix || c.startsWith(`${prefix} `)))
    return { allowed: false, reason: `Befehl steht nicht auf der Positivliste: ${c}` };
  return { allowed: true };
}

/* ---------------------------------------------------------------- Operationen */

/** Erlaubte Operationsarten in der Sandbox. Migrationen sind ausgeschlossen. */
export function classifyOperation(op: FixOperation): CommandVerdict {
  if (op.kind === "run_migration")
    return { allowed: false, reason: `Migration in der Sandbox nicht erlaubt: ${op.name}` };
  if (op.kind === "edit_file") return classifyPatchPath(op.path);
  return classifyCommand(op.command);
}

/* ------------------------------------------------------------------ Secrets */

/** Umgebungsvariablen, die die Sandbox sehen darf. Alles andere entfällt. */
export const SANDBOX_ENV_ALLOWLIST = ["PATH", "HOME", "LANG", "TZ", "CI", "NODE_ENV", "TMPDIR"];

export function sandboxEnv(source: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of SANDBOX_ENV_ALLOWLIST) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) out[key] = value;
  }
  out["ORB_SANDBOX"] = "1";
  out["NODE_ENV"] = out["NODE_ENV"] ?? "test";
  return out;
}

/* ---------------------------------------------------- Gesamtprüfung Anfrage */

export type ExecutionGate =
  | { allowed: true; operations: FixOperation[]; commands: string[] }
  | { allowed: false; state: SandboxState; reason: string };

/**
 * Serverseitige Gesamtprüfung vor jeder Sandbox-Ausführung. Sie ersetzt keine
 * Admin-Prüfung, sondern kommt zusätzlich dazu.
 *
 * Reihenfolge: Freigabe → Fingerabdruck → Version → Operationen → Pfade → Befehle.
 */
export function checkSandboxExecutionRequest(args: {
  proposal: FixProposal;
  approval: FixApproval | null;
  approvedVersion?: number;
  currentVersion?: number;
  diffToExecute: string;
  patchPaths: string[];
}): ExecutionGate {
  const { proposal, approval, approvedVersion, currentVersion, diffToExecute, patchPaths } = args;

  const approvalCheck = checkApproval(proposal, approval);
  if (!approvalCheck.valid)
    return { allowed: false, state: "APPROVAL_INVALID", reason: approvalCheck.reason };

  if (
    typeof approvedVersion === "number" &&
    typeof currentVersion === "number" &&
    approvedVersion !== currentVersion
  )
    return {
      allowed: false,
      state: "APPROVAL_INVALID",
      reason: `Freigegebene Fix-Version ${approvedVersion} weicht von der aktuellen Version ${currentVersion} ab.`,
    };

  if (diffToExecute !== proposal.diff)
    return {
      allowed: false,
      state: "APPROVAL_INVALID",
      reason: "Der auszuführende Diff entspricht nicht dem freigegebenen Diff.",
    };

  if (diffToExecute.length === 0)
    return { allowed: false, state: "EXECUTION_FAILED", reason: "Kein Patch-Inhalt vorhanden." };

  if (diffToExecute.length > SANDBOX_LIMITS.maxDiffBytes)
    return { allowed: false, state: "RESOURCE_LIMIT", reason: "Patch überschreitet die Grössengrenze." };

  const pathVerdict = classifyPatchPaths(patchPaths);
  if (!pathVerdict.allowed)
    return { allowed: false, state: "BLOCKED_OPERATION", reason: pathVerdict.reason };

  // Jede Datei des Patches muss ausdrücklich freigegeben sein.
  const approvedFiles = new Set(
    approval!.operations.filter((o) => o.kind === "edit_file").map((o) => o.path),
  );
  const declaredFiles = new Set(proposal.files);
  for (const p of patchPaths) {
    const isNewTestFile = p.startsWith("tests/");
    if (!approvedFiles.has(p) && !declaredFiles.has(p) && !isNewTestFile)
      return {
        allowed: false,
        state: "BLOCKED_OPERATION",
        reason: `Patch berührt eine nicht freigegebene Datei: ${p}`,
      };
  }

  const commands: string[] = [];
  for (const op of approval!.operations) {
    const verdict = classifyOperation(op);
    if (!verdict.allowed)
      return { allowed: false, state: "BLOCKED_OPERATION", reason: verdict.reason };
    if (op.kind === "run_command") commands.push(op.command);
  }

  if (commands.length === 0)
    return {
      allowed: false,
      state: "BLOCKED_OPERATION",
      reason: "Freigabe enthält keinen ausführbaren Testbefehl.",
    };
  if (commands.length > SANDBOX_LIMITS.maxCommands)
    return { allowed: false, state: "RESOURCE_LIMIT", reason: "Zu viele Befehle in der Freigabe." };

  return { allowed: true, operations: approval!.operations, commands };
}
