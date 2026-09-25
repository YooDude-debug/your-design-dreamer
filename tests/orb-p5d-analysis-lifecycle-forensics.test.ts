/* eslint-disable @typescript-eslint/no-explicit-any -- Fake-DB/Fetch im Diagnose-Test */
// P5-D: rein diagnostisch. Keine Produktivänderung, keine echte DB, kein echter Modellaufruf.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { SYSTEM_PROMPT, RESPONSE_SCHEMA } from "@/orb-core/analysis/analyze.server";
import { analyzeAndPersist } from "@/orb-core/analysis/apply.server";
import { sanitizeCandidates } from "@/orb-core/analysis/schema";

const U = "u1";
const N1 = "11111111-1111-4111-8111-111111111111";
const old = new Date(Date.now() - 86_400_000).toISOString();
type Op = { table: string; op: string; payload?: any; filters: Record<string, unknown> };

function fakeDb(nodes: any[], messages: any[]) {
  const ops: Op[] = [];
  const from = (table: string) => {
    const o: Op = { table, op: "select", filters: {} };
    const b: any = {
      select: () => b, order: () => b, limit: () => b, not: () => b,
      insert: (p: any) => { o.op = "insert"; o.payload = p; return b; },
      update: (p: any) => { o.op = "update"; o.payload = p; return b; },
      eq: (k: string, v: unknown) => { o.filters[k] = v; return b; },
      maybeSingle: () => b, single: () => b,
      then: (res: any) => {
        ops.push(o);
        if (o.op === "insert") return res({ data: { id: "new-node" }, error: null });
        if (o.op === "update") return res({ data: null, error: null });
        if (table === "orb_metrics") return res({ data: null, error: null });
        if (table === "orb_messages") return res({ data: messages, error: null });
        if (table === "orb_nodes") return res({ data: nodes, error: null });
        return res({ data: null, error: null });
      },
    };
    return b;
  };
  return { db: { from } as any, ops };
}
function sse(obj: unknown) {
  const text = JSON.stringify(obj);
  const body = `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}\n\ndata: ${JSON.stringify({ type: "response.completed", response: { output_text: text, usage: { input_tokens: 10, output_tokens: 5 } } })}\n\n`;
  return new Response(body, { status: 200 });
}
const cand = (over: Record<string, unknown>) => ({
  key: "gpu", value: "Der Benutzer nutzt eine RTX 5070 Grafikkarte.", category: "fact",
  relevance: 0.8, long_term_value: 0.8, confidence: 0.9, temporal_scope: "long_term",
  decay_rate: 0.01, source_reference: "turn", action: "create_or_update", ...over,
});
const node = { id: N1, content: "Der Benutzer nutzt eine RTX 5070 Grafikkarte.", norm_key: null, category: "fact",
  long_term_value: 0.5, temporal_scope: "persistent", lifecycle: "active", importance: 0.5, decay_rate: 0,
  activation_count: 2, created_at: old, last_accessed_at: new Date().toISOString() };

