/* eslint-disable @typescript-eslint/no-explicit-any -- Fake-DB im Diagnose-Test */
// P5-D8: rein diagnostisch. Keine Produktivänderung, keine echte DB, kein echter Modellaufruf.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeAndPersist } from "@/orb-core/analysis/apply.server";
import { validateCandidate, userSignalsFrom } from "@/orb-core/analysis/validate";
import { normKey, similarity } from "@/orb-core/memory";

const A = "11111111-1111-4111-8111-111111111111";
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const NONE = userSignalsFrom(["Hallo."]);
const ex = (c: string, cat = "fact") => ({
  id: A,
  content: c,
  normKey: normKey(c),
  category: cat,
  longTermValue: 0.5,
  temporalScope: "long_term" as const,
});
const cd = (value: string, o: any = {}): any => ({
  key: "memo_k",
  value,
  category: "fact",
  relevance: 0.8,
  longTermValue: 0.8,
  confidence: 0.9,
  temporalScope: "long_term",
  decayRate: 0.01,
  source: "conversation",
  sourceReference: "t",
  relatedNodeIds: [],
  action: "reinforce",
  ...o,
});
const dec = (old: string, v: string, o: any = {}, s = NONE) =>
  validateCandidate(cd(v, o), [ex(old)], s).decision;

