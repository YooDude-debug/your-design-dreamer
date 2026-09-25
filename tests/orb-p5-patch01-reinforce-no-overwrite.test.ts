/* eslint-disable @typescript-eslint/no-explicit-any -- Fake-DB im Test */
// P5-PATCH-01: reinforce + bestehender Treffer → nur Verstärkung, nie Content-Overwrite.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeAndPersist } from "@/orb-core/analysis/apply.server";
import { normKey } from "@/orb-core/memory";

const A = "11111111-1111-4111-8111-111111111111";
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const KOCH = "Ich arbeite als Koch.";
const PROG = "Ich arbeite inzwischen als Programmierer.";
const OLD_ACCESS = iso(now - 60_000);

function fakeDb(content: string, userBody = "Hallo.") {
  const t = { updates: [] as any[], history: [] as any[], candidates: [] as any[] };
  const n: any = {
    id: A, content, norm_key: normKey(content), category: "fact", long_term_value: 0.5, temporal_scope: "long_term",
    lifecycle: "active", importance: 0.77, safety: "x", confidence: 0.6, topic: "beruf", decay_rate: 0.01,
    activation_count: 2, created_at: iso(now - 86_400_000), last_accessed_at: OLD_ACCESS,
  };
  const from = (table: string) => {
    const o: any = { op: "select" };
    const b: any = {
      select: () => b, order: () => b, limit: () => b, maybeSingle: () => b, single: () => b, eq: () => b,
      insert: (p: any) => ((o.op = "insert"), (o.p = p), b),
      update: (p: any) => ((o.op = "update"), (o.p = p), b),
      then: (res: any) => {
        if (table === "orb_messages") return res({ data: [{ role: "user", body: userBody, created_at: iso(now) }], error: null });
        if (table === "orb_nodes" && o.op === "select") return res({ data: [{ ...n }], error: null });
        if (table === "orb_nodes" && o.op === "update") return t.updates.push(o.p), Object.assign(n, o.p), res({ data: null, error: null });
        if (table === "orb_node_history") return t.history.push(o.p), res({ data: null, error: null });
        if (table === "orb_candidates") return t.candidates.push(o.p), res({ data: null, error: null });
        if (table === "orb_nodes" && o.op === "insert") return res({ data: { id: "new" }, error: null });
        return res({ data: null, error: null });
      },
    };
    return b;
  };
  return { db: { from } as any, t, n };
}
function mockModel(value: string, action: string) {
  const text = JSON.stringify({ candidates: [{ key: "memo_k", value, category: "fact", relevance: 0.8, long_term_value: 0.8,
    confidence: 0.9, temporal_scope: "long_term", decay_rate: 0.01, source_reference: "t", action }] });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    new Response(`data: ${JSON.stringify({ type: "response.completed", response: { output_text: text } })}\n\n`, { status: 200 }));
}
async function run(content: string, value: string, action: string, userBody?: string) {
  const f = fakeDb(content, userBody);
  mockModel(value, action);
  await analyzeAndPersist(f.db, "u1");
  return f;
}
beforeEach(() => { process.env["LOVABLE_API_KEY"] = "test"; vi.spyOn(console, "info").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe("P5-PATCH-01 reinforce ohne Content-Overwrite", () => {
  it("A reinforce + gleicher Content → kein Overwrite", async () => {
    const { n, t } = await run(KOCH, KOCH, "reinforce");
    expect(n.content).toBe(KOCH);
    expect(t.updates.some((u) => "content" in u)).toBe(false);
  });
  it("B reinforce + geänderter Content → KEIN Overwrite, keine Feld-Überschreibung", async () => {
    const { n, t } = await run(KOCH, PROG, "reinforce");
    expect(t.candidates[0].decision).toBe("update"); // Entscheidung unverändert, nur Wirkung geändert
    expect(n.content).toBe(KOCH);
    expect(Object.keys(t.updates[0]).sort()).toEqual(["activation_count", "last_accessed_at", "lifecycle"]);
    expect(n).toMatchObject({ category: "fact", confidence: 0.6, long_term_value: 0.5, temporal_scope: "long_term", norm_key: normKey(KOCH), topic: "beruf" });
  });
  it("C activation +1", async () => expect((await run(KOCH, PROG, "reinforce")).n.activation_count).toBe(3));
  it("D last_accessed aktualisiert", async () => {
    const { n } = await run(KOCH, PROG, "reinforce");
    expect(n.last_accessed_at).not.toBe(OLD_ACCESS);
    expect(n.lifecycle).toBe("active");
  });
  it("E/F importance und safety unverändert", async () => {
    const { n } = await run(KOCH, PROG, "reinforce");
    expect(n.importance).toBe(0.77);
    expect(n.safety).toBe("x");
  });
  it("G History reason reinforcement, Inhalt unverändert", async () => {
    const { t } = await run(KOCH, PROG, "reinforce");
    expect(t.history).toHaveLength(1);
    expect(t.history[0]).toMatchObject({ reason: "reinforcement", previous_value: KOCH, new_value: KOCH,
      metadata: { action: "reinforce", suppressed_decision: "update" } });
  });
  it("reinforce + Negation (contradiction) → ebenfalls kein Overwrite", async () => {
    const { n, t } = await run("Ich mag Pizza.", "Ich mag keine Pizza.", "reinforce");
    expect(t.candidates[0].decision).toBe("contradiction");
    expect(n.content).toBe("Ich mag Pizza.");
  });
  it("H create_or_update + geänderter Treffer → bisheriger UPDATE-Pfad", async () => {
    const { n, t } = await run(KOCH, PROG, "create_or_update");
    expect(n.content).toBe(PROG);
    expect(t.history[0]).toMatchObject({ reason: "update", previous_value: KOCH, new_value: PROG });
  });
  it("I forget-Action → bisheriges Verhalten (ohne Signal: Update-Pfad; mit Signal: Weaken)", async () => {
    const a = await run(KOCH, PROG, "forget");
    expect(a.n.content).toBe(PROG);
    const b = await run(KOCH, PROG, "forget", "Vergiss das.");
    expect(b.t.history[0].reason).toBe("forget");
    expect(b.n.content).toBe(KOCH);
  });
  it("I2 reinforce + Forget-Signal → Weaken bleibt vorrangig", async () => {
    const { t } = await run(KOCH, PROG, "reinforce", "Vergiss das.");
    expect(t.history[0].reason).toBe("forget");
  });
  it("J unbekannte Action → normalisiert, bisheriges Update-Verhalten", async () => {
    const { n, t } = await run(KOCH, PROG, "strengthen");
    expect(t.candidates[0].action).toBe("create_or_update");
    expect(n.content).toBe(PROG);
  });
});
