import { it, vi } from "vitest";
import { processInput, askProactively } from "@/orb-core/engine.server";
import { createFakeDb, type FakeCall, type FakeDb, type FakeResponse } from "./helpers/fake-supabase";

const USER = "11111111-1111-4111-8111-111111111111";
const NOW = new Date().toISOString();
const baseState = {
  id: "s", user_id: USER, curiosity: 0.8, joy: 0.5, fear: 0.05, trust: 0.6,
  uncertainty: 0.3, energy: 0.95, cracks: 0, reactivation_count: 0,
  goals: ["help_user"], created_at: NOW, updated_at: NOW,
};
const node = (i: number) => ({
  id: `n${i}`, user_id: USER, text: `Ich war im Urlaub in Griechenland ${i}.`,
  norm_key: `urlaub${i}`, type: "statement", topic: "reisen", importance: 0.8,
  confidence: 0.5, activation_count: 2, lifecycle: "active", source: "user",
  temporal_scope: "past", reliability: 0.8, last_seen_at: NOW, created_at: NOW,
  updated_at: NOW, decay: 0, embedding: null,
});

function db(opts: { nodes?: number; energy?: number } = {}): FakeDb {
  const state = { ...baseState, energy: opts.energy ?? 0.95 };
  const nodes = Array.from({ length: opts.nodes ?? 0 }, (_, i) => node(i));
  return createFakeDb((c: FakeCall): FakeResponse => {
    if (c.table === "orb_state") return { data: state };
    if (c.table === "orb_nodes") {
      if (c.action === "insert") return { data: { id: "n-new" } };
      if (c.action === "select") return { data: c.single ? null : nodes };
      return { data: null };
    }
    if (c.action === "select") return { data: c.single ? null : [] };
    return { data: c.single ? { id: `${c.table}-x` } : null };
  });
}

function stub(status = 200, text = "Kurze Antwort.") {
  process.env["LOVABLE_API_KEY"] = "stub";
  vi.stubGlobal("fetch", async () => new Response(
    status === 200
      ? `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}\n\n`
      : null,
    { status, headers: new Headers({ "X-Lovable-AIG-Run-ID": "run-stub" }) },
  ));
}

type Row = { scenario: string; event: string; path: string; calls: number; ok: number; db: number; outcome: string };

it("P4 Messung", async () => {
  const rows: Row[] = [];
  const modelCalls: Record<string, unknown>[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((t: unknown, p?: unknown) => {
    if (typeof t === "string" && typeof p === "string") {
      if (t === "[orb.obs.model_call]") modelCalls.push(JSON.parse(p));
      if (t === "[orb.obs.event]") {
        const e = JSON.parse(p) as Record<string, unknown>;
        rows.push({
          scenario: current, event: String(e["event_id"]).slice(4, 12),
          path: String(e["path"]), calls: Number(e["model_calls"]),
          ok: modelCalls.filter((m) => m["event_id"] === e["event_id"] && m["success"] === true).length,
          db: Number(e["db_queries"]), outcome: String(e["outcome"]),
        });
      }
    }
  });
  let current = "";

  current = "A Nachricht, Sprachschicht ohne Zugang";
  process.env["LOVABLE_API_KEY"] = ""; process.env["OPENAI_API_KEY"] = "";
  await processInput(db(), USER, "Guten Morgen.");

  current = "B Nachricht, Modell per Attrappe";
  stub();
  await processInput(db(), USER, "Guten Morgen.");

  current = "C Nachricht mit 12 Erinnerungen";
  stub();
  await processInput(db({ nodes: 12 }), USER, "Erzähl mir von meinem Urlaub.");

  current = "D Nachricht, Modellfehler 500";
  stub(500);
  await processInput(db(), USER, "Guten Morgen.");

  current = "E Nachricht, Guthabensperre 402";
  stub(402);
  await processInput(db(), USER, "Guten Morgen.");

  current = "F Nachricht, wenig Energie (0.05)";
  stub();
  await processInput(db({ energy: 0.05 }), USER, "Guten Morgen.");

  current = "G Autonome Frage, leerer Graph";
  stub();
  await askProactively(db(), USER, {});

  current = "H Autonome Frage, 12 Erinnerungen";
  stub();
  await askProactively(db({ nodes: 12 }), USER, {});

  current = "I Autonome Frage, wenig Energie";
  stub();
  await askProactively(db({ nodes: 12, energy: 0.05 }), USER, {});

  spy.mockRestore(); vi.unstubAllGlobals();

  console.log("\n| Szenario | Event | Pfad | Model Calls | davon erfolgreich | DB Requests | Ergebnis |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) console.log(`| ${r.scenario} | …${r.event} | ${r.path} | ${r.calls} | ${r.ok} | ${r.db} | ${r.outcome} |`);
  console.log("\n| Event | Seq | Model | Source | Call Type | Success | HTTP | Fehlerart | ms |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const m of modelCalls) console.log(`| …${String(m["event_id"]).slice(4,12)} | ${m["call_index"]} | ${m["model"]} | ${m["source"]} | ${m["call_type"]} | ${m["success"]} | ${m["http_status"]} | ${m["failure_kind"]} | ${m["duration_ms"]} |`);
  console.log(`\nSUMME events=${rows.length} model_calls=${modelCalls.length}`);
}, 120000);
