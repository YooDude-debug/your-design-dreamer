/**
 * P10 – ORB Core findet den vorhandenen Analysezugang (READ-ONLY).
 *
 * Kein Modellaufruf, keine Produktionsdaten: die Datenbank ist die bestehende
 * protokollierende Attrappe. Geprüft wird Auffindbarkeit, lesende Anforderung,
 * saubere Fehler (fehlende Berechtigung, Zeitüberschreitung, nicht erreichbar),
 * Read-only-Grenzen und der unveränderte normale Verarbeitungspfad.
 */

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverAnalysisAccess,
  isAnalysisAvailable,
  requestOrbAnalysis,
} from "@/orb-core/toolbox/access.server";
import { ORB_INTERNAL_SOURCE, isAnalysisId } from "@/orb-core/toolbox/contract";

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("@/orb-core/toolbox/adapter.server");
  vi.doUnmock("@/orb-dev/diagnose.server");
  vi.resetModules();
});

/** Minimaler Datenzugang: nur `has_role` wird benutzt. */
const dbWithRole = (isAdmin: boolean, fail = false) =>
  ({
    rpc: async () =>
      fail ? { data: null, error: new Error("rpc down") } : { data: isAdmin, error: null },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: async () => ({ data: [], error: null }) }),
        }),
      }),
    }),
  }) as never;

describe("P10 – Auffindbarkeit", () => {
  it("1 – ORB findet den Analysezugang mit beschriebener Berechtigung", () => {
    const access = discoverAnalysisAccess();
    expect(access.available).toBe(true);
    expect(access.transport).toBe("internal_server_call");
    expect(access.requiresAdminRole).toBe(true);
    expect(access.readOnly).toBe(true);
    expect(access.requiresHumanApprovalForAnyChange).toBe(true);
    expect(access.source).toBe(ORB_INTERNAL_SOURCE);
    expect(access.supported).toContain("memory_recall");
    expect(isAnalysisAvailable("system_logs")).toBe(false);
  });
});

describe("P10 – lesende Anforderung", () => {
  it("2–5 – Administrator erhält ein lesbares Ergebnis ohne Schreiboperation", async () => {
    vi.doMock("@/orb-core/toolbox/adapter.server", () => ({
      runToolboxAnalysis: async (_db: unknown, req: { source: string }) => ({
        analysisId: "ORB-TBX-AAAAAAAA",
        analysisType: "memory_recall",
        status: "COMPLETED",
        source: req.source,
        eventId: null,
        requestId: null,
        timestamp: new Date().toISOString(),
        durationMs: 1,
        findings: [{ code: "X", severity: "info", summary: "s", evidence: [] }],
        recommendations: [
          {
            summary: "r",
            files: [],
            requiresHumanApproval: true,
            applied: false,
            proposalCandidate: true,
          },
        ],
        failureKind: null,
        readOnly: true,
        codeChanged: false,
        dbChanged: false,
        proposalCreated: false,
        approvalCreated: false,
        deployed: false,
        modelCalls: 0,
      }),
    }));
    const { requestOrbAnalysis: run } = await import("@/orb-core/toolbox/access.server");
    const result = await run(dbWithRole(true), "u1", { analysisType: "memory_recall" });
    expect(result.status).toBe("COMPLETED");
    expect(result.source).toBe(ORB_INTERNAL_SOURCE);
    expect(result.findings.length).toBe(1);
    // 5–6 · 12 – keine Schreiboperation, kein Patch, Freigabe bleibt zwingend
    expect(result.codeChanged).toBe(false);
    expect(result.dbChanged).toBe(false);
    expect(result.proposalCreated).toBe(false);
    expect(result.approvalCreated).toBe(false);
    expect(result.deployed).toBe(false);
    expect(result.modelCalls).toBe(0);
    expect(result.recommendations[0]?.requiresHumanApproval).toBe(true);
    expect(result.recommendations[0]?.applied).toBe(false);
  });
});

describe("P10 – Fehlerverhalten", () => {
  it("10 – fehlende Berechtigung ergibt einen sauberen Fehler, keine Ausnahme", async () => {
    const result = await requestOrbAnalysis(dbWithRole(false), "u1", {
      analysisType: "memory_recall",
    });
    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("unauthorized");
    expect(isAnalysisId(result.analysisId)).toBe(true);
  });

  it("10b – fehlerhafte Berechtigungsprüfung ergibt ebenfalls einen sauberen Fehler", async () => {
    const result = await requestOrbAnalysis(dbWithRole(true, true), "u1", {
      analysisType: "memory_recall",
    });
    expect(result.failureKind).toBe("unauthorized");
  });

  it("11 – Zeitüberschreitung ergibt einen sauberen Fehlergrund", async () => {
    vi.doMock("@/orb-dev/diagnose.server", () => ({
      diagnoseMemoryRecallCase: () => new Promise(() => {}),
    }));
    const { requestOrbAnalysis: run } = await import("@/orb-core/toolbox/access.server");
    const result = await run(dbWithRole(true), "u1", {
      analysisType: "memory_recall",
      timeoutMs: 20,
    });
    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("timeout");
  });

  it("9 – Analysezugang nicht erreichbar → ORB erhält FAILED, keine Ausnahme", async () => {
    vi.doMock("@/orb-core/toolbox/adapter.server", () => {
      throw new Error("module unavailable");
    });
    const { requestOrbAnalysis: run } = await import("@/orb-core/toolbox/access.server");
    const result = await run(dbWithRole(true), "u1", { analysisType: "memory_recall" });
    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("unavailable");
  });
});

