/**
 * ORB Developer / Repair Environment – Phase 2 (Persistenz).
 *
 * Diese Ebene prüft die Logik ohne Datenbank: Approval-Bindung, Invalidierung
 * durch Inhaltsänderung, Versionierung, Secret-Redaktion im Audit, sowie
 * statisch, dass jede Server-Funktion Authentifizierung UND Administratorrolle
 * erzwingt und die Freigabequelle nicht aus Eingaben stammen kann.
 * Die Datenbank-/RLS-Prüfungen liegen in tests/integration/db-orb-dev-security.test.ts.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  FIX_STATES,
  canTransition,
  checkApproval,
  checkExecutionAllowed,
  fixFingerprint,
  formatFixId,
  isApprovalSourceAllowed,
  memoryGrantsAuthority,
  PHASE2_EXECUTION_ENABLED,
  type FixApproval,
  type FixProposal,
} from "@/orb-dev/fix-model";
import { redactAuditText } from "@/orb-dev/repo.server";

const functionsSource = readFileSync("src/lib/orb-dev.functions.ts", "utf8");
const repoSource = readFileSync("src/orb-dev/repo.server.ts", "utf8");
const migrationSource = readFileSync(
  "drizzle/migrations/0048_orb_dev_repair_persistence.sql",
  "utf8",
);

function proposal(overrides: Partial<FixProposal> = {}): FixProposal {
  return {
    fixId: "ORB-FIX-0001",
    createdAt: "2026-09-22T17:00:00.000Z",
    createdBy: "orb_diagnostic",
    rootCause: "Fragewort wird als Thema verwendet",
    rootCauseLevel: "ROOT_CAUSE_PROVEN",
    files: ["src/orb-core/memory.ts"],
    diff: "--- a\n+++ b\n",
    operations: [{ kind: "edit_file", path: "src/orb-core/memory.ts" }],
    testPlan: ["Altersfrage findet Erinnerung"],
    expectedEffects: ["Recall findet den Fall"],
    risks: ["Themenfilter zu streng"],
    rollbackPlan: ["Änderung zurücknehmen"],
    state: "WAITING_FOR_ADMIN_APPROVAL",
    ...overrides,
  };
}

function approvalFor(p: FixProposal): FixApproval {
  return {
    fixId: p.fixId,
    fingerprint: fixFingerprint(p),
    operations: p.operations,
    approvedBy: "00000000-0000-0000-0000-000000000001",
    approvedAt: "2026-09-22T17:05:00.000Z",
    source: "admin_ui",
  };
}

describe("Statusmodell Phase 2", () => {
  it("enthält die verlangten Zustände inklusive DRAFT und INVALIDATED", () => {
    for (const state of [
      "DRAFT",
      "ANALYZING",
      "DIAGNOSIS_READY",
      "FIX_PROPOSED",
      "WAITING_FOR_ADMIN_APPROVAL",
      "APPROVED",
      "INVALIDATED",
      "EXECUTING",
      "TESTING",
      "PASSED",
      "FAILED",
      "ROLLED_BACK",
      "COMPLETED",
    ]) {
      expect(FIX_STATES).toContain(state);
    }
  });

  it("erlaubt keine Abkürzung um die Freigabe herum", () => {
    expect(canTransition("FIX_PROPOSED", "APPROVED")).toBe(false);
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("WAITING_FOR_ADMIN_APPROVAL", "APPROVED")).toBe(true);
  });

  it("INVALIDATED ist ein Endzustand", () => {
    expect(ALLOWED_TRANSITIONS.INVALIDATED).toEqual([]);
  });
});

describe("Approval-Integrität", () => {
  it("Freigabe enthält den Fingerabdruck des genehmigten Inhalts", () => {
    const p = proposal();
    expect(approvalFor(p).fingerprint).toBe(fixFingerprint(p));
    expect(checkApproval(p, approvalFor(p)).valid).toBe(true);
  });

  it("Diff-Änderung entwertet die Freigabe", () => {
    const p = proposal();
    const approval = approvalFor(p);
    const changed = { ...p, diff: `${p.diff}+ etwas anderes\n` };
    expect(checkApproval(changed, approval).valid).toBe(false);
  });

  it("Änderung der Operationsmenge entwertet die Freigabe", () => {
    const p = proposal();
    const approval = approvalFor(p);
    const changed = {
      ...p,
      operations: [...p.operations, { kind: "run_migration" as const, name: "add_table" }],
    };
    expect(checkApproval(changed, approval).valid).toBe(false);
  });

  it("Datei- oder Testplanänderung entwertet die Freigabe", () => {
    const p = proposal();
    const approval = approvalFor(p);
    expect(
      checkApproval({ ...p, files: [...p.files, "src/orb-core/recall.ts"] }, approval).valid,
    ).toBe(false);
    expect(checkApproval({ ...p, testPlan: ["anders"] }, approval).valid).toBe(false);
  });

  it("eine neue Fix-Version braucht eine neue Freigabe", () => {
    const v1 = proposal();
    const approval = approvalFor(v1);
    const v2 = proposal({ fixId: formatFixId(2), diff: "--- a\n+++ b\n+neu\n" });
    expect(checkApproval(v2, approval).valid).toBe(false);
    expect(checkApproval(v2, approvalFor(v2)).valid).toBe(true);
  });

  it("nicht gedeckte Operationen werden abgewiesen", () => {
    const p = proposal();
    const approval = approvalFor(p);
    expect(checkApproval(p, approval, { kind: "run_migration", name: "x" }).valid).toBe(false);
    expect(
      checkApproval(p, approval, { kind: "edit_file", path: "src/routes/admin.tsx" }).valid,
    ).toBe(false);
  });

  it("fehlende Freigabe bedeutet niemals freigegeben", () => {
    expect(checkApproval(proposal(), null).valid).toBe(false);
  });
});

describe("Memory und LLM erzeugen keine Rechte", () => {
  it("Memory erzeugt keine Berechtigung", () => {
    expect(memoryGrantsAuthority()).toBe(false);
  });

  it("nur admin_ui darf Freigabequelle sein", () => {
    for (const source of ["llm", "memory", "graph", "system_prompt", "autonomous"]) {
      expect(isApprovalSourceAllowed(source)).toBe(false);
      expect(checkApproval(proposal(), { ...approvalFor(proposal()), source } as never).valid).toBe(
        false,
      );
    }
    expect(isApprovalSourceAllowed("admin_ui")).toBe(true);
  });

  it("die Quelle wird serverseitig fest gesetzt, nie aus Eingaben gelesen", () => {
    expect(functionsSource).toContain('source: "admin_ui"');
    expect(repoSource).toContain('source: "admin_ui"');
    expect(migrationSource).toContain("CHECK (source = 'admin_ui')");
  });

  it("Memory kann keine Ausführung erzeugen", () => {
    expect(PHASE2_EXECUTION_ENABLED).toBe(false);
    expect(checkExecutionAllowed().allowed).toBe(false);
  });
});

describe("Audit-Log", () => {
  it("jede Zustandsänderung erzeugt einen Eintrag", () => {
    for (const action of [
      "CREATE_FIX_PROPOSAL",
      "APPROVE_FIX",
      "APPROVE_FIX_REJECTED",
      "REVISE_FIX_INVALIDATES_APPROVAL",
      "REQUEST_EXECUTION_DENIED",
    ]) {
      expect(`${functionsSource}${repoSource}`).toContain(action);
    }
  });

  it("Secrets werden vor dem Speichern entfernt", () => {
    expect(redactAuditText("key sb_secret_abc123XYZ end")).not.toContain("sb_secret_abc123XYZ");
    expect(redactAuditText("sk-abcdefghijklmnopqrstuvwxyz")).toContain("[REDACTED]");
    expect(redactAuditText("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")).toContain("[REDACTED]");
    expect(redactAuditText("SERVICE_ROLE_KEY")).toBe("[REDACTED]");
    expect(redactAuditText("API_KEY=supersecretvalue")).toContain("[REDACTED]");
    expect(redactAuditText("Fix ORB-FIX-0001 freigegeben")).toBe("Fix ORB-FIX-0001 freigegeben");
  });

  it("Audit-Einträge werden nur angehängt, nicht geändert", () => {
    expect(migrationSource).toContain("GRANT SELECT, INSERT ON public.orb_dev_audit_log");
    expect(migrationSource).not.toMatch(/GRANT[^;]*UPDATE[^;]*orb_dev_audit_log/);
  });
});

describe("Serverseitige Autorisierung", () => {
  const handlers = functionsSource.split("createServerFn(").slice(1);

  it("jede Server-Funktion erzwingt Anmeldung und Administratorrolle", () => {
    expect(handlers.length).toBeGreaterThanOrEqual(8);
    for (const handler of handlers) {
      expect(handler).toContain("requireSupabaseAuth");
      expect(handler).toContain("assertAdmin(context)");
    }
  });

  it("es wird keine parallele Rollenlogik eingeführt", () => {
    expect(functionsSource).toContain('import("@/lib/admin.server")');
    expect(functionsSource).not.toContain("supabaseAdmin");
  });

  it("manipulierte Fix-IDs werden formal abgewiesen", () => {
    expect(functionsSource).toContain("/^ORB-FIX-\\d{4}$/");
  });

  it("alle Datenbankzugriffe laufen über den Client des Aufrufers", () => {
    expect(functionsSource).toContain("context.supabase");
    expect(repoSource).not.toContain("client.server");
  });
});

describe("Migration", () => {
  it("aktiviert Zeilenschutz für alle drei Tabellen", () => {
    for (const table of ["orb_dev_fix_proposals", "orb_dev_fix_approvals", "orb_dev_audit_log"]) {
      expect(migrationSource).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });

  it("gibt keiner anonymen Rolle Rechte", () => {
    expect(migrationSource).not.toContain("TO anon");
  });

  it("bindet jede Regel an die Administratorrolle", () => {
    const policies = migrationSource.split("CREATE POLICY").slice(1);
    expect(policies.length).toBeGreaterThanOrEqual(7);
    for (const policy of policies) {
      expect(policy).toContain("public.has_role(auth.uid(), 'admin')");
    }
  });

  it("schützt Fix-Inhalte und Freigaben per Trigger", () => {
    expect(migrationSource).toContain("orb_dev_fix_proposals_immutable");
    expect(migrationSource).toContain("orb_dev_fix_approvals_immutable");
  });

  it("löscht oder verändert keine bestehenden Strukturen", () => {
    expect(migrationSource).not.toMatch(/DROP\s+(TABLE|COLUMN|SCHEMA)/i);
    expect(migrationSource).not.toMatch(/DELETE\s+FROM/i);
  });
});
