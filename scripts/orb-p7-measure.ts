/**
 * TEMPORÄRES Messwerkzeug für ORB P7 (read-only Forensik).
 *
 * Kein Produktionscode: die Datei wird nach der Messung wieder entfernt.
 * Es wird ausschliesslich der Attrappen-Datenbankclient benutzt (kein Zugriff
 * auf die echte Datenbank) und ohne Modellschlüssel gearbeitet (kein AI-Aufruf,
 * keine Credits).
 *
 * Ausführung:  bun run scripts/orb-p7-measure.ts
 */
import { getSnapshot, processInput } from "../src/orb-core/engine.server";
import { normKey } from "../src/orb-core/memory";
import { createFakeDb, type FakeCall, type FakeDb } from "../tests/helpers/fake-supabase";

const USER = "11111111-1111-4111-8111-111111111111";
const NOW = new Date().toISOString();

const stateRow = {
  id: "state-1",
  user_id: USER,
  curiosity: 0.6,
  joy: 0.5,
  fear: 0.08,
  trust: 0.4,
  uncertainty: 0.3,
  energy: 0.9,
  cracks: 0,
  reactivation_count: 0,
  decay_computations: 0,
  goals: ["help_user"],
  created_at: NOW,
  updated_at: NOW,
};

function nodeRow(i: number, content: string, topic = "hardware") {
  return {
    id: `node-${i}`,
    user_id: USER,
    type: "memory",
    content,
    importance: 0.6,
    confidence: 0.7,
    source: "user_stated",
    topic,
    norm_key: normKey(content),
    activation_count: 3,
    last_accessed_at: NOW,
    created_at: NOW,
    metadata: {},
  };
}

function connRow(i: number, source: string, target: string) {
  return {
    id: `conn-${i}`,
    user_id: USER,
    source_node_id: source,
    target_node_id: target,
    weight: 0.5,
    importance: 0.5,
    decay_rate: 0.01,
    last_activated_at: NOW,
    activation_count: 1,
    created_at: NOW,
    metadata: {},
  };
}

function threadRow(i: number) {
  return {
    id: `thread-${i}`,
    user_id: USER,
    topic: `thema-${i}`,
    title: `Faden ${i}`,
    status: "open",
    strength: 0.5,
    importance: 0.5,
    activation_count: 1,
    last_activation_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    metadata: {},
    summary: null,
    open_question: null,
    resolved_at: null,
    paused_at: null,
  };
}

type Fixture = {
  nodes: Record<string, unknown>[];
  conns: Record<string, unknown>[];
  threads: Record<string, unknown>[];
};

function db(f: Fixture): FakeDb {
  return createFakeDb((call: FakeCall) => {
    if (call.table === "orb_state") return { data: stateRow };
    if (call.table === "orb_nodes") {
      if (call.action === "insert") return { data: { id: "node-new" } };
      if (call.action === "select") return { data: call.single ? (f.nodes[0] ?? null) : f.nodes };
      return { data: null };
    }
    if (call.table === "orb_connections" && call.action === "select") {
      return { data: call.single ? null : f.conns };
    }
    if (call.table === "orb_threads" && call.action === "select") {
      return { data: call.single ? null : f.threads };
    }
    if (call.table === "orb_style") return { data: null };
    if (call.action === "select") return { data: call.single ? null : [] };
    return { data: call.single ? { id: `${call.table}-new` } : null };
  });
}

function stats(d: FakeDb) {
  const reads = d.calls.filter((c) => c.action === "select").length;
  const writes = d.calls.length - reads;
  return {
    total: d.calls.length,
    reads,
    writes,
    rpcs: d.rpcs.length,
    snapshots: d.callsOn("orb_suggestions", "select").length / 2,
    suggestionReads: d.callsOn("orb_suggestions", "select").length,
    nodeUpdates: d.callsOn("orb_nodes", "update").length,
    connWrites: d.calls.filter((c) => c.table === "orb_connections" && c.action !== "select").length,
    threadWrites: d.calls.filter((c) => c.table === "orb_threads" && c.action !== "select").length,
    reported:
      ((d.callsOn("orb_metrics", "insert")[0]?.payload as { db_queries?: number } | undefined)
        ?.db_queries ?? null),
  };
}

function line(name: string, s: ReturnType<typeof stats>) {
  console.log(
    `${name.padEnd(34)} total=${String(s.total).padStart(3)} reads=${String(s.reads).padStart(3)} writes=${String(s.writes).padStart(3)} snap=${String(s.snapshots).padStart(2)} nodeUpd=${String(s.nodeUpdates).padStart(2)} connW=${String(s.connWrites).padStart(2)} thrW=${String(s.threadWrites).padStart(2)} gemeldet=${s.reported ?? "-"}`,
  );
}

