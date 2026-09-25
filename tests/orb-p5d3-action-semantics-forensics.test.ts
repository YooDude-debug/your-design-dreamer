/* eslint-disable @typescript-eslint/no-explicit-any -- Fake-DB/Fetch im Diagnose-Test */
// P5-D3: rein diagnostisch. Keine Produktivänderung, keine echte DB, kein echter Modellaufruf.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeAndPersist } from "@/orb-core/analysis/apply.server";
import { normKey } from "@/orb-core/memory";

const N1 = "11111111-1111-4111-8111-111111111111";
const old = new Date(Date.now() - 86_400_000).toISOString();
const VALUE = "Der Benutzer nutzt eine RTX 5070 Grafikkarte.";

function fakeDb(nodes: any[], messages: any[]) {
  const ops: any[] = [];
  const from = (table: string) => {
    const o: any = { table, op: "select", filters: {} };
    const b: any = {
      select: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () => b,
      single: () => b,
      insert: (p: any) => {
        o.op = "insert";
        o.payload = p;
        return b;
      },
      update: (p: any) => {
        o.op = "update";
        o.payload = p;
        return b;
      },
      eq: (k: string, v: unknown) => {
        o.filters[k] = v;
        return b;
      },
      then: (res: any) => {
        ops.push(o);
        if (o.op === "insert") return res({ data: { id: "new-node" }, error: null });
        if (o.op === "update") return res({ data: null, error: null });
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
  const t = JSON.stringify(obj);
  return new Response(
    `data: ${JSON.stringify({ type: "response.completed", response: { output_text: t } })}\n\n`,
    { status: 200 },
  );
}
const cand = (action: string, value = VALUE) => ({
  key: "gpu",
  value,
  category: "fact",
  relevance: 0.8,
  long_term_value: 0.8,
  confidence: 0.9,
  temporal_scope: "long_term",
  decay_rate: 0.01,
  source_reference: "turn",
  action,
});
const mkNode = (content: string) => ({
  id: N1,
  content,
  norm_key: normKey(content) || null,
  category: "fact",
  long_term_value: 0.5,
  temporal_scope: "persistent",
  lifecycle: "active",
  importance: 0.5,
  decay_rate: 0,
  activation_count: 2,
  created_at: old,
  last_accessed_at: new Date().toISOString(),
});

async function run(action: string, match: "none" | "same" | "changed", forgetSignal: boolean) {
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    sse({
      candidates: [
        cand(
          action,
          match === "changed" ? "Der Benutzer nutzt inzwischen eine RTX 5080 Grafikkarte." : VALUE,
        ),
      ],
    }),
  );
  const nodes = match === "none" ? [] : [mkNode(VALUE)];
  const text = forgetSignal ? "Vergiss das bitte." : "Ich habe eine Grafikkarte.";
  const { db, ops } = fakeDb(nodes, [{ role: "user", body: text, created_at: old }]);
  await analyzeAndPersist(db, "u1");
  const cRow = ops.find((o) => o.table === "orb_candidates" && o.op === "insert")?.payload;
  const nodeW = ops.filter((o) => o.table === "orb_nodes" && o.op !== "select");
  const upd = nodeW.find((o) => o.op === "update");
  const effect = nodeW.some((o) => o.op === "insert")
    ? "INSERT"
    : upd
      ? "content" in upd.payload
        ? "UPDATE_CONTENT"
        : "activation_count" in upd.payload
          ? "REINFORCE"
          : `WEAKEN(${upd.payload.lifecycle})`
      : "NONE";
  return {
    calls: f.mock.calls.length,
    decision: cRow?.decision,
    storedAction: cRow?.action,
    effect,
    history: ops.filter((o) => o.table === "orb_node_history").map((o) => o.payload.reason),
  };
}

beforeEach(() => {
  process.env["LOVABLE_API_KEY"] = "test";
});
afterEach(() => {
  vi.restoreAllMocks();
});

const ACTIONS = ["create_or_update", "reinforce", "forget"] as const;
const EXPECT: Record<string, [string, string]> = {
  "none|false": ["accepted", "INSERT"],
  "same|false": ["duplicate", "REINFORCE"],
  "changed|false": ["update", "UPDATE_CONTENT"],
  "none|true": ["rejected", "NONE"],
  "same|true": ["update", "WEAKEN(weak)"],
  "changed|true": ["update", "WEAKEN(weak)"],
};

const SEEN: Record<string, Set<string>> = {};
describe("P5-D3 Action × Treffer × Forget-Signal (Mock)", () => {
  for (const action of ACTIONS)
    for (const key of Object.keys(EXPECT)) {
      const [match, sig] = key.split("|") as ["none" | "same" | "changed", string];
      it(`${action} | Treffer=${match} | Forget-Signal=${sig}`, async () => {
        const r = await run(action, match, sig === "true");
        process.stdout.write(
          `MATRIX ${action} ${key} ${r.decision} ${r.effect} ${r.history.join(",")}\n`,
        );
        expect(r.calls).toBe(1);
        expect(r.storedAction).toBe(action); // nur gespeichert
        expect([r.decision, r.effect]).toEqual(EXPECT[key]);
        (SEEN[key] ??= new Set()).add(`${r.decision}/${r.effect}`); // identisch für alle drei Actions
      });
    }
  it("Action identisch → Ergebnis identisch (Action beeinflusst Wirkung nicht)", () => {
    for (const key of Object.keys(EXPECT)) expect(SEEN[key]?.size).toBe(1);
  });
});