function fakeDb(content: string, userBody = "Hallo.") {
  const t = { updates: [] as any[], history: [] as any[], candidates: [] as any[] };
  const n: any = {
    id: A,
    content,
    norm_key: normKey(content),
    category: "fact",
    long_term_value: 0.5,
    temporal_scope: "long_term",
    lifecycle: "active",
    importance: 0.77,
    safety: "x",
    decay_rate: 0.01,
    activation_count: 2,
    created_at: iso(now - 86_400_000),
    last_accessed_at: iso(now - 60_000),
  };
  const from = (table: string) => {
    const o: any = { op: "select" };
    const b: any = {
      select: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () => b,
      single: () => b,
      eq: () => b,
      insert: (p: any) => ((o.op = "insert"), (o.p = p), b),
      update: (p: any) => ((o.op = "update"), (o.p = p), b),
      then: (res: any) => {
        if (table === "orb_messages")
          return res({
            data: [{ role: "user", body: userBody, created_at: iso(now) }],
            error: null,
          });
        if (table === "orb_nodes" && o.op === "select")
          return res({ data: [{ ...n }], error: null });
        if (table === "orb_nodes" && o.op === "update")
          return (t.updates.push(o.p), Object.assign(n, o.p), res({ data: null, error: null }));
        if (table === "orb_node_history")
          return (t.history.push(o.p), res({ data: null, error: null }));
        if (table === "orb_candidates")
          return (t.candidates.push(o.p), res({ data: null, error: null }));
        if (o.op === "insert" && table === "orb_nodes")
          return res({ data: { id: "new" }, error: null });
        return res({ data: null, error: null });
      },
    };
    return b;
  };
  return { db: { from } as any, t, n };
}
function mockModel(value: string, action: string, o: any = {}) {
  const text = JSON.stringify({
    candidates: [
      {
        key: "memo_k",
        value,
        category: "fact",
        relevance: 0.8,
        long_term_value: 0.8,
        confidence: 0.9,
        temporal_scope: "long_term",
        decay_rate: 0.01,
        source_reference: "t",
        action,
        ...o,
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
beforeEach(() => {
  process.env["LOVABLE_API_KEY"] = "test";
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const KOCH = "Ich arbeite als Koch.";
const PROG = "Ich arbeite inzwischen als Programmierer.";
// P5-PATCH-02: starker Treffer (similarity ≈ 0.67 ≥ 0.5) für den echten Overwrite-Pfad.
const STRONG = "Ich arbeite als Koch in Leipzig.";

describe("P5-D8 Action vs. Wirkung (Apply mit Fake-DB)", () => {
  for (const action of ["create_or_update", "reinforce", "forget"]) {
    it(`${action} + identischer Inhalt → duplicate → nur Verstärkung, kein Overwrite`, async () => {
      const { db, t, n } = fakeDb(KOCH);
      mockModel(KOCH, action);
      await analyzeAndPersist(db, "u1");
      expect(t.candidates[0].decision).toBe("duplicate");
      expect(n.content).toBe(KOCH);
      expect(n.activation_count).toBe(3);
      expect(t.history[0].reason).toBe("reinforcement");
    });
    it(`${action === "reinforce" ? "reinforce→create_or_update" : action} + geänderter Inhalt (Treffer) → update → CONTENT-OVERWRITE`, async () => {
      const { db, t, n } = fakeDb(KOCH);
      // P5-PATCH-01: reinforce überschreibt bestehenden Content nicht mehr;
      // der Overwrite-Pfad wird ausschließlich mit create_or_update dokumentiert.
      mockModel(STRONG, action === "reinforce" ? "create_or_update" : action);
      await analyzeAndPersist(db, "u1");
      expect(t.candidates[0].decision).toBe("update");
      expect(n.content).toBe(STRONG);
      expect(t.history[0]).toMatchObject({
        reason: "update",
        previous_value: KOCH,
        new_value: STRONG,
        metadata: { reason: expect.any(String) },
      });
    });
  }
  it("I Overwrite-Felder: importance/safety unverändert; History ohne run_id/candidate_id/message-Referenz", async () => {
    const { db, t, n } = fakeDb(KOCH);
    // P5-PATCH-01: Overwrite-Pfad nur noch mit create_or_update.
    mockModel(STRONG, "create_or_update");
    await analyzeAndPersist(db, "u1");
    const u = t.updates.find((x) => "content" in x);
    expect(Object.keys(u).sort()).toEqual([
      "activation_count",
      "category",
      "confidence",
      "content",
      "decay_rate",
      "last_accessed_at",
      "lifecycle",
      "long_term_value",
      "norm_key",
      "source_reference",
      "temporal_scope",
      "topic",
    ]);
    expect(n.importance).toBe(0.77);
    expect(n.safety).toBe("x");
    expect(Object.keys(t.history[0]).sort()).toEqual([
      "metadata",
      "new_lifecycle",
      "new_value",
      "node_id",
      "previous_lifecycle",
      "previous_value",
      "reason",
      "user_id",
    ]);
    expect(Object.keys(t.history[0].metadata)).toEqual(["reason"]);
  });
});

describe("P5-D8 Entscheidungsmatrix (validateCandidate)", () => {
  it("Treffer-Mechanik: Koch → Programmierer", () => {
    expect(similarity(KOCH, PROG)).toBeCloseTo(0.25, 2);
    expect(normKey(KOCH)).not.toBe(normKey(PROG));
    expect(dec(KOCH, PROG)).toBe("update"); // gleiche Kategorie + sim ≥ 0.2
    expect(dec(KOCH, PROG, { category: "other" })).toBe("accepted"); // kein Treffer → neue Memory, alte bleibt
  });
  it("Zustandswechsel", () => {
    expect(dec("Ich bin 36 Jahre alt.", "Ich bin 37 Jahre alt.")).toBe("duplicate"); // Zahlen fallen aus norm_key → KEIN Update
    expect(dec("Ich wohne in Berlin.", "Ich wohne in Hamburg.")).toBe("update");
    expect(
      dec("Ich nutze eine RTX 5070 Grafikkarte.", "Ich nutze eine Radeon RX 9070 Grafikkarte."),
    ).toBe("update");
  });
  it("H Negation → contradiction; G Change-Signal nur aus User-Text", () => {
    expect(dec("Ich mag Pizza.", "Ich mag keine Pizza.")).toBe("contradiction");
    expect(dec(KOCH, "Ich arbeite als Programmierer.", {}, userSignalsFrom([PROG]))).toBe(
      "contradiction",
    );
  });
  it("E Confidence-Grenze 0.55; F LTV wird bei Treffer NICHT geprüft", () => {
    expect(dec(KOCH, PROG, { confidence: 0.54 })).toBe("rejected");
    expect(dec(KOCH, PROG, { confidence: 0.56 })).toBe("update");
    expect(dec(KOCH, PROG, { longTermValue: 0.29 })).toBe("update");
    expect(dec(KOCH, "Ich spiele Schach im Verein.", { longTermValue: 0.29 })).toBe("rejected");
    expect(dec(KOCH, "Ich spiele Schach im Verein.", { longTermValue: 0.31 })).toBe("accepted");
  });
  it("Action ändert keine Entscheidung", () => {
    for (const action of ["create_or_update", "reinforce", "forget"])
      expect(dec(KOCH, STRONG, { action })).toBe("update");
  });
});
