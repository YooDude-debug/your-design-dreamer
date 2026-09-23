/**
 * ORB → Toolbox Verdrahtung – Tests des ersten, READ-ONLY Integrationsstandes.
 *
 * Diese Tests erzeugen KEINEN Modellaufruf und berühren keine Produktionsdaten:
 * die Datenbank ist die bestehende protokollierende Attrappe.
 *
 * Geprüft wird:
 *  · ORB Core läuft ohne Toolbox (kein Import im normalen Pfad),
 *  · Toolbox erreichbar → Analyse mit Befund und Empfehlung,
 *  · Toolbox nicht erreichbar / Fehler / Zeitüberschreitung → ORB blockiert nicht,
 *  · eine Empfehlung verändert nichts,
 *  · die harten Grenzen (kein Code, keine Daten, keine Freigabe, kein Deployment).
 */

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ORB_OWNED_CAPABILITIES,
  TOOLBOX_APPROVAL_ENABLED,
  TOOLBOX_CODE_WRITE_ENABLED,
  TOOLBOX_CONFIG_WRITE_ENABLED,
  TOOLBOX_DB_WRITE_ENABLED,
  TOOLBOX_DEPLOYMENT_ENABLED,
  TOOLBOX_MIGRATION_ENABLED,
  TOOLBOX_READ_ONLY,
  TOOLBOX_SECRET_ACCESS_ENABLED,
  analysisGrantsAuthority,
  checkToolboxOperationAllowed,
  formatAnalysisId,
  isAnalysisId,
  isSupportedAnalysisType,
  toolboxCapabilities,
} from "@/orb-core/toolbox/contract";
import { runToolboxAnalysis } from "@/orb-core/toolbox/adapter.server";
import { createFakeDb } from "./helpers/fake-supabase";

type Db = Parameters<typeof runToolboxAnalysis>[0];

const asDb = (db: unknown) => db as Db;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

/* ------------------------------------------------------------ harte Grenzen */

describe("Toolbox – harte Grenzen", () => {
  it("A – der erste Stand ist read-only; jede Schreibfähigkeit ist abgeschaltet", () => {
    expect(TOOLBOX_READ_ONLY).toBe(true);
    expect(TOOLBOX_CODE_WRITE_ENABLED).toBe(false);
    expect(TOOLBOX_DB_WRITE_ENABLED).toBe(false);
    expect(TOOLBOX_MIGRATION_ENABLED).toBe(false);
    expect(TOOLBOX_DEPLOYMENT_ENABLED).toBe(false);
    expect(TOOLBOX_APPROVAL_ENABLED).toBe(false);
    expect(TOOLBOX_CONFIG_WRITE_ENABLED).toBe(false);
    expect(TOOLBOX_SECRET_ACCESS_ENABLED).toBe(false);
  });

  it("B – jede schreibende Operation wird mit Begründung abgelehnt", () => {
    for (const op of toolboxCapabilities().forbidden) {
      const decision = checkToolboxOperationAllowed(op);
      expect(decision.allowed).toBe(false);
      expect(decision.reason.length).toBeGreaterThan(10);
    }
  });

  it("C – eine Analyse begründet niemals eine Berechtigung", () => {
    expect(analysisGrantsAuthority()).toBe(false);
  });

  it("D – ORB-eigene Fähigkeiten bleiben ausdrücklich bei ORB Core", () => {
    for (const capability of [
      "memory",
      "graph",
      "curiosity",
      "energy",
      "autonomous_questions",
    ] as const) {
      expect(ORB_OWNED_CAPABILITIES).toContain(capability);
    }
  });
});

/* -------------------------------------------------- keine Duplikation / Pfad */

describe("Toolbox – keine Duplikation, kein Eingriff in den normalen Pfad", () => {
  const adapter = readFileSync("src/orb-core/toolbox/adapter.server.ts", "utf8");
  const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");

  it("E – ORB Core ruft die Toolbox nicht auf (normaler Pfad unverändert)", () => {
    expect(engine).not.toMatch(/toolbox/i);
  });

  it("F – der Adapter bildet keine ORB-Logik nach", () => {
    expect(adapter).not.toMatch(/from "@\/orb-core\/(memory|curiosity|impulse|autonomy)"/);
    expect(adapter).not.toMatch(/from "@\/orb-core\/engine\.server"/);
  });

  it("G – der Adapter verwendet die vorhandene Diagnose- und Ablage-Schnittstelle", () => {
    expect(adapter).toContain('@/orb-dev/diagnose.server');
    expect(adapter).toContain('@/orb-dev/repo.server');
  });

  it("H – der Adapter schreibt nichts und ruft kein Modell auf", () => {
    expect(adapter).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
    expect(adapter).not.toMatch(/insertProposal|approveFix|queueDeployment|runSandbox/);
    expect(adapter).not.toMatch(/openai|chat\/completions|LOVABLE_API_KEY/i);
  });
});

/* ----------------------------------------------------------- Analyse-Identität */