let fetchSpy: any;
beforeEach(() => { process.env["LOVABLE_API_KEY"] = "test"; vi.spyOn(console, "info").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

async function run(payload: unknown, nodes: any[] = [], userText = "Ich habe eine RTX 5070.") {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    payload instanceof Response ? payload : sse(payload));
  const { db, ops } = fakeDb(nodes, [{ role: "user", body: userText, created_at: old }]);
  const report = await analyzeAndPersist(db, U);
  const writes = ops.filter((o) => o.op !== "select");
  return { report, writes, calls: fetchSpy.mock.calls.length, ops };
}
const nodeWrites = (w: Op[]) => w.filter((o) => o.table === "orb_nodes");

describe("P5-D Background-Analysis Lifecycle (Mock)", () => {
  it("Prompt/Schema-Hashes und related_nodes nicht im Schema", () => {
    const h = (s: string) => createHash("sha256").update(s).digest("hex");
    console.log("SHA", h(SYSTEM_PROMPT), h(JSON.stringify(RESPONSE_SCHEMA)));
    const props = Object.keys(RESPONSE_SCHEMA.properties.candidates.items.properties);
    expect(props).not.toContain("related_nodes");
    expect(RESPONSE_SCHEMA.properties.candidates.items.additionalProperties).toBe(false);
    expect([...RESPONSE_SCHEMA.properties.candidates.items.properties.action.enum]).toEqual(["create_or_update", "reinforce", "forget"]);
  });
  it("A: create_or_update ohne Treffer → 1 Insert, genau 1 Model Call", async () => {
    const r = await run({ candidates: [cand({})] });
    expect(r.calls).toBe(1);
    expect(r.report.memoriesCreated).toBe(1);
    expect(nodeWrites(r.writes).map((o) => o.op)).toEqual(["insert"]);
  });
  it("B: create_or_update mit ähnlichem Knoten → Update inkl. content/norm_key", async () => {
    const r = await run({ candidates: [cand({ value: "Der Benutzer nutzt inzwischen eine RTX 5080 Grafikkarte." })] }, [node]);
    const upd = nodeWrites(r.writes).find((o) => o.op === "update" && "content" in o.payload);
    expect(upd).toBeTruthy();
    expect(Object.keys(upd!.payload)).toEqual(expect.arrayContaining(["content", "norm_key", "activation_count"]));
    expect(upd!.payload).not.toHaveProperty("importance");
  });
  it("C: action=reinforce ohne Treffer → trotzdem NEUE Memory (action wird ignoriert)", async () => {
    const r = await run({ candidates: [cand({ action: "reinforce" })] });
    expect(r.report.memoriesCreated).toBe(1);
  });
  it("C2: identischer Inhalt → duplicate → activation +1, content unverändert", async () => {
    const r = await run({ candidates: [cand({})] }, [node]);
    const upd = nodeWrites(r.writes).find((o) => o.op === "update");
    expect(upd!.payload).toMatchObject({ activation_count: 3, lifecycle: "active" });
    expect(upd!.payload).not.toHaveProperty("content");
  });
  it("D: action=forget ohne Vergessens-Satz des Users → wie create_or_update (Insert)", async () => {
    const r = await run({ candidates: [cand({ action: "forget" })] });
    expect(r.report.memoriesCreated).toBe(1);
    expect(r.report.memoriesDecayed).toBe(0);
  });
  it("E: Vergessens-Satz im Verlauf → Treffer wird geschwächt, unabhängig von action", async () => {
    const r = await run({ candidates: [cand({ action: "create_or_update" })] }, [node], "Vergiss das bitte.");
    const upd = nodeWrites(r.writes).find((o) => o.op === "update");
    expect(upd!.payload).toMatchObject({ lifecycle: "weak" });
    expect(r.writes.some((o) => o.table === "orb_node_history" && o.payload.reason === "forget")).toBe(true);
  });
  it("F: ungültige Kandidaten → Sanitize entfernt / Validate lehnt ab", async () => {
    const r = await run({ candidates: [{ key: "x" }, cand({ key: "q", value: "Was machst du?" }), cand({ key: "c", confidence: 0.2 })] });
    expect(r.report.candidatesDetected).toBe(2); // pre 3 → post 2
    expect(r.report.candidatesRejected).toBe(2);
    expect(r.report.memoriesCreated).toBe(0);
  });
  it("G: unbekannter related_node → verworfen; kommt über strict Schema ohnehin nie", () => {
    const out = sanitizeCandidates({ candidates: [cand({ related_nodes: ["22222222-2222-4222-8222-222222222222", N1] })] }, [N1]);
    expect(out[0].relatedNodeIds).toEqual([N1]);
  });
  it("H: candidates:[] → 0, failure null, trotzdem Metrik + Lifecycle-Pass", async () => {
    const r = await run({ candidates: [] }, [{ ...node, temporal_scope: "one_time", last_accessed_at: old }]);
    expect(r.report.failure).toBeNull();
    expect(r.report.candidatesDetected).toBe(0);
    expect(r.report.memoriesDecayed).toBe(1); // Lifecycle-Update unabhängig von Kandidaten
    expect(r.writes.some((o) => o.table === "orb_metrics" && o.op === "insert")).toBe(true);
  });
  it("Fehlerklassen: HTTP 402 / malformed / leer → 0 Kandidaten, Metrik wird trotzdem geschrieben", async () => {
    for (const [resp, kind] of [
      [new Response("x", { status: 402 }), "http"],
      [new Response("data: {\"type\":\"response.completed\",\"response\":{\"output_text\":\"{nope\"}}\n\n", { status: 200 }), "malformed"],
      [new Response("", { status: 200 }), "malformed"],
    ] as const) {
      const r = await run(resp);
      expect(r.report.failure).toBe(kind);
      expect(r.calls).toBe(1);
      expect(r.writes.some((o) => o.table === "orb_metrics" && o.op === "insert")).toBe(true);
    }
    fetchSpy.mockRejectedValue(new TypeError("network"));
    const { db } = fakeDb([], [{ role: "user", body: "x", created_at: old }]);
    expect((await analyzeAndPersist(db, U)).failure).toBe("http");
  });
});
