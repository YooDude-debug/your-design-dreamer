/**
 * ORB Developer / Repair Environment – Phase 3: echte Sandbox-Ausführung.
 *
 * Kette: KNOWN FAILURE → APPROVED PROPOSAL → SANDBOX → PATCH → REGRESSION → RESULT.
 *
 * Der Test führt den genehmigten Fix wirklich aus – aber ausschliesslich in
 * einer isolierten Arbeitskopie des Basisstands. Der Arbeitsbaum des Projekts
 * bleibt unverändert; das wird am Ende ausdrücklich geprüft.
 */
import { execFileSync } from "node:child_process";

import { afterAll, describe, expect, it } from "vitest";

import { diagnoseMemoryRecallCase, proposalFromDiagnosis } from "@/orb-dev/diagnose.server";
import { fixFingerprint, type FixApproval, type FixProposal } from "@/orb-dev/fix-model";
import { executeApprovedFixInSandbox } from "@/orb-dev/sandbox.server";

const REGRESSION = "tests/orb-memory-recall-age.regression.test.ts";

function treeState(): string {
  return execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).toString();
}

const before = treeState();

afterAll(() => {
  // Der laufende Code darf zu keinem Zeitpunkt verändert worden sein.
  expect(treeState()).toBe(before);
});

async function approvedFix(): Promise<{ proposal: FixProposal; approval: FixApproval }> {
  const diagnosis = await diagnoseMemoryRecallCase();
  const candidate = proposalFromDiagnosis(diagnosis, "ORB-FIX-0001");
  if ("error" in candidate) throw new Error(candidate.error);
  // Nur der Regressionsbefehl, damit der Test kurz bleibt; Typecheck, Lint und
  // Build laufen im vollständigen Runner-Durchlauf (siehe Phase-3-Bericht).
  const proposal: FixProposal = {
    ...candidate,
    operations: [
      { kind: "edit_file", path: "src/orb-core/memory.ts" },
      { kind: "edit_file", path: "src/orb-core/recall.ts" },
      {
        kind: "run_command",
        command: `bunx vitest run ${REGRESSION} tests/orb-memory-recall-fix.test.ts tests/orb-memory.test.ts`,
      },
    ],
    state: "APPROVED",
  };
  const approval: FixApproval = {
    fixId: proposal.fixId,
    fingerprint: fixFingerprint(proposal),
    operations: proposal.operations,
    approvedBy: "test-admin",
    approvedAt: new Date().toISOString(),
    source: "admin_ui",
  };
  return { proposal, approval };
}

describe("Sandbox führt den genehmigten Fix isoliert aus", () => {
  it("reproduziert den bekannten Fehler, wendet den Patch an und besteht die Regression", async () => {
    const { proposal, approval } = await approvedFix();
    const record = await executeApprovedFixInSandbox({
      proposal,
      approval,
      executor: "vitest",
      projectRoot: process.cwd(),
    });

    expect(record.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    // 1 · bekannter Fehler im unveränderten Basisstand
    expect(record.reproduction.attempted).toBe(true);
    expect(record.reproduction.failureConfirmed).toBe(true);
    // 2 · genehmigter Patch exakt angewendet
    expect(record.patchApplied).toBe(true);
    // 3 · keine Änderung außerhalb des genehmigten Diff
    expect(record.integrity.ok).toBe(true);
    expect(record.integrity.unexpected).toEqual([]);
    expect(record.integrity.missing).toEqual([]);
    expect(record.integrity.changedFiles).toContain("src/orb-core/memory.ts");
    expect(record.integrity.changedFiles).toContain(REGRESSION);
    // 4 · Tests nach dem Fix grün
    expect(record.steps.every((s) => s.exitCode === 0)).toBe(true);
    expect(record.state).toBe("PASSED");
    // 5 · Sandbox wieder entfernt
    expect(record.cleanedUp).toBe(true);
  }, 300_000);

  it("verweigert die Ausführung ohne gültige Freigabe", async () => {
    const { proposal } = await approvedFix();
    const record = await executeApprovedFixInSandbox({
      proposal,
      approval: null,
      executor: "vitest",
      projectRoot: process.cwd(),
    });
    expect(record.state).toBe("APPROVAL_INVALID");
    expect(record.patchApplied).toBe(false);
    expect(record.steps).toEqual([]);
  }, 60_000);

  it("verweigert die Ausführung nach nachträglicher Diff-Änderung", async () => {
    const { proposal, approval } = await approvedFix();
    const tampered: FixProposal = { ...proposal, diff: `${proposal.diff}\n# nachträglich\n` };
    const record = await executeApprovedFixInSandbox({
      proposal: tampered,
      approval,
      executor: "vitest",
      projectRoot: process.cwd(),
    });
    expect(record.state).toBe("APPROVAL_INVALID");
    expect(record.patchApplied).toBe(false);
  }, 60_000);
});
