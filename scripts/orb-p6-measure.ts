/**
 * ORB CORE – P6 Messung des Korrekturpfads (temporäres Werkzeug).
 *
 * Keine Produktionsdatenbank, kein echtes Modell: Datenzugriff über eine
 * protokollierende Attrappe, Sprachschicht über eine `fetch`-Attrappe.
 * Gemessen wird ausschliesslich der Korrekturpfad („… war ein Tippfehler“)
 * mit 1, 2 und mehreren betroffenen Erinnerungen.
 */

import { createFakeDb, type FakeCall } from "../tests/helpers/fake-supabase";
import { processInput } from "../src/orb-core/engine.server";

const USER = "11111111-1111-4111-8111-111111111111";
const ISO = (ms: number) => new Date(ms).toISOString();

process.env["LOVABLE_API_KEY"] = "stub-key-not-real";
delete process.env["OPENAI_API_KEY"];
(globalThis as unknown as { fetch: unknown }).fetch = async () => {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      c.enqueue(
        enc.encode(
          `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Alles klar." })}\n\n`,
        ),
      );
      c.close();
    },
  });
  return new Response(body, { status: 200 });
};

function buildDb(affected: number, totalNodes = 12, totalConns = 10) {
  const now = Date.now();
  const nodes = Array.from({ length: totalNodes }, (_, i) => ({
    id: `node-${i + 1}`,
    user_id: USER,
    type: "memory",
    content: i < affected ? `Ich trinke Kaffee Variante ${i + 1}.` : `Notiz ${i + 1} ohne Getränk.`,
    importance: 0.9 - i * 0.01,
    confidence: 0.7,
    source: "user_stated",
    topic: ["essen", "arbeit", "reisen", "projekte"][i % 4],
    norm_key: `key-${i + 1}`,
    activation_count: 2 + i,
    last_accessed_at: ISO(now - i * 3_600_000),
    created_at: ISO(now - (i + 1) * 86_400_000),
    metadata: {},
    lifecycle: "active",
    long_term_value: 0.5,
    temporal_scope: "stable",
    category: null,
  }));
  const conns = Array.from({ length: totalConns }, (_, i) => ({
    id: `conn-${i + 1}`,
    user_id: USER,
    source_node_id: `node-${(i % totalNodes) + 1}`,
    target_node_id: `node-${((i + 1) % totalNodes) + 1}`,
    weight: 0.5,
    importance: 0.6,
    decay_rate: 0.05,
    activation_count: 3,
    last_activated_at: ISO(now - i * 7_200_000),
    metadata: {},
    created_at: ISO(now - 86_400_000),
  }));
  const interests = ["essen", "arbeit", "reisen", "projekte"].map((topic, i) => ({
    id: `int-${i + 1}`,
    user_id: USER,
    topic,
    weight: 0.6,
    confidence: 0.6,
    source: "user_stated",
    activation_count: 3,
    last_activated_at: ISO(now - 3_600_000),
    created_at: ISO(now - 86_400_000),
  }));
  const threads = [
    {
      id: "thread-1",
      user_id: USER,
      title: "Faden Kaffee",
      topic: "essen",
      status: "OPEN",
      known: ["Teil"],
      unknown: ["offen"],
      node_ids: ["node-1"],
      importance: 0.6,
      activation_count: 2,
      last_activation_at: ISO(now - 3_600_000),
      opened_at: ISO(now - 86_400_000),
      resolved_at: null,
      paused_at: null,
      last_resume_at: null,
      created_at: ISO(now - 86_400_000),
      updated_at: ISO(now - 3_600_000),
    },
  ];

  return createFakeDb((call: FakeCall) => {
    const has = (col: string) => call.filters.some((f) => f.column === col);
    const val = (col: string) => call.filters.find((f) => f.column === col)?.value;
    if (call.action !== "select") {
      return { data: call.single ? { id: `new-${call.table}` } : null, error: null };
    }
    switch (call.table) {
      case "orb_state":
        return {
          data: {
            user_id: USER,
            curiosity: 0.7,
            joy: 0.5,
            fear: 0.2,
            trust: 0.6,
            uncertainty: 0.3,
            energy: 0.6,
            goals: ["help_user"],
            cracks: 1,
            reactivation_count: 10,
            decay_computations: 100,
            updated_at: ISO(now - 60_000),
            created_at: ISO(now - 10 * 86_400_000),
          },
          error: null,
        };
      case "orb_nodes": {
        if (has("norm_key")) return { data: call.single ? null : [], error: null };
        if (has("id")) {
          const hit = nodes.find((n) => n.id === val("id")) ?? null;
          return { data: call.single ? hit : hit ? [hit] : [], error: null };
        }
        return { data: call.single ? (nodes[0] ?? null) : nodes, error: null };
      }
      case "orb_connections":
        return { data: call.single ? null : conns, error: null };
      case "orb_messages":
        return {
          data: [
            { role: "user", body: "Ich trinke Kaffee." },
            { role: "orb", body: "Notiert." },
          ],
          error: null,
        };
      case "orb_interests": {
        if (has("topic")) {
          const hit = interests.find((i) => i.topic === val("topic")) ?? null;
          return { data: call.single ? hit : hit ? [hit] : [], error: null };
        }
        return { data: call.single ? null : interests, error: null };
      }
      case "orb_threads":
        return { data: call.single ? (threads[0] ?? null) : threads, error: null };
      case "orb_style":
        return {
          data: {
            user_id: USER,
            messages: 20,
            total_length: 1200,
            emoji_messages: 2,
            question_messages: 6,
            casual_messages: 9,
            formal_messages: 1,
            technical_messages: 4,
            updated_at: ISO(now - 3_600_000),
          },
          error: null,
        };
      case "orb_questions": {
        const wantsOpen = call.filters.some((f) => f.column === "answered" && f.value === false);
        return { data: wantsOpen ? null : [], error: null };
      }
      default:
        return { data: call.single ? null : [], error: null };
    }
  });
}

