/**
 * ORB Developer / Repair Environment – Phase 1.
 *
 * Geprüft werden die Sicherheitsgrenzen: Phasenmodell, Fix-ID, Bindung der
 * Freigabe an den konkreten Diff, Invalidierung nach Änderung, Ausschluss von
 * LLM-/Memory-/Graph-Freigaben, Pfad-Allowlist, Secret-Schutz und die
 * serverseitige Admin-Pflicht.
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ALLOWED_TRANSITIONS,
  APPROVAL_GATE_STATE,
  canTransition,
  checkApproval,
  checkExecutionAllowed,
  fixFingerprint,
  formatFixId,
  isApprovalSourceAllowed,
  isFixId,
  mayProposeRepair,
  memoryGrantsAuthority,
  PHASE1_DEPLOYMENT_ENABLED,
  PHASE1_SELF_MODIFICATION_ENABLED,
  PHASE1_WRITE_OPERATIONS_ENABLED,
  type FixApproval,
  type FixProposal,
} from "@/orb-dev/fix-model";
import { redactSecrets, resolveReadablePath } from "@/orb-dev/code-access.server";

const FUNCTIONS = readFileSync("src/lib/orb-dev.functions.ts", "utf8");

function proposal(): FixProposal {
  return {
    fixId: "ORB-FIX-0001",
    createdAt: "2026-09-22T17:00:00.000Z",
    createdBy: "orb_diagnostic",
    rootCause: "Fragewort wird zum Thema",
    rootCauseLevel: "ROOT_CAUSE_PROVEN",
    files: ["src/orb-core/memory.ts"],
    diff: "--- a\n+++ b\n+QUESTION_WORDS",
    operations: [{ kind: "edit_file", path: "src/orb-core/memory.ts" }],
    testPlan: ["Recall-Regression"],
    expectedEffects: ["Altersfrage findet die Erinnerung"],
    risks: ["Filter zu breit"],
    rollbackPlan: ["Änderung zurücknehmen"],
    state: "WAITING_FOR_ADMIN_APPROVAL",
  };
}

function approvalFor(p: FixProposal): FixApproval {
  return {
    fixId: p.fixId,
    fingerprint: fixFingerprint(p),
    operations: p.operations,
    approvedBy: "admin-1",
    approvedAt: "2026-09-22T17:05:00.000Z",
    source: "admin_ui",
  };
}

describe("Phasenmodell", () => {
  it("erlaubt nur den vorgesehenen Weg", () => {
    expect(canTransition("ANALYZING", "DIAGNOSIS_READY")).toBe(true);
    expect(canTransition("FIX_PROPOSED", "WAITING_FOR_ADMIN_APPROVAL")).toBe(true);
    expect(canTransition("WAITING_FOR_ADMIN_APPROVAL", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "EXECUTING")).toBe(true);
  });

  it("erlaubt keine Abkürzung um die Freigabe herum", () => {
    expect(canTransition("FIX_PROPOSED", "APPROVED")).toBe(false);
    expect(canTransition("DIAGNOSIS_READY", "EXECUTING")).toBe(false);
    expect(canTransition("ANALYZING", "COMPLETED")).toBe(false);
    expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
    expect(APPROVAL_GATE_STATE).toBe("WAITING_FOR_ADMIN_APPROVAL");
  });
});

describe("Fix-ID", () => {
  it("ist eindeutig formatiert", () => {
    expect(formatFixId(1)).toBe("ORB-FIX-0001");
    expect(formatFixId(42)).toBe("ORB-FIX-0042");
    expect(isFixId("ORB-FIX-0001")).toBe(true);
    expect(isFixId("orb-fix-1")).toBe(false);
    expect(() => formatFixId(0)).toThrow();
  });
});

describe("Approval-Bindung", () => {
  it("gilt für genau diesen Fix und Diff", () => {
    const p = proposal();
    expect(checkApproval(p, approvalFor(p)).valid).toBe(true);
  });

  it("verweigert ohne Freigabe", () => {
    expect(checkApproval(proposal(), null).valid).toBe(false);
  });

  it("verfällt, sobald sich der Diff ändert", () => {
    const p = proposal();
    const approval = approvalFor(p);
    const changed = { ...p, diff: `${p.diff}\n+weitere Zeile` };
    const result = checkApproval(changed, approval);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("ungültig");
  });

  it("verfällt bei zusätzlicher Datei, anderem Befehl oder anderem Testplan", () => {
    const p = proposal();
    const approval = approvalFor(p);
    const moreFiles = { ...p, files: [...p.files, "src/orb-core/recall.ts"] };
    const otherCommand = {
      ...p,
      operations: [{ kind: "run_command", command: "rm -rf /" } as const],
    };
    const otherTests = { ...p, testPlan: ["anderer Plan"] };
    for (const variant of [moreFiles, otherCommand, otherTests]) {
      expect(checkApproval(variant, approval).valid).toBe(false);
    }
  });

  it("gilt nie für eine andere Fix-ID", () => {
    const p = proposal();
    expect(checkApproval({ ...p, fixId: "ORB-FIX-0002" }, approvalFor(p)).valid).toBe(false);
  });

  it("deckt nur ausdrücklich freigegebene Operationen", () => {
    const p = proposal();
    const approval = approvalFor(p);
    expect(
      checkApproval(p, approval, { kind: "edit_file", path: "src/orb-core/memory.ts" }).valid,
    ).toBe(true);
    expect(checkApproval(p, approval, { kind: "run_migration", name: "add_table" }).valid).toBe(
      false,
    );
    expect(
      checkApproval(p, approval, { kind: "edit_file", path: "src/routes/admin.tsx" }).valid,
    ).toBe(false);
  });

  it("akzeptiert ausschliesslich die Administrator-Oberfläche als Quelle", () => {
    expect(isApprovalSourceAllowed("admin_ui")).toBe(true);
    for (const source of ["llm", "memory", "graph", "system_prompt", "autonomous"]) {
      expect(isApprovalSourceAllowed(source)).toBe(false);
      const p = proposal();
      const forged = { ...approvalFor(p), source } as unknown as FixApproval;
      expect(checkApproval(p, forged).valid).toBe(false);
    }
  });

  it("Memory erzeugt niemals Rechte", () => {
    expect(memoryGrantsAuthority()).toBe(false);
  });
});

describe("Root-Cause-Klassifizierung", () => {
  it("nur bewiesene Ursachen dürfen zu einem Fix führen", () => {
    expect(mayProposeRepair("ROOT_CAUSE_PROVEN")).toBe(true);
    expect(mayProposeRepair("ROOT_CAUSE_PLAUSIBLE")).toBe(false);
    expect(mayProposeRepair("ROOT_CAUSE_UNKNOWN")).toBe(false);
  });

  it("eine unbewiesene Ursache ist auch mit Freigabe nicht ausführbar", () => {
    const p = { ...proposal(), rootCauseLevel: "ROOT_CAUSE_PLAUSIBLE" as const };
    expect(checkApproval(p, approvalFor(p)).valid).toBe(false);
  });
});

describe("Phase 1 ohne Selbstveränderung", () => {
  it("Schreiben, Self-Modification und Deployment sind aus", () => {
    expect(PHASE1_WRITE_OPERATIONS_ENABLED).toBe(false);
    expect(PHASE1_SELF_MODIFICATION_ENABLED).toBe(false);
    expect(PHASE1_DEPLOYMENT_ENABLED).toBe(false);
    expect(checkExecutionAllowed().allowed).toBe(false);
  });
});

describe("READ-ONLY Codezugriff", () => {
  it("erlaubt nur freigegebene Wurzeln", () => {
    expect(resolveReadablePath("src/orb-core/memory.ts")).toBe("src/orb-core/memory.ts");
    expect(resolveReadablePath("tests/orb-memory.test.ts")).toBe("tests/orb-memory.test.ts");
    expect(() => resolveReadablePath("package.json")).toThrow();
    expect(() => resolveReadablePath("../../etc/passwd")).toThrow();
    expect(() => resolveReadablePath("src/orb-core/../../.env")).toThrow();
  });

  it("sperrt Secrets und Umgebungsdateien", () => {
    for (const path of [".env", ".env.production", "src/lib/secret-keys.ts", "node_modules/x.ts"]) {
      expect(() => resolveReadablePath(path)).toThrow();
    }
  });

  it("macht schlüsselartige Inhalte unkenntlich", () => {
    expect(redactSecrets("const k = 'sb_secret_abc123def'")).toContain("[REDACTED]");
    expect(redactSecrets("OPENAI_API_KEY=sk-livekey1234567")).toContain("[REDACTED]");
    expect(redactSecrets("const k = 'sk-livekey1234567'")).not.toContain("sk-livekey1234567");
    expect(redactSecrets("const topic = 'hardware'")).toBe("const topic = 'hardware'");
  });
});

describe("Serverseitige Admin-Pflicht", () => {
  it("jede Server-Funktion prüft Authentifizierung und Administratorrolle", () => {
    const handlers = FUNCTIONS.match(/createServerFn\(/g) ?? [];
    const authed = FUNCTIONS.match(/\.middleware\(\[requireSupabaseAuth\]\)/g) ?? [];
    const admin = FUNCTIONS.match(/assertAdmin\(context\)/g) ?? [];
    expect(handlers.length).toBeGreaterThanOrEqual(7);
    expect(authed.length).toBe(handlers.length);
    expect(admin.length).toBe(handlers.length);
  });

  it("die Freigabequelle ist serverseitig fest verdrahtet", () => {
    expect(FUNCTIONS).toContain('source: "admin_ui"');
    expect(FUNCTIONS).not.toMatch(/source:\s*data\./);
  });

  it("es gibt keine Ausführungs-, Git- oder Deployment-Operation", () => {
    for (const forbidden of ["child_process", "git commit", "writeFile", "deploy("]) {
      expect(FUNCTIONS).not.toContain(forbidden);
    }
  });
});
