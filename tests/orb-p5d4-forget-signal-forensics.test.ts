/* eslint-disable @typescript-eslint/no-explicit-any -- zustandsbehaftete Fake-DB im Diagnose-Test */
// P5-D4: rein diagnostisch. Keine Produktivänderung, keine echte DB, kein echter Modellaufruf.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeAndPersist, ANALYSIS_TRANSCRIPT_MESSAGES } from "@/orb-core/analysis/apply.server";
import { userSignalsFrom } from "@/orb-core/analysis/validate";
import { normKey } from "@/orb-core/memory";

const X = "11111111-1111-4111-8111-111111111111";
const Y = "22222222-2222-4222-8222-222222222222";
const VX = "Der Benutzer nutzt eine RTX 5070 Grafikkarte.";
const VY = "Der Benutzer arbeitet als Koch in Berlin.";
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

type Msg = { role: string; body: string; created_at: string };
/** Zustandsbehaftete Fake-DB: Updates wirken auf spätere Reads (wie eine echte Tabelle). */
function statefulDb(nodes: any[], messages: Msg[]) {
  const history: any[] = [];
  const log: string[] = [];
  const from = (table: string) => {
    const o: any = { op: "select", f: {}, lim: Infinity };
    const b: any = {
      select: () => b,
      order: () => b,
      maybeSingle: () => b,
      single: () => b,
      limit: (n: number) => {
        o.lim = n;
        return b;
      },
      insert: (p: any) => {
        o.op = "insert";
        o.p = p;
        return b;
      },
      update: (p: any) => {
        o.op = "update";
        o.p = p;
        return b;
      },
      eq: (k: string, v: unknown) => {
        o.f[k] = v;
        return b;
      },
      then: (res: any) => {
        if (table === "orb_messages") {
          // wie im Code: neueste zuerst, Limit
          const sorted = messages.slice().sort((a, c) => c.created_at.localeCompare(a.created_at));
          return res({ data: sorted.slice(0, o.lim), error: null });
        }
        if (table === "orb_nodes" && o.op === "select")
          return res({ data: nodes.map((n) => ({ ...n })), error: null });
        if (table === "orb_nodes" && o.op === "update") {
          const n = nodes.find((r) => r.id === o.f.id);
          if (n) {
            Object.assign(n, o.p);
            log.push(
              `${n.id === X ? "X" : "Y"}:${Object.keys(o.p).join("+")}=${o.p.lifecycle ?? ""}`,
            );
          }
          return res({ data: null, error: null });
        }
        if (table === "orb_node_history") {
          history.push(o.p);
          return res({ data: null, error: null });
        }
        if (o.op === "insert") return res({ data: { id: "new" }, error: null });
        return res({ data: null, error: null });
      },
    };
    return b;
  };
  return { db: { from } as any, history, log };
}
const node = (id: string, content: string, lifecycle: string, scope = "long_term") => ({
  id,
  content,
  norm_key: normKey(content) || null,
  category: "fact",
  long_term_value: 0.5,
  temporal_scope: scope,
  lifecycle,
  importance: 0.5,
  decay_rate: 0.01,
  activation_count: 2,
  created_at: iso(now - 86_400_000),
  last_accessed_at: iso(now - 60_000),
});
const cand = (value: string, key = "k") => ({
  key,
  value,
  category: "fact",
  relevance: 0.8,
  long_term_value: 0.8,
  confidence: 0.9,
  temporal_scope: "long_term",
  decay_rate: 0.01,
  source_reference: "t",
  action: "create_or_update",
});
function mockModel(values: string[]) {
  const text = JSON.stringify({ candidates: values.map((v, i) => cand(v, `k${i}`)) });
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(
        `data: ${JSON.stringify({ type: "response.completed", response: { output_text: text } })}\n\n`,
        { status: 200 },
      ),
  );
}
/** Gespräch: bodies[0] ist die älteste Nachricht; abwechselnd User/ORB optional. */
function convo(userBodies: string[], withOrb: boolean): Msg[] {
  const out: Msg[] = [];
  let t = now - 10_000_000;
  for (const b of userBodies) {
    out.push({ role: "user", body: b, created_at: iso((t += 1000)) });
    if (withOrb) out.push({ role: "orb", body: "Okay.", created_at: iso((t += 1000)) });
  }
  return out;
}
const signalInWindow = (msgs: Msg[]) => {
  const window = msgs
    .slice()
    .sort((a, c) => c.created_at.localeCompare(a.created_at))
    .slice(0, ANALYSIS_TRANSCRIPT_MESSAGES);
  return userSignalsFrom(window.filter((m) => m.role === "user").map((m) => m.body)).forget;
};

