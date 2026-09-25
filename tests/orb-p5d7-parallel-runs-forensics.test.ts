/* eslint-disable @typescript-eslint/no-explicit-any -- zustandsbehaftete Fake-DB im Diagnose-Test */
// P5-D7: rein diagnostisch. Keine Produktivänderung, keine echte DB, kein echter Modellaufruf.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeAndPersist } from "@/orb-core/analysis/apply.server";
import { normKey } from "@/orb-core/memory";

const A = "11111111-1111-4111-8111-111111111111";
const VA = "Der Benutzer nutzt eine RTX 5070 Grafikkarte.";
const VNEW = "Der Benutzer spielt gerne Schach im Verein.";
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

/** Fake-DB: Updates wirken auf spätere Reads; UNIQUE(user_id,norm_key) wie in der echten Tabelle. */
function fakeDb(nodes: any[], userBodies: string[]) {
  const t = {
    metrics: [] as any[],
    history: [] as any[],
    candidates: [] as any[],
    updates: [] as any[],
  };
  const messages = userBodies.map((b, i) => ({
    role: "user",
    body: b,
    created_at: iso(now - 10_000 + i),
  }));
  const from = (table: string) => {
    const o: any = { op: "select", f: {} };
    const b: any = {
      select: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () => b,
      single: () => b,
      insert: (p: any) => ((o.op = "insert"), (o.p = p), b),
      update: (p: any) => ((o.op = "update"), (o.p = p), b),
      eq: (k: string, v: unknown) => ((o.f[k] = v), b),
      then: (res: any) => {
        if (table === "orb_metrics" && o.op === "select") {
          const last = t.metrics.filter((m) => m.kind === "analysis").at(-1);
          return res({ data: last ? { created_at: last.created_at } : null, error: null });
        }
        if (table === "orb_metrics")
          return (
            t.metrics.push({ ...o.p, created_at: iso(Date.now()) }),
            res({ data: null, error: null })
          );
        if (table === "orb_messages") return res({ data: messages.slice().reverse(), error: null });
        if (table === "orb_nodes" && o.op === "select")
          return res({ data: nodes.map((n) => ({ ...n })), error: null });
        if (table === "orb_nodes" && o.op === "update") {
          const n = nodes.find((r) => r.id === o.f.id);
          t.updates.push({ ...o.p });
          if (n) Object.assign(n, o.p);
          return res({ data: null, error: null });
        }
        if (table === "orb_nodes" && o.op === "insert") {
          if (o.p.norm_key && nodes.some((n) => n.norm_key === o.p.norm_key))
            return res({ data: null, error: { code: "23505", message: "duplicate key" } });
          const id = `new-${nodes.length}`;
          nodes.push({ ...o.p, id });
          return res({ data: { id }, error: null });
        }
        if (table === "orb_node_history")
          return (t.history.push(o.p), res({ data: null, error: null }));
        if (table === "orb_candidates")
          return (t.candidates.push(o.p), res({ data: null, error: null }));
        return res({ data: null, error: null });
      },
    };
    return b;
  };
  return { db: { from } as any, t, nodes };
}
const node = (content: string, lifecycle = "active") => ({
  id: A,
  content,
  norm_key: normKey(content),
  category: "fact",
  long_term_value: 0.5,
  temporal_scope: "long_term",
  lifecycle,
  importance: 0.5,
  decay_rate: 0.01,
  activation_count: 2,
  created_at: iso(now - 86_400_000),
  last_accessed_at: iso(now - 60_000),
});
/** Modell mit Verzögerung: beide Runs passieren den Throttle, bevor einer Metriken schreibt. */
function mockModel(value: string, action = "reinforce") {
  const text = JSON.stringify({
    candidates: [
      {
        key: "k",
        value,
        category: "fact",
        relevance: 0.8,
        long_term_value: 0.8,
        confidence: 0.9,
        temporal_scope: "long_term",
        decay_rate: 0.01,
        source_reference: "t",
        action,
      },
    ],
  });
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    await new Promise((r) => setTimeout(r, 20));
    return new Response(
      `data: ${JSON.stringify({ type: "response.completed", response: { output_text: text } })}\n\n`,
      { status: 200 },
    );
  });
  return fetchSpy;
}
const both = async (db: any) => { const r = await Promise.all([analyzeAndPersist(db, "u1"), analyzeAndPersist(db, "u1")]); process.stdout.write(`REP ${JSON.stringify(r.map((x) => [x.ran, x.skippedReason, x.failure, x.candidatesDetected]))}\n`); return r; };