describe("Toolbox – technische Identität", () => {
  it("I – Analyse-Kennungen sind technisch und formatgeprüft", () => {
    const id = formatAnalysisId("a1b2c3d4");
    expect(isAnalysisId(id)).toBe(true);
    expect(id).toMatch(/^ORB-TBX-[0-9A-Z]{8}$/);
  });

  it("J – nur vorhandene Analysearten sind ausführbar", () => {
    expect(isSupportedAnalysisType("memory_recall")).toBe(true);
    expect(isSupportedAnalysisType("repair_pipeline_state")).toBe(true);
    expect(isSupportedAnalysisType("system_logs")).toBe(false);
    expect(isSupportedAnalysisType("request_structure")).toBe(false);
  });
});

/* ------------------------------------------------------------------ Analyse */

describe("Toolbox – Analyse erreichbar", () => {
  it("K – Analyse liefert Befund, Empfehlung und verändert nichts", async () => {
    const db = createFakeDb(() => ({ data: [] }));
    const result = await runToolboxAnalysis(asDb(db), {
      analysisType: "memory_recall",
      source: "admin_ui",
      eventId: null,
      requestId: null,
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
    for (const recommendation of result.recommendations) {
      expect(recommendation.requiresHumanApproval).toBe(true);
      expect(recommendation.applied).toBe(false);
    }
    expect(result.readOnly).toBe(true);
    expect(result.codeChanged).toBe(false);
    expect(result.dbChanged).toBe(false);
    expect(result.proposalCreated).toBe(false);
    expect(result.approvalCreated).toBe(false);
    expect(result.deployed).toBe(false);
    expect(result.modelCalls).toBe(0);
  });

  it("L – Zustandsanalyse liest die Reparaturstrecke nur lesend", async () => {
    const db = createFakeDb(() => ({ data: [] }));
    const result = await runToolboxAnalysis(asDb(db), {
      analysisType: "repair_pipeline_state",
      source: "admin_ui",
      eventId: null,
      requestId: null,
    });

    expect(result.status).toBe("COMPLETED");
    expect(db.calls.every((call) => call.action === "select")).toBe(true);
  });

  it("M – technische Kennungen werden übernommen, freier Text nicht", async () => {
    const db = createFakeDb(() => ({ data: [] }));
    const result = await runToolboxAnalysis(asDb(db), {
      analysisType: "repair_pipeline_state",
      source: "admin_chat",
      eventId: "evt_5f3a91cc-0000-4000-8000-000000000001",
      requestId: "Wie alt bin ich?",
    });

    expect(result.eventId).toBe("evt_5f3a91cc-0000-4000-8000-000000000001");
    expect(result.requestId).toBeNull();
  });

  it("N – nicht unterstützte Analyseart wird dokumentiert, nicht erfunden", async () => {
    const db = createFakeDb(() => ({ data: [] }));
    const result = await runToolboxAnalysis(asDb(db), {
      analysisType: "system_logs",
      source: "admin_ui",
      eventId: null,
      requestId: null,
    });

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.recommendations).toHaveLength(0);
    expect(result.findings[0]?.code).toBe("ANALYSIS_NOT_SUPPORTED");
  });
});

/* ------------------------------------------------------------ Fehlerisolation */

describe("Toolbox – Fehlerisolation", () => {
  it("O – Fehler der Analyse werfen nicht, sondern melden einen technischen Grund", async () => {
    const db = createFakeDb(() => ({ error: { message: "relation not available" } }));
    const result = await runToolboxAnalysis(asDb(db), {
      analysisType: "repair_pipeline_state",
      source: "admin_ui",
      eventId: null,
      requestId: null,
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("analysis_error");
    expect(result.findings).toHaveLength(0);
    expect(result.recommendations).toHaveLength(0);
  });

  it("P – nicht erreichbare Analyse wird als „unavailable“ gemeldet", async () => {
    const db = createFakeDb(() => {
      throw new Error("fetch failed: unreachable");
    });
    const result = await runToolboxAnalysis(asDb(db), {
      analysisType: "repair_pipeline_state",
      source: "admin_ui",
      eventId: null,
      requestId: null,
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("unavailable");
  });

  it("Q – eine hängende Analyse läuft in die Zeitgrenze statt zu blockieren", async () => {
    // Attrappe: die Diagnose antwortet nie. Der Adapter darf nicht blockieren.
    vi.doMock("@/orb-dev/diagnose.server", () => ({
      diagnoseMemoryRecallCase: () => new Promise(() => {}),
      proposalFromDiagnosis: () => ({ error: "nicht verwendet" }),
    }));
    const { runToolboxAnalysis: run } = await import("@/orb-core/toolbox/adapter.server");
    const db = createFakeDb(() => ({ data: [] }));
    const result = await run(asDb(db), {
      analysisType: "memory_recall",
      source: "admin_ui",
      eventId: null,
      requestId: null,
      timeoutMs: 30,
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("timeout");
    vi.doUnmock("@/orb-dev/diagnose.server");
  });


  it("R – ein Fehlergrund enthält keinen Inhalt und keinen Schlüssel", async () => {
    const db = createFakeDb(() => {
      throw new Error("sk-livekey1234567890abcdef Nachrichtentext des Nutzers");
    });
    const result = await runToolboxAnalysis(asDb(db), {
      analysisType: "repair_pipeline_state",
      source: "admin_ui",
      eventId: null,
      requestId: null,
    });

    expect(result.failureKind).toBe("analysis_error");
    expect(JSON.stringify(result)).not.toMatch(/sk-livekey|Nachrichtentext/);
  });
});