beforeEach(() => {
  process.env["LOVABLE_API_KEY"] = "test";
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("P5-D4 Forget-Signal: Erkennung und Fenster", () => {
  it("Regex: erkannt / nicht erkannt", () => {
    for (const s of [
      "Vergiss X.",
      "vergiss das",
      "Das bitte vergessen bitte",
      "Lösch das",
      "forget it",
    ])
      expect(userSignalsFrom([s]).forget).toBe(true);
    for (const s of [
      "Hallo.",
      "Ich habe es vergessen.",
      "Nicht vergessen!",
      "Vergessen ist menschlich",
    ])
      expect(userSignalsFrom([s]).forget).toBe(false);
  });
  it("Fenster = 24 Nachrichten GESAMT (User+ORB), nicht 24 User-Nachrichten", () => {
    expect(ANALYSIS_TRANSCRIPT_MESSAGES).toBe(24);
    const users = (n: number) => [
      "Vergiss X.",
      ...Array.from({ length: n }, (_, i) => `Hallo ${i}.`),
    ];
    // nur User-Nachrichten
    expect(signalInWindow(convo(users(23), false))).toBe(true); // A: Forget + 23 → Position 24
    expect(signalInWindow(convo(users(24), false))).toBe(false); // B: Forget + 24 → raus
    // mit ORB-Antworten: Forget fällt nach 11 weiteren User-Turns heraus
    expect(signalInWindow(convo(users(11), true))).toBe(true); // 12 Paare = 24 Nachrichten
    expect(signalInWindow(convo(users(12), true))).toBe(false);
    // C: Forget als neueste Nachricht
    expect(
      signalInWindow(
        convo([...Array.from({ length: 30 }, (_, i) => `Hi ${i}.`), "Vergiss X."], true),
      ),
    ).toBe(true);
    // D: älter als 24 → kein Signal, egal wie jung zeitlich
    expect(signalInWindow(convo(users(40), false))).toBe(false);
  });
  it("Signal-Lebensdauer Turn für Turn (mit ORB-Antworten)", () => {
    const life: boolean[] = [];
    const bodies = ["Vergiss X."];
    for (let t = 1; t <= 14; t++) {
      life.push(signalInWindow(convo(bodies, true)));
      bodies.push(t % 2 ? "Hallo." : "Wie geht es dir?");
    }
    process.stdout.write(`LIFE ${life.map((b) => (b ? 1 : 0)).join("")}\n`);
    expect(life.slice(0, 12).every(Boolean)).toBe(true);
    expect(life.slice(12).some(Boolean)).toBe(false);
  });
});

describe("P5-D4 Wiederholte Runs auf denselben Zustand", () => {
  async function runs(startLifecycle: string, n: number, scope = "long_term") {
    const nodes = [node(X, VX, startLifecycle, scope)];
    const msgs = convo(["Vergiss das mit der Grafikkarte."], true);
    const { db, history, log } = statefulDb(nodes, msgs);
    const states: string[] = [];
    for (let i = 0; i < n; i++) {
      mockModel([VX]);
      await analyzeAndPersist(db, "u1");
      states.push(nodes[0].lifecycle);
      vi.restoreAllMocks();
      vi.spyOn(console, "info").mockImplementation(() => {});
    }
    return { states, history, log, node: nodes[0] };
  }
  for (const start of ["active", "weak", "stale", "archived", "forgotten"]) {
    it(`Start ${start}: 4 Runs mit gleichem Forget-Signal`, async () => {
      const r = await runs(start, 4);
      process.stdout.write(
        `RUNS ${start} → ${r.states.join(" → ")} | history=${r.history.map((h) => `${h.reason}:${h.previous_lifecycle}>${h.new_lifecycle}`).join(",")} | writes=${r.log.join(" ")}\n`,
      );
      expect(r.history.length).toBe(4); // jede Ausführung schreibt History
      expect(
        r.history.every((h) => h.reason === "forget" && h.previous_value === h.new_value),
      ).toBe(true);
      expect(r.node.content).toBe(VX); // content nie verändert
      expect(r.node.activation_count).toBe(2); // activation nie verändert
    });
  }
  it("persistent: Lifecycle-Pass setzt WEAKEN im Folgelauf zurück", async () => {
    const r = await runs("active", 3, "persistent");
    process.stdout.write(`RUNS persistent → ${r.states.join(" → ")}\n`);
    expect(r.history.length).toBe(3);
  });
});

describe("P5-D4 Mehrere Signale / fremde Treffer / Parallel", () => {
  it("Forget X + Kandidat Y → Y wird ebenfalls geschwächt (keine Signal-Kandidat-Bindung)", async () => {
    const nodes = [node(X, VX, "active"), node(Y, VY, "active")];
    const { db, history } = statefulDb(nodes, convo(["Vergiss das mit der Grafikkarte."], true));
    mockModel([VY]);
    await analyzeAndPersist(db, "u1");
    expect(nodes.find((n) => n.id === Y)!.lifecycle).toBe("weak");
    expect(nodes.find((n) => n.id === X)!.lifecycle).toBe("active");
    expect(history.map((h) => h.node_id)).toEqual([Y]);
    expect(history[0].metadata).toEqual({ requested_by_user: true }); // keine Signal-/Turn-Referenz
  });
  it("Zwei Signale (X, Y) → ein einziges globales Boolean; beide Treffer geschwächt", async () => {
    expect(userSignalsFrom(["Vergiss X.", "Hallo", "Vergiss Y."])).toMatchObject({ forget: true });
    const nodes = [node(X, VX, "active"), node(Y, VY, "active")];
    const { db, history } = statefulDb(nodes, convo(["Vergiss X.", "Vergiss Y."], true));
    mockModel([VX, VY]);
    await analyzeAndPersist(db, "u1");
    expect(nodes.map((n) => n.lifecycle)).toEqual(["weak", "weak"]);
    expect(history.length).toBe(2);
  });
  it("Zwei Kandidaten mit demselben Treffer in EINEM Run → 2 Updates auf gleichen Zielwert, 2 History", async () => {
    const nodes = [node(X, VX, "active")];
    const { db, history, log } = statefulDb(nodes, convo(["Vergiss das."], true));
    mockModel([VX, "Der Benutzer hat eine RTX 5070 Grafikkarte im PC."]);
    await analyzeAndPersist(db, "u1");
    process.stdout.write(`SAMERUN ${log.join(" ")}\n`);
    expect(history.filter((h) => h.node_id === X).length).toBe(2);
    expect(nodes[0].lifecycle).toBe("weak"); // beide rechnen vom geladenen 'active' aus
  });
  it("Parallel: zwei Runs lesen denselben Stand → beide schreiben, gleicher Zielwert, doppelte History", async () => {
    const nodes = [node(X, VX, "active")];
    const { db, history } = statefulDb(nodes, convo(["Vergiss das."], true));
    mockModel([VX]);
    await Promise.all([analyzeAndPersist(db, "u1"), analyzeAndPersist(db, "u1")]);
    expect(history.filter((h) => h.reason === "forget").length).toBe(2);
    expect(
      history.every((h) => h.previous_lifecycle === "active" && h.new_lifecycle === "weak"),
    ).toBe(true);
    expect(nodes[0].lifecycle).toBe("weak");
  });
});
