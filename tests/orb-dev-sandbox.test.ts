/**
 * ORB Developer / Repair Environment – Phase 3: Sicherheits- und Integritätstests.
 *
 * Geprüft wird ohne Prozessausführung: Freigabe-Bindung, Autorisierung,
 * Sandbox-Positivlisten, Secret-Schutz, Diff-Integrität und die Abwesenheit
 * jeder autonomen Selbstreparatur.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ALLOWED_TRANSITIONS,
  PHASE3_AUTONOMOUS_SELF_REPAIR_ENABLED,
  PHASE3_DEPLOYMENT_ENABLED,
  PHASE3_LIVE_CODE_WRITE_ENABLED,
  PHASE3_SANDBOX_EXECUTION_ENABLED,
  checkLiveExecutionAllowed,
  fixFingerprint,
  memoryGrantsAuthority,
  type FixApproval,
  type FixProposal,
} from "@/orb-dev/fix-model";
import {
  SANDBOX_AUTO_RETRY_ENABLED,
  SANDBOX_LIMITS,
  checkSandboxExecutionRequest,
  classifyCommand,
  classifyOperation,
  classifyPatchPath,
  isSandboxFailure,
  sandboxEnv,
} from "@/orb-dev/sandbox-policy";
import {
  compareChangedFiles,
  compareDiffText,
  newTestFiles,
  parsePatch,
  patchPaths,
} from "@/orb-dev/diff-integrity";
import { MEMORY_RECALL_AGE_PATCH } from "@/orb-dev/fixes/memory-recall-age.patch";

const FUNCTIONS = readFileSync("src/lib/orb-dev.functions.ts", "utf8");
const SANDBOX = readFileSync("src/orb-dev/sandbox.server.ts", "utf8");

function proposal(overrides: Partial<FixProposal> = {}): FixProposal {
  return {
    fixId: "ORB-FIX-0001",
    createdAt: "2026-09-22T10:00:00.000Z",
    createdBy: "orb_diagnostic",
    rootCause: "Fragewort wird zum Thema",
    rootCauseLevel: "ROOT_CAUSE_PROVEN",
    files: ["src/orb-core/memory.ts", "src/orb-core/recall.ts"],
    diff: MEMORY_RECALL_AGE_PATCH,
    operations: [
      { kind: "edit_file", path: "src/orb-core/memory.ts" },
      { kind: "edit_file", path: "src/orb-core/recall.ts" },
      { kind: "run_command", command: "bunx vitest run tests/orb-memory.test.ts" },
    ],
    testPlan: ["Regression grün"],
    expectedEffects: ["Altersfrage findet Erinnerung"],
    risks: ["Themenfilter zu streng"],
    rollbackPlan: ["Änderung zurücknehmen"],
    state: "APPROVED",
    ...overrides,
  };
}

function approvalFor(p: FixProposal, overrides: Partial<FixApproval> = {}): FixApproval {
  return {
    fixId: p.fixId,
    fingerprint: fixFingerprint(p),
    operations: p.operations,
    approvedBy: "admin-1",
    approvedAt: "2026-09-22T10:05:00.000Z",
    source: "admin_ui",
    ...overrides,
  };
}

function gate(p: FixProposal, a: FixApproval | null, extra: Record<string, unknown> = {}) {
  return checkSandboxExecutionRequest({
    proposal: p,
    approval: a,
    diffToExecute: p.diff,
    patchPaths: patchPaths(p.diff),
    ...extra,
  });
}

/* ------------------------------------------------------------------ Approval */

describe("Freigabe ist harte Voraussetzung", () => {
  it("1 gültige Freigabe erlaubt die Sandbox-Ausführung", () => {
    const p = proposal();
    const result = gate(p, approvalFor(p));
    expect(result.allowed).toBe(true);
  });

  it("2 ohne Freigabe wird blockiert", () => {
    const result = gate(proposal(), null);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.state).toBe("APPROVAL_INVALID");
  });

  it("3 geänderter Diff entwertet die Freigabe", () => {
    const p = proposal();
    const a = approvalFor(p);
    const changed = proposal({ diff: `${p.diff}\n# spätere Änderung\n` });
    const result = gate(changed, a);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.state).toBe("APPROVAL_INVALID");
  });

  it("4 falscher Fingerabdruck wird abgewiesen", () => {
    const p = proposal();
    const result = gate(p, approvalFor(p, { fingerprint: "0000000000000000" }));
    expect(result.allowed).toBe(false);
  });

  it("5 abweichende Fix-Version blockiert", () => {
    const p = proposal();
    const result = gate(p, approvalFor(p), { approvedVersion: 1, currentVersion: 2 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain("Version");
  });

  it("6 manipulierte Fix-ID blockiert", () => {
    const p = proposal();
    const result = gate(p, approvalFor(p, { fixId: "ORB-FIX-9999" }));
    expect(result.allowed).toBe(false);
  });

  it("7 nur ein bewiesener Grund darf ausgeführt werden", () => {
    const p = proposal({ rootCauseLevel: "ROOT_CAUSE_PLAUSIBLE" });
    expect(gate(p, approvalFor(p)).allowed).toBe(false);
  });

  it("8 ein anderer auszuführender Diff wird erkannt", () => {
    const p = proposal();
    const result = checkSandboxExecutionRequest({
      proposal: p,
      approval: approvalFor(p),
      diffToExecute: `${p.diff}\n+böse Zeile\n`,
      patchPaths: patchPaths(p.diff),
    });
    expect(result.allowed).toBe(false);
  });

  it("9 nur „admin_ui“ darf freigeben – Memory/LLM nie", () => {
    const p = proposal();
    const forged = approvalFor(p, { source: "memory" as unknown as FixApproval["source"] });
    expect(gate(p, forged).allowed).toBe(false);
    expect(memoryGrantsAuthority()).toBe(false);
  });
});

