/**
 * ORB Request Optimization P1 – Messung und Regressionsschutz.
 *
 * Gemessen wird mit einem protokollierenden Datenbank-Ersatz: jeder Aufruf
 * wird gezählt, ohne die Produktionsdatenbank zu berühren. Ohne Schlüssel
 * findet kein Modellaufruf statt (Sprachschicht fällt auf „unavailable"),
 * daher entstehen keine Credits.
 *
 * Geprüft wird:
 *  - P1-1: der genaue Treffer wird nur EINMAL geschrieben (der Block „2. Knoten"
 *    überschreibt den Reaktivierungs-Schreibvorgang vollständig),
 *  - P1-2: für einen im selben Vorgang neu eingefügten Fokusknoten entfällt die
 *    Existenzabfrage der Verbindung,
 *  - keine verlorenen Writes: Knoten, Verbindungen, Zustand, Nachrichten und
 *    Messwerte werden weiterhin geschrieben.
 */
import { describe, expect, it } from "vitest";

import { processInput } from "@/orb-core/engine.server";
import { createFakeDb, type FakeCall, type FakeDb, type FakeResponse } from "./helpers/fake-supabase";

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
  goals: ["help_user"],
  created_at: NOW,
  updated_at: NOW,
};

function nodeRow(over: Record<string, unknown> = {}) {
  return {
    id: "node-1",
    user_id: USER,
    type: "memory",
    content: "Ich habe eine RTX 5070 im Rechner.",
    importance: 0.6,
    confidence: 0.7,
    source: "user_stated",
    topic: "hardware",
    norm_key: "rtx 5070 rechner",
    activation_count: 3,
    last_accessed_at: NOW,
    created_at: NOW,
    metadata: {},
    ...over,
  };
}

/** Datenbank-Ersatz mit fester Kandidatenmenge. */
function db(nodes: Record<string, unknown>[]): FakeDb {
  return createFakeDb((call: FakeCall): FakeResponse => {
    if (call.table === "orb_state") {
      return call.action === "select" ? { data: stateRow } : { data: stateRow };
    }
    if (call.table === "orb_nodes") {
      if (call.action === "insert") return { data: { id: "node-new" } };
      if (call.action === "select") return { data: call.single ? (nodes[0] ?? null) : nodes };
      return { data: null };
    }
    if (call.table === "orb_style") return { data: null };
    if (call.action === "select") return { data: call.single ? null : [] };
    return { data: call.single ? { id: `${call.table}-new` } : null };
  }, 30000);
}

const selects = (d: FakeDb, table: string) => d.callsOn(table, "select").length;
const writes = (d: FakeDb, table: string) =>
  d.calls.filter((c) => c.table === table && c.action !== "select").length;

describe("P1: gemessene Datenbankaufrufe eines Zuges", () => {
  it("genauer Treffer wird nur einmal geschrieben (kein doppelter Node-Write)", async () => {
    const d = db([nodeRow()]);
    const turn = await processInput(d, USER, "Ich habe eine RTX 5070 im Rechner.");
    expect(turn.reply.length).toBeGreaterThan(0);

    // Dieselbe Zeile wird nicht zweimal aktualisiert.
    const nodeUpdates = d.calls.filter((c) => c.table === "orb_nodes" && c.action === "update");
    const targeted = nodeUpdates.flatMap((c) =>
      c.filters.filter((f) => f.column === "id").map((f) => String(f.value)),
    );
    expect(new Set(targeted).size).toBe(targeted.length);
    expect(targeted.filter((id) => id === "node-1").length).toBe(1);

    // Reaktivierung bleibt im Zustand erhalten (Zähler unverändert gezählt).
    expect(turn.reactivated).toBe(true);
    expect(writes(d, "orb_state")).toBeGreaterThan(0);
    expect(writes(d, "orb_messages")).toBe(1);
    expect(writes(d, "orb_metrics")).toBe(1);
  }, 30000);

  it("neuer Fokusknoten: keine Existenzabfrage der Verbindung, Verbindung wird angelegt", async () => {
    const d = db([
      nodeRow({ id: "node-9", content: "Mein Hund heisst Rex.", norm_key: "hund rex" }),
    ]);
    const turn = await processInput(
      d,
      USER,
      "Wichtig: mein Hund heisst Rex und wir laufen jeden Morgen.",
    );
    expect(turn.learnedNew).toBe(true);

    // Die Verbindung wird angelegt, ohne vorher nachzusehen.
    expect(writes(d, "orb_connections")).toBeGreaterThan(0);
    const lookups = d
      .callsOn("orb_connections", "select")
      .filter((c) => c.filters.some((f) => f.column === "target_node_id"));
    expect(lookups.length).toBe(0);
  }, 30000);

  it("Messwert: Gesamtzahl der Datenbankaufrufe wird weiterhin erfasst", async () => {
    const d = db([nodeRow()]);
    await processInput(d, USER, "Ich habe eine RTX 5070 im Rechner.");
    const metrics = d.callsOn("orb_metrics", "insert")[0];
    const payload = metrics?.payload as { db_queries?: number } | undefined;
    expect(payload?.db_queries).toBeGreaterThan(0);
    // Der Zähler passt zur tatsächlichen Anzahl protokollierter Aufrufe.
    expect(payload?.db_queries).toBeLessThanOrEqual(d.calls.length);
  }, 30000);
});
