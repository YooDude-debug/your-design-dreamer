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

  it("9 – Analysezugang nicht erreichbar → ORB erhält FAILED, keine Ausnahme", async () => {
    vi.doMock("@/orb-core/toolbox/adapter.server", () => {
      throw new Error("module unavailable");
    });
    const { requestOrbAnalysis: run } = await import("@/orb-core/toolbox/access.server");
    const result = await run(dbWithRole(true), "u1", { analysisType: "memory_recall" });
    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("unavailable");
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