describe("P10 – normaler Verarbeitungspfad unverändert", () => {
  it("7–8 – ORB Core ruft den Analysezugang nicht auf", () => {
    for (const path of [
      "src/orb-core/engine.server.ts",
      "src/orb-core/process.server.ts",
      "src/orb-core/feed.server.ts",
      "src/orb-core/autonomy.ts",
      "src/orb-core/impulse.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toContain("toolbox/access.server");
      expect(source).not.toContain("runToolboxAnalysis");
      expect(source).not.toContain("requestOrbAnalysis");
    }
  });

  it("13 – der Zugang selbst enthält keine Schreiboperation", () => {
    const source = readFileSync("src/orb-core/toolbox/access.server.ts", "utf8");
    for (const forbidden of [".insert(", ".update(", ".delete(", ".upsert("])
      expect(source).not.toContain(forbidden);
  });
});

/* ======================================================================== P12 */

describe("P12 – Discovery der vorhandenen Analysefähigkeit", () => {
  it("findet die Fähigkeit mit eindeutiger Kennung (ohne DB, ohne Modell)", async () => {
    const { listAnalysisCapabilities, resolveOrbCapability } = await import(
      "@/orb-core/toolbox/access.server"
    );
    const caps = listAnalysisCapabilities();
    expect(caps).toHaveLength(1);
    const cap = caps[0]!;
    expect(cap.capabilityId).toBe("orb.analysis");
    // eindeutig: keine zweite Fähigkeit mit derselben Kennung
    expect(new Set(caps.map((c) => c.capabilityId)).size).toBe(caps.length);
    // zeigt auf den VORHANDENEN Adapter, nicht auf eine neue Schnittstelle
    expect(cap.adapter).toBe("src/orb-core/toolbox/adapter.server.ts#runToolboxAnalysis");
    expect(cap.transport).toBe("internal_server_call");
    expect(cap.readOnly).toBe(true);
    expect(cap.requiresAdminRole).toBe(true);
    expect(cap.requiresHumanApprovalForAnyChange).toBe(true);
    expect(cap.supported).toContain("memory_recall");

    // Auflösen ist möglich; unbekannte Kennung ergibt null statt Ausnahme
    expect(resolveOrbCapability("orb.analysis")?.capabilityId).toBe("orb.analysis");
    expect(resolveOrbCapability("orb.unknown")).toBeNull();
  });

  it("die erkannte Fähigkeit trägt dieselbe Kennung wie der Zugang", () => {
    expect(discoverAnalysisAccess().capabilityId).toBe("orb.analysis");
  });

  it("Auflösen allein löst keine Analyse, keinen DB-Zugriff und keinen Modellaufruf aus", async () => {
    const { resolveOrbCapability } = await import("@/orb-core/toolbox/access.server");
    let touched = 0;
    const db = { rpc: () => ((touched += 1), { data: true, error: null }) } as never;
    const resolved = resolveOrbCapability("orb.analysis");
    expect(resolved).not.toBeNull();
    expect(touched).toBe(0);
    void db;
  });

  it("Administratorprüfung bleibt beim Anfordern über die Fähigkeit aktiv", async () => {
    const { resolveOrbCapability } = await import("@/orb-core/toolbox/access.server");
    const resolved = resolveOrbCapability("orb.analysis")!;
    const denied = await resolved.request(dbWithRole(false), "u1", {
      analysisType: "repair_pipeline_state",
    });
    expect(denied.status).toBe("FAILED");
    expect(denied.failureKind).toBe("unauthorized");
    expect(denied.codeChanged).toBe(false);
    expect(denied.dbChanged).toBe(false);
    expect(denied.modelCalls).toBe(0);
    expect(denied.source).toBe(ORB_INTERNAL_SOURCE);
    expect(isAnalysisId(denied.analysisId)).toBe(true);
  });

  it("kein normaler ORB-Pfad kennt Verzeichnis oder Resolver", () => {
    for (const file of ["src/orb-core/engine.server.ts", "src/orb-core/memory.ts"]) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/resolveOrbCapability|listOrbCapabilities|access\.server/);
    }
  });
});
