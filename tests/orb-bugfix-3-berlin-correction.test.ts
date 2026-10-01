/* eslint-disable @typescript-eslint/no-explicit-any -- Fake-DB im Test */
// BUG 3: „Ich wohne in Berlin." → „Ich wohne nicht mehr in Berlin."
// Dokumentiert den vorgesehenen Zustand für confidence 0.9 / 0.4 / simuliertes 23505.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeAndPersist } from "@/orb-core/analysis/apply.server";
import { normKey } from "@/orb-core/memory";

const OLD = "Ich wohne in Berlin.";
const NEW = "Ich wohne nicht mehr in Berlin.";
const A = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const iso = (ms: number) => new Date(ms).toISOString();

function fakeDb(opts: { conflict?: boolean } = {}) {
  const t = { updates: [] as any[], history: [] as any[], candidates: [] as any[], inserts: [] as any[] };
  const n: any = {
    id: A,
    content: OLD,
    norm_key: normKey(OLD),
    category: "fact",
    long_term_value: 0.8,
    temporal_scope: "long_term",
    lifecycle: "active",
    importance: 0.7,
    confidence: 0.9,
    topic: "wohnort",
    decay_rate: 0.01,
    activation_count: 2,
    created_at: iso(Date.now() - 86_400_000),
    last_accessed_at: iso(Date.now() - 60_000),
  };
  const from = (table: string) => {
    const o: any = { op: "select", eqs: [] as any[] };
    const b: any = {
      select: () => b,
      order: () => b,
      limit: () => b,
      single: () => b,
      maybeSingle: () => ((o.single = true), b),
      eq: (k: string, v: any) => (o.eqs.push([k, v]), b),
      insert: (p: any) => ((o.op = "insert"), (o.p = p), b),
      update: (p: any) => ((o.op = "update"), (o.p = p), b),
      then: (res: any) => {
        if (table === "orb_messages")
          return res({ data: [{ role: "user", body: NEW, created_at: iso(Date.now()) }], error: null });
        if (table === "orb_nodes" && o.op === "select" && o.single)
          return res({ data: opts.conflict ? { id: OTHER } : null, error: null });
        if (table === "orb_nodes" && o.op === "select") return res({ data: [{ ...n }], error: null });
        if (table === "orb_nodes" && o.op === "update") {
          if (opts.conflict && "content" in o.p)
            return res({ data: null, error: { code: "23505", message: "dup" } });
          t.updates.push(o.p);
          Object.assign(n, o.p);
          return res({ data: null, error: null });
        }
        if (table === "orb_nodes" && o.op === "insert")
          return (t.inserts.push(o.p), res({ data: { id: "new" }, error: null }));
        if (table === "orb_node_history") return (t.history.push(o.p), res({ data: null, error: null }));
        if (table === "orb_candidates") return (t.candidates.push(o.p), res({ data: null, error: null }));
        return res({ data: null, error: null });
      },
    };
    return b;
  };
  return { db: { from } as any, t, n };
}

function mockModel(confidence: number) {
  const text = JSON.stringify({
    candidates: [
      {
        key: "wohnort",
        value: NEW,
        category: "fact",
        relevance: 0.9,
        long_term_value: 0.8,
        confidence,
        temporal_scope: "long_term",
        decay_rate: 0.01,
        source_reference: "t",
        action: "create_or_update",
      },
    ],
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(
        `data: ${JSON.stringify({ type: "response.completed", response: { output_text: text } })}\n\n`,
        { status: 200 },
      ),
  );
}

async function run(confidence: number, conflict = false) {
  const f = fakeDb({ conflict });
  mockModel(confidence);
  const report = await analyzeAndPersist(f.db, "u1");
  return { ...f, report };
}

beforeEach(() => {
  process.env["LOVABLE_API_KEY"] = "test";
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("BUG 3 – Berlin-Korrektur", () => {
  it("A confidence 0.9: Widerspruch wird angewendet, Historie hält alte Angabe", async () => {
    const { n, t } = await run(0.9);
    expect(t.candidates[0].decision).toBe("contradiction");
    expect(n.content).toBe(NEW); // neue Information gespeichert und retrievalfähig
    expect(n.norm_key).toBe(normKey(NEW));
    const h = t.history.find((x) => x.reason === "contradiction");
    expect(h).toMatchObject({ node_id: A, previous_value: OLD, new_value: NEW }); // alt nachvollziehbar
  });

  it("B confidence 0.4: bewusst nicht angewendet, aber ausdrücklich protokolliert", async () => {
    const { n, t } = await run(0.4);
    expect(n.content).toBe(OLD); // alte Erinnerung unverändert vorhanden
    expect(t.history).toHaveLength(0); // kein falscher Erfolgsstatus
    expect(t.candidates[0].decision).toBe("rejected");
    expect(t.candidates[0].decision_reason).toMatch(/Möglicher Widerspruch/); // nicht still
  });

  it("C simuliertes 23505: keine Erfolgs-Historie, neue Angabe existiert bereits", async () => {
    const { n, t, report } = await run(0.9, true);
    expect(n.content).toBe(OLD); // alte Erinnerung bleibt
    expect(t.history.filter((x) => x.reason === "contradiction")).toHaveLength(0);
    expect(report.memoriesUpdated).toBe(0);
    expect(t.inserts.filter((x) => x.content === NEW)).toHaveLength(0); // keine Dublette
    expect(console.warn).toHaveBeenCalledWith("[orb-analysis] update skipped", { code: "23505" });
  });
});