const MEM_TEXTS = [
  "Mein Rechner hat eine RTX 5070.",
  "Meine Tastatur ist eine RTX-Tastatur.",
  "Mein Monitor laeuft mit RTX-Technik.",
  "Mein Notebook nutzt RTX-Grafik.",
  "Mein Gehaeuse ist fuer RTX gebaut.",
  "Mein Netzteil ist fuer RTX ausgelegt.",
];

async function main() {
  console.log("=== P7 MESSUNG (Attrappe, kein AI-Aufruf) ===\n");

  // 1) Momentaufnahme allein.
  {
    const d = db({ nodes: [nodeRow(1, MEM_TEXTS[0]!)], conns: [], threads: [] });
    await getSnapshot(d, USER);
    line("Momentaufnahme allein (0 Verb.)", stats(d));
    console.log("   Reihenfolge:", d.calls.map((c) => `${c.table}.${c.action}`).join(" > "));
  }
  {
    const d = db({
      nodes: [nodeRow(1, MEM_TEXTS[0]!), nodeRow(2, MEM_TEXTS[1]!)],
      conns: [connRow(1, "node-1", "node-2")],
      threads: [threadRow(1)],
    });
    await getSnapshot(d, USER);
    line("Momentaufnahme (1 Verbindung)", stats(d));
    console.log("   Reihenfolge:", d.calls.map((c) => `${c.table}.${c.action}`).join(" > "));
  }

  // 2) Normale Nachricht.
  {
    const d = db({ nodes: [], conns: [], threads: [] });
    await processInput(d, USER, "Guten Morgen, wie geht es dir heute?");
    line("normale Nachricht (leer)", stats(d));
    console.log("   Reihenfolge:", d.calls.map((c) => `${c.table}.${c.action}`).join(" > "));
  }
  {
    const nodes = MEM_TEXTS.slice(0, 4).map((t, i) => nodeRow(i + 1, t));
    const d = db({ nodes, conns: [connRow(1, "node-1", "node-2")], threads: [threadRow(1)] });
    await processInput(d, USER, "Mein Rechner hat eine RTX 5070.");
    line("normale Nachricht (4 Erinnerungen)", stats(d));
  }
  {
    const nodes = MEM_TEXTS.map((t, i) => nodeRow(i + 1, t));
    const conns = Array.from({ length: 12 }, (_, i) =>
      connRow(i + 1, `node-${(i % 5) + 1}`, `node-${(i % 4) + 2}`),
    );
    const threads = Array.from({ length: 10 }, (_, i) => threadRow(i + 1));
    const d = db({ nodes, conns, threads });
    await processInput(d, USER, "Wichtig: mein neues RTX-Setup laeuft jetzt komplett stabil.");
    line("mengenstark (6/12/10)", stats(d));
    const byTable = new Map<string, number>();
    for (const c of d.calls) {
      const k = `${c.table}.${c.action}`;
      byTable.set(k, (byTable.get(k) ?? 0) + 1);
    }
    console.log(
      "   Verteilung:",
      [...byTable.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(" "),
    );
  }

  // 3) Korrekturpfad (P6-Baseline) mit 0/1/2/4 betroffenen Erinnerungen.
  for (const n of [0, 1, 2, 4]) {
    const nodes = MEM_TEXTS.slice(0, Math.max(n, 1)).map((t, i) => nodeRow(i + 1, t));
    const d = db({ nodes: n === 0 ? [] : nodes, conns: [], threads: [] });
    await processInput(d, USER, "Das mit der RTX war ein Tippfehler.");
    line(`Korrektur, ${n} Erinnerungen`, stats(d));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/** Zusatzmessung: Mengen-Skalierung (Suche nach 40/43-Bereich). */
export async function sweep() {
  console.log("\n=== Mengen-Skalierung ===");
  for (const n of [1, 2, 4, 6, 8, 12]) {
    const nodes = Array.from({ length: n }, (_, i) =>
      nodeRow(i + 1, `Mein RTX-Gerät Nummer ${i + 1} laeuft im Rechner.`),
    );
    const conns = Array.from({ length: n * 2 }, (_, i) =>
      connRow(i + 1, `node-${(i % n) + 1}`, `node-${((i + 1) % n) + 1}`),
    );
    const threads = Array.from({ length: Math.min(n, 12) }, (_, i) => threadRow(i + 1));
    const d = db({ nodes, conns, threads });
    await processInput(d, USER, "Wichtig: mein RTX-Gerät im Rechner laeuft jetzt stabil.");
    line(`Knoten=${n} Verb.=${n * 2} Fäden=${threads.length}`, stats(d));
  }
}