/* ------------------------------------------------------------- Sandbox-Regeln */

describe("Sandbox-Positivlisten", () => {
  it("10 geschützte Bereiche des Repair-Systems sind unantastbar", () => {
    for (const path of [
      "src/orb-dev/fix-model.ts",
      "src/orb-dev/sandbox-policy.ts",
      "src/lib/admin.server.ts",
      "src/integrations/supabase/client.ts",
      "drizzle/migrations/0048_orb_dev_repair_persistence.sql",
      "tests/orb-dev-sandbox.test.ts",
      ".env",
      "package.json",
    ]) {
      expect(classifyPatchPath(path).allowed).toBe(false);
    }
  });

  it("11 Pfade außerhalb der erlaubten Wurzeln werden blockiert", () => {
    expect(classifyPatchPath("../../etc/passwd").allowed).toBe(false);
    expect(classifyPatchPath("/etc/hosts").allowed).toBe(false);
    expect(classifyPatchPath("docs/irgendwas.md").allowed).toBe(false);
    expect(classifyPatchPath("src/orb-core/memory.ts").allowed).toBe(true);
  });

  it("12 Deployment-, Datenbank- und Secret-Befehle sind verboten", () => {
    for (const cmd of [
      "bun run deploy",
      "wrangler deploy",
      "git commit -am fix",
      "supabase db push",
      "psql $DATABASE_URL",
      "bunx drizzle-kit migrate",
      "curl https://example.com",
      "printenv",
      "bunx vitest run && curl http://x",
      "cat .env",
    ]) {
      expect(classifyCommand(cmd).allowed).toBe(false);
    }
  });

  it("13 nur Typecheck, Lint, Tests und Build sind erlaubt", () => {
    expect(classifyCommand("bunx tsgo --noEmit").allowed).toBe(true);
    expect(classifyCommand("bunx eslint src/orb-core/memory.ts").allowed).toBe(true);
    expect(classifyCommand("bunx vitest run tests/orb-memory.test.ts").allowed).toBe(true);
    expect(classifyCommand("bun run build").allowed).toBe(true);
  });

  it("14 Migrationen sind als Operation ausgeschlossen", () => {
    expect(classifyOperation({ kind: "run_migration", name: "0049_x" }).allowed).toBe(false);
  });

  it("15 Patch außerhalb der freigegebenen Dateien wird blockiert", () => {
    const p = proposal();
    const a = approvalFor(p);
    const result = checkSandboxExecutionRequest({
      proposal: p,
      approval: a,
      diffToExecute: p.diff,
      patchPaths: [...patchPaths(p.diff), "src/orb-dev/fix-model.ts"],
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.state).toBe("BLOCKED_OPERATION");
  });

  it("16 die Sandbox erhält keine Secrets und keine Datenbankzugänge", () => {
    const env = sandboxEnv({
      PATH: "/usr/bin",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc",
      OPENAI_API_KEY: "sk-abcdefghijklmnop",
      DATABASE_URL: "postgres://x",
      VITE_SUPABASE_URL: "https://x",
    });
    expect(env["PATH"]).toBe("/usr/bin");
    expect(Object.keys(env)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(Object.keys(env)).not.toContain("OPENAI_API_KEY");
    expect(Object.keys(env)).not.toContain("DATABASE_URL");
    expect(Object.keys(env)).not.toContain("VITE_SUPABASE_URL");
  });

  it("17 Ressourcengrenzen sind gesetzt und endlich", () => {
    expect(SANDBOX_LIMITS.commandTimeoutMs).toBeGreaterThan(0);
    expect(SANDBOX_LIMITS.totalTimeoutMs).toBeGreaterThan(SANDBOX_LIMITS.commandTimeoutMs);
    expect(SANDBOX_LIMITS.maxOutputBytes).toBeGreaterThan(0);
    expect(SANDBOX_LIMITS.maxPatchedFiles).toBeLessThanOrEqual(25);
  });

  it("18 nach einem Fehler gibt es keinen automatischen Neuversuch", () => {
    expect(SANDBOX_AUTO_RETRY_ENABLED).toBe(false);
    for (const state of [
      "EXECUTION_FAILED",
      "TEST_FAILED",
      "UNEXPECTED_CHANGE",
      "APPROVAL_INVALID",
      "TIMEOUT",
      "RESOURCE_LIMIT",
      "SANDBOX_ERROR",
    ] as const) {
      expect(isSandboxFailure(state)).toBe(true);
      expect(ALLOWED_TRANSITIONS[state]).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------- Diff-Integrität */

describe("Diff-Integrität", () => {
  it("19 der genehmigte Patch ist ein echter Unified-Diff auf erlaubte Dateien", () => {
    const files = parsePatch(MEMORY_RECALL_AGE_PATCH);
    expect(files.map((f) => f.path)).toEqual([
      "src/orb-core/memory.ts",
      "src/orb-core/recall.ts",
      "tests/orb-memory-recall-age.regression.test.ts",
    ]);
    expect(MEMORY_RECALL_AGE_PATCH).toContain("@@");
    expect(MEMORY_RECALL_AGE_PATCH).toContain("QUESTION_WORDS");
  });

  it("20 der Patch bringt den Regressionstest selbst mit", () => {
    const tests = newTestFiles(MEMORY_RECALL_AGE_PATCH);
    expect(tests).toHaveLength(1);
    expect(tests[0]?.path).toBe("tests/orb-memory-recall-age.regression.test.ts");
    expect(tests[0]?.content).toContain("Wie alt bin ich?");
  });

  it("21 erwartete gleich tatsächliche Dateimenge ist PASS", () => {
    const result = compareChangedFiles(["a.ts", "b.ts"], ["b.ts", "a.ts"]);
    expect(result.ok).toBe(true);
  });

  it("22 eine zusätzliche Änderung ist FAIL", () => {
    const result = compareChangedFiles(["a.ts"], ["a.ts", "src/orb-dev/fix-model.ts"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.unexpected).toContain("src/orb-dev/fix-model.ts");
  });

  it("23 eine fehlende genehmigte Änderung ist FAIL", () => {
    const result = compareChangedFiles(["a.ts", "b.ts"], ["a.ts"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toContain("b.ts");
  });

  it("24 Diff-Textvergleich ignoriert nur Rauschen, nicht Inhalt", () => {
    expect(compareDiffText("a\nindex 123..456\nb", "a\nb").ok).toBe(true);
    expect(compareDiffText("a\nb", "a\nb\n+zusatz").ok).toBe(false);
  });
});

/* ------------------------------------------------------- Grenzen der Phase 3 */

describe("Phase-3-Grenzen", () => {
  it("25 Sandbox ja, Live-Code und Deployment nein", () => {
    expect(PHASE3_SANDBOX_EXECUTION_ENABLED).toBe(true);
    expect(PHASE3_LIVE_CODE_WRITE_ENABLED).toBe(false);
    expect(PHASE3_DEPLOYMENT_ENABLED).toBe(false);
    expect(PHASE3_AUTONOMOUS_SELF_REPAIR_ENABLED).toBe(false);
    expect(checkLiveExecutionAllowed().allowed).toBe(false);
  });

  it("26 jede Sandbox-Serverfunktion prüft Auth und Administratorrolle", () => {
    for (const fn of [
      "orbDevValidateSandboxExecution",
      "orbDevQueueSandboxExecution",
      "orbDevSandboxEvents",
    ]) {
      const block = FUNCTIONS.slice(FUNCTIONS.indexOf(`export const ${fn}`));
      const body = block.slice(0, block.indexOf("\n\n/*") + 1 || block.length);
      expect(body).toContain("requireSupabaseAuth");
      expect(body).toContain("assertAdmin");
    }
  });

  it("27 der laufende Serverprozess führt selbst nichts aus", () => {
    expect(FUNCTIONS).not.toContain("executeApprovedFixInSandbox");
    expect(FUNCTIONS).not.toContain("child_process");
  });

  it("28 der Sandbox-Runner arbeitet nur in einer getrennten Arbeitskopie", () => {
    expect(SANDBOX).toContain("git");
    expect(SANDBOX).toContain("archive");
    expect(SANDBOX).toMatch(/rmSync\(workRoot/);
    expect(SANDBOX).not.toMatch(/git",\s*\["(push|commit|merge)/);
    expect(SANDBOX).not.toContain("deploy");
  });

  it("29 Ausgaben der Sandbox werden von Secrets befreit", async () => {
    const { redact } = await import("@/orb-dev/sandbox.server");
    expect(redact("key=sb_secret_abcdef")).toContain("[REDACTED]");
    expect(redact("OPENAI_API_KEY=sk-abcdefghijklmnopqrst")).toContain("[REDACTED]");
    expect(redact("alles gut")).toBe("alles gut");
  });

  it("30 die Freigabe deckt mindestens einen Testbefehl ab", () => {
    const p = proposal({ operations: [{ kind: "edit_file", path: "src/orb-core/memory.ts" }] });
    const result = gate(p, approvalFor(p));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.state).toBe("BLOCKED_OPERATION");
  });
});
