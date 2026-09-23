/**
 * ORB Developer / Repair Environment – Phase 3: echte Sandbox-Ausführung.
 *
 * Kette: REPRODUZIERBARER AUSGANGSZUSTAND → APPROVED PROPOSAL → SANDBOX →
 * PATCH → REGRESSION → RESULT.
 *
 * P16: Die Vorlage ist seit P15 synthetisch (tests/helpers/orb-dev-synthetic-fix.ts).
 * Geprüft wird die Eigenschaft der Strecke – Freigabe-Bindung, Reproduktions-
 * pflicht, Diff-Integrität, Testpipeline – nicht ein bestimmter ORB-Fehler.
 * Der Produktionscode wird dabei zu keinem Zeitpunkt in einen früheren
 * Fehlerzustand zurückversetzt.
 *
 * Der Test führt den genehmigten Fix wirklich aus – aber ausschliesslich in
 * einer isolierten Arbeitskopie des Basisstands. Der Arbeitsbaum des Projekts
 * bleibt unverändert; das wird am Ende ausdrücklich geprüft.
 */
import { execFileSync } from "node:child_process";

import { afterAll, describe, expect, it } from "vitest";

import { diagnoseMemoryRecallCase, proposalFromDiagnosis } from "@/orb-dev/diagnose.server";
import {
  checkApproval,
  fixFingerprint,
  type FixApproval,
  type FixProposal,
} from "@/orb-dev/fix-model";
import { executeApprovedFixInSandbox } from "@/orb-dev/sandbox.server";

import {
  SYNTHETIC_PROBE_FILE,
  SYNTHETIC_REGRESSION_TEST,
  syntheticProposal,
  syntheticProvenDiagnosis,
} from "./helpers/orb-dev-synthetic-fix";

function treeState(): string {
  return execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).toString();
}

const before = treeState();

afterAll(() => {
  // Der laufende Code darf zu keinem Zeitpunkt verändert worden sein.
  expect(treeState()).toBe(before);
});

function approvedFix(): { proposal: FixProposal; approval: FixApproval } {
  const proposal = syntheticProposal("ORB-FIX-0001", [
    { kind: "edit_file", path: SYNTHETIC_PROBE_FILE },
    { kind: "edit_file", path: SYNTHETIC_REGRESSION_TEST },
    { kind: "run_command", command: `bunx vitest run ${SYNTHETIC_REGRESSION_TEST}` },
  ]);
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
  it("reproduziert den Ausgangszustand, wendet den Patch an und besteht die Regression", async () => {
    const { proposal, approval } = approvedFix();
    const record = await executeApprovedFixInSandbox({
      proposal,
      approval,
      executor: "vitest",
      projectRoot: process.cwd(),
    });

    expect(record.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    // 1 · reproduzierbarer Ausgangszustand im unveränderten Basisstand
    expect(record.reproduction.attempted).toBe(true);
    expect(record.reproduction.failureConfirmed).toBe(true);
    // 2 · genehmigter Patch exakt angewendet
    expect(record.patchApplied).toBe(true);
    // 3 · keine Änderung außerhalb des genehmigten Diff
    expect(record.integrity.ok).toBe(true);
    expect(record.integrity.unexpected).toEqual([]);
    expect(record.integrity.missing).toEqual([]);
    expect(record.integrity.changedFiles).toContain(SYNTHETIC_PROBE_FILE);
    expect(record.integrity.changedFiles).toContain(SYNTHETIC_REGRESSION_TEST);
    // 4 · Tests nach dem Fix grün
    expect(record.steps.every((s) => s.exitCode === 0)).toBe(true);
    expect(record.state).toBe("PASSED");
    // 5 · Sandbox wieder entfernt
    expect(record.cleanedUp).toBe(true);
  }, 300_000);

  it("verweigert die Ausführung ohne gültige Freigabe", async () => {
    const { proposal } = approvedFix();
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
    const { proposal, approval } = approvedFix();
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

describe("Ursachenklassifikation bleibt streng (P16)", () => {
  it("erzeugt aus einer bewiesenen Ursache einen Vorschlag", () => {
    const candidate = proposalFromDiagnosis(syntheticProvenDiagnosis(), "ORB-FIX-0002");
    expect("error" in candidate).toBe(false);
  });

  it("verweigert den Vorschlag, wenn die Ursache nicht bewiesen ist", () => {
    const candidate = proposalFromDiagnosis(
      syntheticProvenDiagnosis("ROOT_CAUSE_PLAUSIBLE"),
      "ORB-FIX-0003",
    );
    expect("error" in candidate).toBe(true);
  });

  it("erzeugt für den in P15 behobenen Fehler keinen neuen Vorschlag", async () => {
    const diagnosis = await diagnoseMemoryRecallCase();
    expect(diagnosis.rootCauseLevel).not.toBe("ROOT_CAUSE_PROVEN");
    const candidate = proposalFromDiagnosis(diagnosis, "ORB-FIX-0004");
    expect("error" in candidate).toBe(true);
  });

  it("verlangt weiterhin eine menschliche Freigabe", () => {
    const { proposal, approval } = approvedFix();
    expect(checkApproval(proposal, null).valid).toBe(false);
    expect(checkApproval(proposal, { ...approval, source: "llm" as never }).valid).toBe(false);
    expect(checkApproval(proposal, approval).valid).toBe(true);
  });
});
