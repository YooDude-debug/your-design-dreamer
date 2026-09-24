import { createHash } from "crypto";
import { readFileSync } from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYSIS_MODEL,
  RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  analyzeContextWindow,
} from "@/orb-core/analysis/analyze.server";
import { ANALYSIS_PROVIDER, analysisRunColumns } from "@/orb-core/observability.server";

const KEY = "lovable-test-key";
const TRANSCRIPT = "Benutzer: Ich arbeite als Koch.";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const cand = {
  key: "beruf",
  value: "Arbeitet als Koch.",
  category: "identity",
  relevance: 0.8,
  long_term_value: 0.8,
  confidence: 0.9,
  temporal_scope: "persistent",
  decay_rate: 0,
  source_reference: "U1",
  action: "create_or_update",
};

function sse(events: unknown[], raw = "") {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + raw;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

type Call = { url: string; init: RequestInit };
function stub(res: () => Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return res();
    }),
  );
  return calls;
}
const run = () =>
  analyzeContextWindow({ transcript: TRANSCRIPT, knownMemories: [], allowedNodeIds: [] });

describe("D – Hintergrundanalyse über das Gateway", () => {
  beforeEach(() => {
    process.env["LOVABLE_API_KEY"] = KEY;
    process.env["OPENAI_API_KEY"] = "sk-must-not-be-used";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["LOVABLE_API_KEY"];
    delete process.env["OPENAI_API_KEY"];
  });

  it("A/B: Anfrage an /v1/responses mit Astra, reasoning low, store false, stream true, strict json_schema", async () => {
    const calls = stub(async () => sse([{ type: "response.completed", response: {} }]));
    await run();
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toBe("https://ai.gateway.lovable.dev/v1/responses");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Lovable-API-Key"]).toBe(KEY);
    expect(headers["X-Lovable-AIG-SDK"]).toBe("fetch");
    expect(JSON.stringify(headers)).not.toContain("sk-must-not-be-used");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("openai/gpt-6-astra");
    expect(body.reasoning).toEqual({ effort: "low", summary: "auto" });
    expect(body.store).toBe(false);
    expect(body.stream).toBe(true);
    expect(body.instructions).toBe(SYSTEM_PROMPT);
    expect(body.input[0].content[0].type).toBe("input_text");
    expect(body.input[0].content[0].text).toContain(TRANSCRIPT);
    expect(body.text.format).toEqual({
      type: "json_schema",
      name: "orb_memory_candidates",
      strict: true,
      schema: RESPONSE_SCHEMA,
    });
    const raw = String(init.body);
    expect(raw).not.toContain("gpt-4o-mini");
    expect(raw).not.toMatch(/max_tokens|max_output_tokens|maxOutputTokens/);
    expect(url).not.toContain("api.openai.com");
    expect(init.signal).toBeUndefined(); // kein künstlicher Zeitgeber
  });

  it("C: mehrere Deltas werden zusammengesetzt", async () => {
    const json = JSON.stringify({ candidates: [cand] });
    stub(async () =>
      sse([
        { type: "response.created" },
        { type: "response.output_text.delta", delta: json.slice(0, 20) },
        { type: "response.output_text.delta", delta: json.slice(20, 50) },
        { type: "response.output_text.delta", delta: json.slice(50) },
        { type: "response.completed", response: { usage: { input_tokens: 7, output_tokens: 3 } } },
      ]),
    );
    const r = await run();
    expect(r).toMatchObject({ failure: null, httpStatus: 200, preSanitizeCount: 1 });
    expect(r.candidates).toHaveLength(1);
    expect(r.usage).toEqual({ promptTokens: 7, completionTokens: 3 });
  });

  it("C: response.completed.output_text allein genügt", async () => {
    stub(async () =>
      sse([
        {
          type: "response.completed",
          response: { output_text: JSON.stringify({ candidates: [cand] }) },
        },
      ]),
    );
    const r = await run();
    expect(r.candidates).toHaveLength(1);
  });

  it("D: HTTP 400/402/403/429/500 → http + Status, 0/0", async () => {
    for (const status of [400, 402, 403, 429, 500]) {
      stub(async () => new Response("x", { status }));
      const r = await run();
      expect(r).toMatchObject({ failure: "http", httpStatus: status, preSanitizeCount: 0 });
      expect(r.candidates).toEqual([]);
    }
  });

  it("D: leerer Stream und ungültiges JSON → malformed mit Status 200", async () => {
    stub(async () => sse([{ type: "response.completed", response: {} }]));
    expect(await run()).toMatchObject({ failure: "malformed", httpStatus: 200 });
    stub(async () => sse([{ type: "response.output_text.delta", delta: "{kein json" }]));
    expect(await run()).toMatchObject({ failure: "malformed", httpStatus: 200 });
    stub(async () => new Response(null, { status: 200 }));
    expect(await run()).toMatchObject({ failure: "malformed", httpStatus: 200 });
  });

  it("D: Netzwerkausnahme → http, Status null", async () => {
    stub(async () => {
      throw new Error("net");
    });
    expect(await run()).toMatchObject({ failure: "http", httpStatus: null });
  });

  it("ohne LOVABLE_API_KEY → no_key, kein Aufruf (auch mit OPENAI_API_KEY)", async () => {
    delete process.env["LOVABLE_API_KEY"];
    const calls = stub(async () => new Response("x", { status: 500 }));
    expect((await run()).failure).toBe("no_key");
    expect(calls).toHaveLength(0);
  });

  it("F/G: genau ein Aufruf, kein Ersatzweg und keine Wiederholung bei Fehler", async () => {
    const calls = stub(async () => new Response("x", { status: 429 }));
    await run();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toContain("api.openai.com");
  });

  it("E: D1/D2 melden provider = lovable_gateway", () => {
    expect(ANALYSIS_PROVIDER).toBe("lovable_gateway");
    const cols = analysisRunColumns({
      analysisRunId: "00000000-0000-4000-8000-000000000000",
      httpStatus: 200,
      failureKind: null,
      preSanitizeCount: 2,
      postSanitizeCount: 1,
      durationMs: 42,
    });
    expect(cols).toEqual({
      analysis_run_id: "00000000-0000-4000-8000-000000000000",
      provider: "lovable_gateway",
      http_status: 200,
      failure_kind: null,
      pre_sanitize_count: 2,
      post_sanitize_count: 1,
      duration_ms: 42,
    });
  });

  it("H/I: Schema und Prompt sind unverändert (Fingerabdruck der Vorversion)", () => {
    expect(sha(JSON.stringify(RESPONSE_SCHEMA))).toBe(
      "f17bbf3773228ac61d64c6c67e8f74508c2919feb4b0b4b119efcf00390a45f5",
    );
    expect(sha(SYSTEM_PROMPT)).toBe(
      "c5a81c66af6a18942ccafbda7988842fadc943ba100262cc15fb9d864e0b5c0f",
    );
    expect(ANALYSIS_MODEL).toBe("openai/gpt-6-astra");
  });

  it("Quelltext: kein OPENAI_API_KEY, kein Direktendpunkt, kein max_tokens, kein Zeitgeber", () => {
    const src = readFileSync("src/orb-core/analysis/analyze.server.ts", "utf8");
    expect(src).not.toContain("OPENAI_API_KEY");
    expect(src).not.toContain("api.openai.com");
    expect(src).not.toMatch(/max_tokens|AbortSignal\.timeout/);
  });
});
