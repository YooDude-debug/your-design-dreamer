/**
 * ORB CORE – P5 DB-FORENSIK (temporäres Messwerkzeug, READ-ONLY gegenüber Produktion).
 *
 * Es wird KEINE Produktionsdatenbank und KEIN echtes Modell berührt:
 *  - Datenzugriff über eine protokollierende Attrappe (`tests/helpers/fake-supabase`),
 *  - Sprachschicht über eine Attrappe für `fetch` (keine Credits).
 *
 * Zweck: jede einzelne Datenbankabfrage eines Verarbeitungsvorgangs in ihrer
 * tatsächlichen Reihenfolge sichtbar machen. Keine ORB-Logik wird verändert.
 */

import { createFakeDb, type FakeCall } from "../tests/helpers/fake-supabase";
import { processInput, askProactively } from "../src/orb-core/engine.server";

type Mode = "ok" | "http500" | "quota402";

function installFetchStub(mode: Mode, reply = "Verstanden, ich habe das gespeichert."): void {
  process.env["LOVABLE_API_KEY"] = "stub-key-not-real";
  delete process.env["OPENAI_API_KEY"];
  (globalThis as unknown as { fetch: unknown }).fetch = async () => {
    if (mode === "quota402") return new Response("", { status: 402 });
    if (mode === "http500") return new Response("", { status: 500 });
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        const enc = new TextEncoder();
        c.enqueue(
          enc.encode(
            `data: ${JSON.stringify({ type: "response.output_text.delta", delta: reply })}\n\n`,
          ),
        );
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      },
    });
    return new Response(body, { status: 200 });
  };
}

const USER = "11111111-1111-4111-8111-111111111111";
const ISO = (ms: number) => new Date(ms).toISOString();

type Seed = {
  nodes: number;
  /** Erinnerung, die den genauen Schlüsseltreffer (`norm_key`) liefert. */
  exactKey?: string | null;
  connections: number;
  messages: { role: string; body: string }[];
  interests: number;
  threads: number;
  questions: { open: boolean };
  energy: number;
  style: boolean;
};

function stateRow(energy: number) {
  return {
    user_id: USER,
    curiosity: 0.7,
    joy: 0.5,
    fear: 0.2,
    trust: 0.6,
    uncertainty: 0.3,
    energy,
    goals: ["help_user"],
    cracks: 1,
    reactivation_count: 10,
    decay_computations: 100,
    updated_at: ISO(Date.now() - 60_000),
    created_at: ISO(Date.now() - 10 * 86_400_000),
  };
}

function nodeRows(seed: Seed) {
  const now = Date.now();
  const topics = ["hardware", "arbeit", "essen", "projekte", "alter", "reisen"];
  const rows = Array.from({ length: seed.nodes }, (_, i) => ({
    id: `node-${i + 1}`,
    user_id: USER,
    type: "memory",
    content: i === 0 ? "Ich bin 36 Jahre alt und arbeite an y-dude." : `Erinnerung ${i + 1} Kaffee`,
    importance: 0.6 + (i % 4) * 0.05,
    confidence: 0.7,
    source: "user_stated",
    topic: topics[i % topics.length],
    norm_key: i === 0 ? (seed.exactKey ?? `key-${i + 1}`) : `key-${i + 1}`,
    activation_count: 2 + i,
    last_accessed_at: ISO(now - i * 3_600_000),
    created_at: ISO(now - (i + 1) * 86_400_000),
    metadata: {},
    lifecycle: "active",
    long_term_value: 0.5,
    temporal_scope: "stable",
    category: null,
  }));
  return rows;
}

function connRows(seed: Seed) {
  const now = Date.now();
  return Array.from({ length: seed.connections }, (_, i) => ({
    id: `conn-${i + 1}`,
    user_id: USER,
    source_node_id: `node-${(i % Math.max(1, seed.nodes)) + 1}`,
    target_node_id: `node-${((i + 1) % Math.max(1, seed.nodes)) + 1}`,
    weight: 0.5,
    importance: 0.6,
    decay_rate: 0.05,
    activation_count: 3,
    last_activated_at: ISO(now - i * 7_200_000),
    metadata: {},
    created_at: ISO(now - 86_400_000),
  }));
}

