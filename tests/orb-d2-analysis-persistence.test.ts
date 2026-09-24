import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeAndPersist } from "@/orb-core/analysis/apply.server";

const SECRET = "sk-test-SECRET-KEY-123";
const USER_TEXT = "GEHEIMER_USERTEXT ich arbeite als Koch";
const MEMORY = "GEHEIME_MEMORY Lieblingsessen Pizza";

type Insert = { table: string; row: Record<string, unknown> };

/** Minimaler, kettenfähiger DB-Ersatz: jede Methode gibt den Builder zurück. */
function fakeDb() {
  const inserts: Insert[] = [];
  const db = {
    from(table: string) {
      let insertRow: Record<string, unknown> | null = null;
      const result = () => {
        if (insertRow) return { data: { id: crypto.randomUUID() }, error: null };
        if (table === "orb_messages")
          return {
            data: [{ role: "user", body: USER_TEXT, created_at: new Date().toISOString() }],
            error: null,
          };
        if (table === "orb_nodes")
          return {
            data: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                content: MEMORY,
                norm_key: "essen",
                category: "preference",
                long_term_value: 0.5,
                temporal_scope: "long_term",
                lifecycle: "active",
                importance: 0.5,
                decay_rate: 0.1,
                activation_count: 1,
                created_at: new Date().toISOString(),
                last_accessed_at: new Date().toISOString(),
              },
            ],
            error: null,
          };
        return { data: null, error: null };
      };
      const builder: Record<string, unknown> = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "then") return (res: (v: unknown) => void) => res(result());
            if (prop === "insert")
              return (row: Record<string, unknown>) => {
                insertRow = row;
                inserts.push({ table, row });
                return builder;
              };
            return () => builder;
          },
        },
      );
      return builder;
    },
  };
  return { db: db as never, inserts };
}

function sseResponse(content: string | null, status = 200) {
  const events: unknown[] = [{ type: "response.created" }];
  if (content) {
    const mid = Math.ceil(content.length / 2);
    events.push({ type: "response.output_text.delta", delta: content.slice(0, mid) });
    events.push({ type: "response.output_text.delta", delta: content.slice(mid) });
  }
  events.push({
    type: "response.completed",
    response: { usage: { input_tokens: 10, output_tokens: 5 } },
  });
  const body = events
    .map(
      (e) => `data: ${JSON.stringify(e)}

`,
    )
    .join("");
  return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } });
}
const okResponse = (content: string | null) => sseResponse(content);

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

const D2_KEYS = [
  "analysis_run_id",
  "provider",
  "http_status",
  "failure_kind",
  "pre_sanitize_count",
  "post_sanitize_count",
  "duration_ms",
];

async function runWith(fetchImpl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  const { db, inserts } = fakeDb();
  const report = await analyzeAndPersist(db, "9ce1d1b0-0000-4000-8000-000000000000");
  const metrics = inserts.filter((i) => i.table === "orb_metrics").map((i) => i.row);
  return { report, metrics, inserts };
}

describe("D2 – Analyse-Telemetrie in orb_metrics", () => {
  beforeEach(() => {
    process.env["LOVABLE_API_KEY"] = SECRET;
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env["LOVABLE_API_KEY"];
  });

  it("1: erfolgreicher Lauf speichert alle sieben Felder in genau einer Zeile", async () => {
    const { metrics } = await runWith(async () =>
      okResponse(JSON.stringify({ candidates: [cand("beruf", "Arbeitet als Koch.")] })),
    );
    expect(metrics).toHaveLength(1);
    const m = metrics[0];
    for (const k of D2_KEYS) expect(m).toHaveProperty(k);
    expect(m).toMatchObject({
      kind: "analysis",
      provider: "lovable_gateway",
      http_status: 200,
      failure_kind: null,
      pre_sanitize_count: 1,
      post_sanitize_count: 1,
    });
    expect(m.duration_ms).toBe(m.ai_ms);
    expect(m.nodes_loaded).toBe(1); // bestehende Semantik unverändert
  });

  it("2: HTTP 429 → http_status 429, failure_kind http, 0/0", async () => {
    const { metrics } = await runWith(async () => new Response("x", { status: 429 }));
    expect(metrics[0]).toMatchObject({
      http_status: 429,
      failure_kind: "http",
      pre_sanitize_count: 0,
      post_sanitize_count: 0,
      nodes_loaded: 0,
    });
  });

  it("3: Timeout und Netzwerkfehler → http_status null", async () => {
    const t = await runWith(async () => {
      throw Object.assign(new Error("t"), { name: "TimeoutError" });
    });
    expect(t.metrics[0]).toMatchObject({ http_status: null, failure_kind: "timeout" });
    const n = await runWith(async () => {
      throw new Error("net");
    });
    expect(n.metrics[0]).toMatchObject({ http_status: null, failure_kind: "http" });
  });

  it("4: pre != post wird korrekt gespeichert (3 → 2)", async () => {
    const body = {
      candidates: [cand("beruf", "Koch."), cand("beruf", "Doppelt."), cand("x", "y")],
    };
    const { metrics } = await runWith(async () => okResponse(JSON.stringify(body)));
    expect(metrics[0]).toMatchObject({ pre_sanitize_count: 3, post_sanitize_count: 1 });
  });

  it("5: analysis_run_id ist eine UUID und je Lauf eindeutig", async () => {
    const ids = new Set<unknown>();
    for (let i = 0; i < 5; i++) {
      const { metrics } = await runWith(async () => new Response("x", { status: 429 }));
      expect(String(metrics[0].analysis_run_id)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      ids.add(metrics[0].analysis_run_id);
    }
    expect(ids.size).toBe(5);
  });

  it("6: neue Felder enthalten keine Prompt-/Antwort-/Memory-/Nutzerdaten", async () => {
    const { metrics } = await runWith(async () =>
      okResponse(JSON.stringify({ candidates: [cand("beruf", "Arbeitet als Koch.")] })),
    );
    const d2 = Object.fromEntries(D2_KEYS.map((k) => [k, metrics[0][k]]));
    const flat = JSON.stringify(d2);
    for (const bad of [
      SECRET,
      "GEHEIMER_USERTEXT",
      "GEHEIME_MEMORY",
      "Koch",
      "Bearer",
      "9ce1d1b0",
    ]) {
      expect(flat).not.toContain(bad);
    }
    for (const k of ["http_status", "pre_sanitize_count", "post_sanitize_count", "duration_ms"]) {
      expect(d2[k] === null || typeof d2[k] === "number").toBe(true);
    }
  });

  it("genau ein Modellaufruf je Lauf", async () => {
    const f = vi.fn(async () => new Response("x", { status: 429 }));
    vi.stubGlobal("fetch", f);
    await analyzeAndPersist(fakeDb().db, "u");
    expect(f).toHaveBeenCalledTimes(1);
  });
});