beforeEach(() => {
  process.env["LOVABLE_API_KEY"] = "test";
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("P5-D7 parallele Hintergrund-Runs (Fake-DB)", () => {
  it("Throttle: sequentiell greift er, parallel nicht (2 Modellaufrufe, 2 Metriken)", async () => {
    const seq = fakeDb([node(VA)], ["Hallo."]);
    const f1 = mockModel(VA);
    await analyzeAndPersist(seq.db, "u1");
    const r2 = await analyzeAndPersist(seq.db, "u1");
    expect(r2.skippedReason).toBe("throttled");
    expect(f1).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    const par = fakeDb([node(VA)], ["Hallo."]);
    const f2 = mockModel(VA);
    const rs = await both(par.db);
    expect(rs.map((r) => r.ran)).toEqual([true, true]);
    expect(f2).toHaveBeenCalledTimes(2);
    expect(par.t.metrics.length).toBe(2);
  });
  it("A Reinforce: beide lesen activation_count=2, beide schreiben 3 → ein Inkrement verloren, 2 History", async () => {
    const { db, t, nodes } = fakeDb([node(VA)], ["Hallo."]);
    mockModel(VA);
    await both(db);
    const acts = t.updates.filter((u) => "activation_count" in u).map((u) => u.activation_count);
    expect(acts).toEqual([3, 3]);
    expect(nodes[0].activation_count).toBe(3);
    expect(t.history.filter((h) => h.reason === "reinforcement").length).toBe(2);
    expect(t.candidates.map((c) => c.decision)).toEqual(["duplicate", "duplicate"]);
  });
  it("B Update: beide überschreiben Inhalt (letzter gewinnt), activation 3 statt 4, 2 History", async () => {
    const { db, t, nodes } = fakeDb([node(VA)], ["Hallo."]);
    mockModel("Der Benutzer nutzt jetzt eine RTX 5080 Grafikkarte.");
    await both(db);
    const acts = t.updates.filter((u) => "content" in u).map((u) => u.activation_count);
    expect(acts).toEqual([3, 3]);
    expect(nodes[0].activation_count).toBe(3);
    expect(t.history.filter((h) => h.reason === "update").length).toBe(2);
  });
  it("C/F Insert-Race: genau eine Memory, zweiter 23505 → node_id null, trotzdem decision accepted protokolliert", async () => {
    const { db, t, nodes } = fakeDb([], ["Ich spiele gerne Schach im Verein."]);
    mockModel(VNEW, "create_or_update");
    const rs = await both(db);
    expect(nodes.length).toBe(1);
    expect(t.candidates.map((c) => c.decision)).toEqual(["accepted", "accepted"]);
    expect(t.candidates.map((c) => c.node_id === null)).toEqual([false, true]);
    expect(rs.map((r) => r.memoriesCreated).sort()).toEqual([0, 1]);
  });
  it("D Forget: ein Satz, zwei Runs → beide weaken, 2 forget-History, gleicher Endwert", async () => {
    const { db, t } = fakeDb([node(VA)], ["Vergiss die RTX."]);
    mockModel(VA);
    await both(db);
    const f = t.history.filter((h) => h.reason === "forget");
    expect(f.length).toBe(2);
    expect(f.map((h) => `${h.previous_lifecycle}>${h.new_lifecycle}`)).toEqual([
      "active>weak",
      "active>weak",
    ]);
  });
  it("E Lifecycle: nach beiden Runs wieder active (Pass vergleicht mit geladenem Wert, ohne Guard)", async () => {
    const { db, t, nodes } = fakeDb([node(VA)], ["Vergiss die RTX."]);
    mockModel(VA);
    await both(db);
    const seq = t.updates.filter((u) => "lifecycle" in u).map((u) => u.lifecycle);
    process.stdout.write(`LIFECYCLE ${JSON.stringify(seq)} end=${nodes[0].lifecycle}\n`);
    expect(seq).toContain("weak");
    expect(nodes[0].lifecycle).toBe(seq.at(-1));
  });
});