function threadRows(seed: Seed) {
  const now = Date.now();
  return Array.from({ length: seed.threads }, (_, i) => ({
    id: `thread-${i + 1}`,
    user_id: USER,
    title: `Faden ${i + 1} Kaffee`,
    topic: "essen",
    status: "OPEN",
    known: [`Teil ${i}`],
    unknown: ["offene Stelle"],
    node_ids: [`node-${i + 1}`],
    importance: 0.6,
    activation_count: 2,
    last_activation_at: ISO(now - i * 3_600_000),
    opened_at: ISO(now - 86_400_000),
    resolved_at: null,
    paused_at: null,
    last_resume_at: null,
    created_at: ISO(now - 86_400_000),
    updated_at: ISO(now - 3_600_000),
  }));
}

function questionRows(open: boolean) {
  const now = Date.now();
  return [
    {
      id: "q-1",
      user_id: USER,
      question: "Welche Grafikkarte nutzt du?",
      topic: "hardware",
      knowledge_gap: "unbekannt",
      gap_kind: "detail",
      source_memory_ids: ["node-1"],
      score: 0.6,
      reason: "Neugier",
      asked_at: ISO(now - 5 * 60_000),
      answered: !open,
      answer_received: null,
      answered_at: null,
      created_at: ISO(now - 5 * 60_000),
    },
  ];
}

function buildDb(seed: Seed) {
  const nodes = nodeRows(seed);
  const conns = connRows(seed);
  const threads = threadRows(seed);
  const interests = Array.from({ length: seed.interests }, (_, i) => ({
    id: `int-${i + 1}`,
    user_id: USER,
    topic: ["hardware", "essen", "arbeit", "reisen"][i % 4],
    weight: 0.6,
    confidence: 0.6,
    source: "user_stated",
    activation_count: 3,
    last_activated_at: ISO(Date.now() - 3_600_000),
    created_at: ISO(Date.now() - 86_400_000),
  }));
  const questions = questionRows(seed.questions.open);

  return createFakeDb((call: FakeCall) => {
    const has = (col: string) => call.filters.some((f) => f.column === col);
    if (call.action !== "select") {
      // Schreibvorgänge liefern, was der Aufrufer erwartet (id), sonst nichts.
      return { data: call.single ? { id: `new-${call.table}` } : null, error: null };
    }
    switch (call.table) {
      case "orb_state":
        return { data: stateRow(seed.energy), error: null };
      case "orb_nodes": {
        if (has("norm_key")) {
          const key = call.filters.find((f) => f.column === "norm_key")?.value;
          const hit = nodes.filter((n) => n.norm_key === key);
          return { data: call.single ? (hit[0] ?? null) : hit, error: null };
        }
        if (has("type")) return { data: call.single ? null : [], error: null };
        if (has("id")) {
          const id = call.filters.find((f) => f.column === "id")?.value;
          const hit = nodes.find((n) => n.id === id) ?? null;
          return { data: call.single ? hit : hit ? [hit] : [], error: null };
        }
        return { data: call.single ? (nodes[0] ?? null) : nodes, error: null };
      }
      case "orb_connections":
        return { data: call.single ? null : conns, error: null };
      case "orb_messages":
        return { data: seed.messages, error: null };
      case "orb_interests": {
        if (has("topic")) {
          const t = call.filters.find((f) => f.column === "topic")?.value;
          const hit = interests.find((i) => i.topic === t) ?? null;
          return { data: call.single ? hit : hit ? [hit] : [], error: null };
        }
        return { data: call.single ? null : interests, error: null };
      }
      case "orb_suggestions":
        return { data: [], error: null };
      case "orb_threads":
        return { data: call.single ? (threads[0] ?? null) : threads, error: null };
      case "orb_style":
        return {
          data: seed.style
            ? {
                user_id: USER,
                messages: 20,
                total_length: 1200,
                emoji_messages: 2,
                question_messages: 6,
                casual_messages: 9,
                formal_messages: 1,
                technical_messages: 4,
                updated_at: ISO(Date.now() - 3_600_000),
              }
            : null,
          error: null,
        };
      case "orb_questions": {
        // Filter „answered = false" wird bewusst nachgebildet, damit die
        // Attrappe keinen Antwortpfad erzeugt, den es real nicht gäbe.
        const wantsOpen = call.filters.some((f) => f.column === "answered" && f.value === false);
        const rows = wantsOpen ? questions.filter((r) => r.answered === false) : questions;
        return { data: call.single ? (rows[0] ?? null) : rows, error: null };
      }
      default:
        return { data: call.single ? null : [], error: null };
    }
  });
}

