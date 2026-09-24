import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeContextWindow, countRawCandidates } from "@/orb-core/analysis/analyze.server";
import { logAnalysisRun } from "@/orb-core/observability.server";

const SECRET = "sk-test-SECRET-KEY-123";
const TRANSCRIPT = "Benutzer: GEHEIMER_USERTEXT ich arbeite als Koch";
const MEMORY = "GEHEIME_MEMORY Lieblingsessen Pizza";

const cand = (key: string, value: string) => ({
  key,
  value,
  category: "identity",
  relevance: 0.8,
  long_term_value: 0.8,
  confidence: 0.9,
  temporal_scope: "persistent",
  decay_rate: 0,
  source_reference: "U1",
  action: "create_or_update",
});

function okResponse(content: string | null) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const run = () =>
  analyzeContextWindow({ transcript: TRANSCRIPT, knownMemories: [MEMORY], allowedNodeIds: [] });

describe("D1 – Hintergrundanalyse Messwerte", () => {
  beforeEach(() => {
    process.env["OPENAI_API_KEY"] = SECRET;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["OPENAI_API_KEY"];
  });

  it("A: HTTP-Fehler → http, Status erfasst, 0/0", async () => {
    for (const status of [429, 401, 403, 400, 500]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("err", { status })),
      );
      const r = await run();
      expect(r).toMatchObject({
        failure: "http",
        httpStatus: status,
        preSanitizeCount: 0,
        candidates: [],
      });
    }
  });

  it("B: Timeout → timeout, httpStatus null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw Object.assign(new Error("t"), { name: "TimeoutError" });
      }),
    );
    expect(await run()).toMatchObject({
      failure: "timeout",
      httpStatus: null,
      preSanitizeCount: 0,
    });
  });

  it("B2: Netzwerkfehler ohne Antwort → http, httpStatus null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net");
      }),
    );
    expect(await run()).toMatchObject({ failure: "http", httpStatus: null });
  });

  it("C: leerer bzw. ungültiger Inhalt → malformed, Status 200", async () => {
    for (const c of [null, "", "{nicht json"]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => okResponse(c)),
      );
      expect(await run()).toMatchObject({
        failure: "malformed",
        httpStatus: 200,
        preSanitizeCount: 0,
      });
    }
  });

  it("D: candidates [] → failure null, 0/0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse(JSON.stringify({ candidates: [] }))),
    );
    const r = await run();
    expect(r).toMatchObject({ failure: null, httpStatus: 200, preSanitizeCount: 0 });
    expect(r.candidates).toHaveLength(0);
  });

  it("E: 1 gültiger Kandidat → 1/1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        okResponse(JSON.stringify({ candidates: [cand("beruf", "Arbeitet als Koch.")] })),
      ),
    );
    const r = await run();
    expect(r.preSanitizeCount).toBe(1);
    expect(r.candidates).toHaveLength(1);
  });

  it("F: Kandidat vor dem Bereinigen, danach 0 → 1/0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse(JSON.stringify({ candidates: [cand("x", "y")] }))),
    );
    const r = await run();
    expect(r).toMatchObject({ failure: null, preSanitizeCount: 1 });
    expect(r.candidates).toHaveLength(0);
  });

  it("G: mehrere Kandidaten → 3/2 (Duplikat verworfen)", async () => {
    const body = {
      candidates: [cand("beruf", "Koch."), cand("beruf", "Doppelt."), cand("stadt", "Berlin.")],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse(JSON.stringify(body))),
    );
    const r = await run();
    expect(r.preSanitizeCount).toBe(3);
    expect(r.candidates).toHaveLength(2);
  });

  it("countRawCandidates: kein Array → 0", () => {
    expect(countRawCandidates({})).toBe(0);
    expect(countRawCandidates(null)).toBe(0);
    expect(countRawCandidates({ candidates: "x" })).toBe(0);
    expect(countRawCandidates({ candidates: [1, 2] })).toBe(2);
  });

  it("Genau ein Modellaufruf pro Lauf", async () => {
    const f = vi.fn(async () => okResponse(JSON.stringify({ candidates: [] })));
    vi.stubGlobal("fetch", f);
    await run();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("Security: Protokollzeile enthält nur technische Felder", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logAnalysisRun({
      analysisRunId: "00000000-0000-4000-8000-000000000000",
      httpStatus: 200,
      failureKind: null,
      preSanitizeCount: 1,
      postSanitizeCount: 1,
      durationMs: 222,
    });
    const line = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    spy.mockRestore();
    for (const forbidden of [
      SECRET,
      "GEHEIMER_USERTEXT",
      "GEHEIME_MEMORY",
      "Koch",
      "Bearer",
      "user_id",
      "content",
      "prompt",
    ]) {
      expect(line).not.toContain(forbidden);
    }
    const json = JSON.parse(line.replace("[orb.obs.analysis_run] ", ""));
    expect(Object.keys(json).sort()).toEqual(
      [
        "analysis_run_id",
        "duration_ms",
        "failure_kind",
        "http_status",
        "post_sanitize_count",
        "pre_sanitize_count",
        "provider",
      ].sort(),
    );
  });
});