/** Erkennt eine Momentaufnahme an ihrer festen Abfragefolge. */
function countSnapshots(calls: FakeCall[]): number {
  let n = 0;
  for (let i = 0; i < calls.length; i += 1) {
    const c = calls[i]!;
    if (
      c.table === "orb_suggestions" &&
      c.action === "select" &&
      calls[i + 1]?.table === "orb_suggestions"
    ) {
      n += 1;
    }
  }
  return n;
}

const cases = [
  { name: "Korrektur, 1 betroffene Erinnerung", affected: 1, text: "Kaffee war ein Tippfehler." },
  { name: "Korrektur, 2 betroffene Erinnerungen", affected: 2, text: "Kaffee war ein Tippfehler." },
  { name: "Korrektur, 6 betroffene Erinnerungen", affected: 6, text: "Kaffee war ein Tippfehler." },
  { name: "Korrektur ohne betroffene Erinnerung", affected: 0, text: "Kaffee war ein Tippfehler." },
  { name: "normale Nachricht (Gegenprobe)", affected: 6, text: "Heute war das Wetter schoen." },
];

for (const c of cases) {
  const db = buildDb(c.affected);
  const r = await processInput(db as never, USER, c.text);
  const reads = db.calls.filter((x) => x.action === "select").length;
  const snaps = countSnapshots(db.calls);
  const affectedWrites = db.calls.filter(
    (x) => x.table === "orb_nodes" && x.action === "update",
  ).length;
  console.log(
    `${c.name}: total=${db.calls.length} reads=${reads} writes=${db.calls.length - reads} ` +
      `snapshots=${snaps} nodeUpdates=${affectedWrites} decision=${r.decision} ` +
      `dbQueries=${r.perf.dbQueries} reply=${r.reply.slice(0, 24)}`,
  );
}