const defaultSeed: Seed = {
  nodes: 12,
  exactKey: null,
  connections: 10,
  messages: [
    { role: "user", body: "Hallo, ich trinke gerne Kaffee." },
    { role: "orb", body: "Das merke ich mir." },
  ],
  interests: 4,
  threads: 3,
  questions: { open: false },
  energy: 0.6,
  style: true,
};

function describe(call: FakeCall): string {
  const f = call.filters
    .map((x) =>
      x.column
        ? `${x.op}(${x.column}${x.value !== undefined && typeof x.value !== "object" ? `=${String(x.value).slice(0, 24)}` : ""})`
        : `${x.op}${x.value !== undefined && typeof x.value !== "object" ? `=${String(x.value).slice(0, 40)}` : ""}`,
    )
    .join(" ");
  return `${call.table} ${call.action.toUpperCase()}${call.single ? " single" : ""} | ${f}`;
}

type Case = {
  name: string;
  mode: Mode;
  seed: Partial<Seed>;
  text?: string;
  proactive?: boolean;
};

const cases: Case[] = [
  { name: "A normale Nachricht, leeres Gedächtnis", mode: "ok", seed: { nodes: 0, connections: 0, threads: 0, interests: 0 }, text: "Ich habe heute einen neuen Kaffee probiert." },
  { name: "B Nachricht mit 12 Erinnerungen", mode: "ok", seed: {}, text: "Wie alt bin ich eigentlich?" },
  { name: "B2 Nachricht mit exaktem Schlüsseltreffer", mode: "ok", seed: { exactKey: null }, text: "Ich bin 36 Jahre alt und arbeite an y-dude." },
  { name: "C Modellfehler 500", mode: "http500", seed: {}, text: "Ich habe heute einen neuen Kaffee probiert." },
  { name: "D Guthabensperre 402", mode: "quota402", seed: {}, text: "Ich habe heute einen neuen Kaffee probiert." },
  { name: "E wenig Energie (0,05)", mode: "ok", seed: { energy: 0.05 }, text: "Ich habe heute einen neuen Kaffee probiert." },
  { name: "F Antwort auf offene eigene Frage", mode: "ok", seed: { questions: { open: true } }, text: "Ich nutze eine RTX 5070." },
  { name: "G Aufforderung „frag mich“", mode: "ok", seed: {}, text: "Frag mich etwas." },
  { name: "H Handlungsabsicht (Prozesskontext)", mode: "ok", seed: {}, text: "Ich möchte jetzt die Migration deployen." },
  { name: "I Korrektur („war ein Tippfehler“)", mode: "ok", seed: {}, text: "Kaffee war ein Tippfehler." },
  { name: "J grosses Gedächtnis (40 Knoten, 60 Verbindungen)", mode: "ok", seed: { nodes: 40, connections: 60, threads: 12 }, text: "Erinnerung 3 Kaffee" },
  { name: "K autonome Frage", mode: "ok", seed: {}, proactive: true },
  { name: "L autonome Frage, wenig Energie", mode: "ok", seed: { energy: 0.05 }, proactive: true },
];

async function main() {
  for (const c of cases) {
    installFetchStub(c.mode);
    const seed: Seed = { ...defaultSeed, ...c.seed };
    const db = buildDb(seed);
    let outcome = "";
    try {
      if (c.proactive) {
        const r = await askProactively(db as never, USER);
        outcome = `asked=${r.asked} action=${r.action} dbQueries=${r.perf?.dbQueries ?? "-"}`;
      } else {
        const r = await processInput(db as never, USER, c.text!);
        outcome = `decision=${r.decision} aiStatus=${r.aiStatus} dbQueries=${r.perf.dbQueries}`;
      }
    } catch (e) {
      outcome = `FEHLER: ${(e as Error).message}`;
    }
    const reads = db.calls.filter((x) => x.action === "select").length;
    const writes = db.calls.length - reads;
    console.log(`\n===== ${c.name}`);
    console.log(`Ergebnis: ${outcome}`);
    console.log(`Aufrufe insgesamt: ${db.calls.length} (Reads ${reads} / Writes ${writes}), RPCs ${db.rpcs.length}`);
    db.calls.forEach((call, i) => console.log(`${String(i + 1).padStart(3, " ")}. ${describe(call)}`));
  }
}

await main();
