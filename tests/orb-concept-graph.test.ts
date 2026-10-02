/**
 * ORB Core – Begriffe und Beziehungen aus der bestehenden Hintergrund-Auswertung.
 * Isoliert: In-Memory-Datenbank, kein Netzwerk, kein Modellaufruf.
 */
import { describe, expect, it } from "vitest";
import {
  CONCEPT_KEY_PREFIX,
  conceptKey,
  isConceptRow,
  validateConcepts,
} from "@/orb-core/analysis/concepts";
import { persistConcepts } from "@/orb-core/analysis/concepts.server";
import { scopedDb } from "@/orb-core/scope";
import { QueryCounter, type DB } from "@/orb-core/engine.server";
import { RESPONSE_SCHEMA, ANALYSIS_MODEL } from "@/orb-core/analysis/analyze.server";

/* ---------------------------------------------------------- Fake-Datenbank */
type Row = Record<string, unknown>;
function fakeDb() {
  const tables: Record<string, Row[]> = { orb_nodes: [], orb_connections: [] };
  let seq = 0;
  const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

  function query(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let mode: "select" | "update" | "insert" = "select";
    let patch: Row | null = null;
    const inserted: Row[] = [];
    let error: { code: string; message: string } | null = null;
    const rows = () => tables[table]!.filter((r) => filters.every((f) => f(r)));
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
      or: (expr: string) => {
        const parts = [
          ...expr.matchAll(/and\(source_node_id\.eq\.([^,]+),target_node_id\.eq\.([^)]+)\)/g),
        ];
        filters.push((r) =>
          parts.some((p) => r["source_node_id"] === p[1] && r["target_node_id"] === p[2]),
        );
        return api;
      },
      order: () => api,
      limit: () => api,
      insert: (v: Row | Row[]) => {
        mode = "insert";
        for (const row of Array.isArray(v) ? v : [v]) {
          if (
            table === "orb_nodes" &&
            row["norm_key"] &&
            tables.orb_nodes!.some(
              (r) =>
                r["user_id"] === row["user_id"] &&
                r["scope"] === row["scope"] &&
                r["norm_key"] === row["norm_key"],
            )
          ) {
            error = { code: "23505", message: "dup" };
            return api;
          }
          if (
            table === "orb_connections" &&
            tables.orb_connections!.some(
              (r) =>
                r["source_node_id"] === row["source_node_id"] &&
                r["target_node_id"] === row["target_node_id"],
            )
          ) {
            error = { code: "23505", message: "dup" };
            return api;
          }
          const full = { id: uid(), activation_count: 0, metadata: {}, ...row };
          if (table === "orb_connections") {
            // Bereichs-Trigger nachgebildet: beide Knoten im selben Bereich.
            const s = tables.orb_nodes!.find((n) => n["id"] === full["source_node_id"]);
            const t = tables.orb_nodes!.find((n) => n["id"] === full["target_node_id"]);
            if (!s || !t || s["scope"] !== full["scope"] || t["scope"] !== full["scope"]) {
              error = { code: "P0001", message: "scope" };
              return api;
            }
          }
          tables[table]!.push(full);
          inserted.push(full);
        }
        return api;
      },
      update: (v: Row) => ((mode = "update"), (patch = v), api),
      maybeSingle: () => api,
      single: () => api,
      then: (resolve: (v: unknown) => void) => {
        if (error) return resolve({ data: null, error });
        if (mode === "insert") return resolve({ data: inserted[0] ?? null, error: null });
        if (mode === "update") {
          for (const r of rows()) Object.assign(r, patch);
          return resolve({ data: null, error: null });
        }
        return resolve({ data: rows()[0] ?? null, error: null });
      },
    };
    return api;
  }
  return { db: { from: query } as unknown as DB, tables };
}

const USER = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-10-02T04:00:00.000Z";

async function run(
  db: DB,
  userTexts: string[],
  raw: unknown,
  memories: { id: string; text: string }[] = [],
) {
  const check = validateConcepts(raw, userTexts);
  const report = await persistConcepts(
    db,
    USER,
    { concepts: check.concepts, relations: check.relations, memories, runId: "run", nowIso: NOW },
    new QueryCounter(),
  );
  return { check, report };
}

const CRYPTO_TEXT =
  "Ich überlege, eine Kryptowährung zu entwickeln, die anders funktioniert als Bitcoin.";
const CRYPTO_RAW = {
  concepts: [
    { label: "Kryptowährung", evidence_quote: "eine Kryptowährung zu entwickeln", confidence: 0.9 },
    { label: "Bitcoin", evidence_quote: "anders funktioniert als Bitcoin", confidence: 0.9 },
  ],
  relations: [
    {
      from: "Kryptowährung",
      to: "Bitcoin",
      relation: "alternative_to",
      basis: "explicit",
      evidence_quote: "eine Kryptowährung zu entwickeln, die anders funktioniert als Bitcoin",
      confidence: 0.8,
    },
  ],
};

const conceptNodes = (rows: Row[]) => rows.filter((r) => isConceptRow(r as never));

describe("Begriffe – Validierung", () => {
  it("keine Füllwörter, Fragewörter oder Einzelwörter ohne Inhalt als Begriff", () => {
    const { concepts, rejected } = validateConcepts(
      {
        concepts: ["nein", "wäre", "Wie", "richtig", "ok"].map((label) => ({
          label,
          evidence_quote: "nein wäre wie richtig ok",
          confidence: 0.99,
        })),
        relations: [],
      },
      ["nein wäre wie richtig ok"],
    );
    expect(concepts).toEqual([]);
    expect(rejected.every((r) => r.reason === "filler_word")).toBe(true);
  });

  it("unzureichende Evidenz → keine Speicherung (fremder Beleg, niedrige Sicherheit, Begriff fehlt im Beleg)", () => {
    const { concepts, rejected } = validateConcepts(
      {
        concepts: [
          { label: "Blockchain", evidence_quote: "Blockchain ist toll", confidence: 0.9 }, // nicht gesagt
          { label: "Kryptowährung", evidence_quote: "eine Kryptowährung", confidence: 0.3 },
          { label: "Energieverbrauch", evidence_quote: "eine Kryptowährung", confidence: 0.9 },
        ],
        relations: [],
      },
      [CRYPTO_TEXT],
    );
    expect(concepts).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual([
      "quote_not_in_user_text",
      "low_confidence",
      "label_not_in_quote",
    ]);
  });

  it("Beleg aus ORB-Antworten zählt nicht – nur Benutzertext", () => {
    const { concepts } = validateConcepts(
      {
        concepts: [
          {
            label: "Konsensmechanismus",
            evidence_quote: "der Konsensmechanismus",
            confidence: 0.9,
          },
        ],
        relations: [],
      },
      [CRYPTO_TEXT], // ORB-Zeile mit „Konsensmechanismus“ ist bewusst NICHT übergeben
    );
    expect(concepts).toEqual([]);
  });

  it("Beziehung braucht Typ, Grundlage, Beleg mit beiden Enden – nie Status „bestätigt“", () => {
    const { relations, rejected } = validateConcepts(
      {
        concepts: CRYPTO_RAW.concepts,
        relations: [
          { ...CRYPTO_RAW.relations[0], relation: "is_better" },
          { ...CRYPTO_RAW.relations[0], evidence_quote: "anders funktioniert als Bitcoin" },
          CRYPTO_RAW.relations[0],
        ],
      },
      [CRYPTO_TEXT],
    );
    expect(rejected.map((r) => r.reason)).toEqual(["unknown_relation_type", "ends_not_in_quote"]);
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({ relation: "alternative_to", status: "stated_by_user" });
    expect(JSON.stringify(relations)).not.toContain("confirmed");
  });

  it("Begriffe haben eigenen Schlüssel und kollidieren nie mit Erinnerungen", () => {
    expect(conceptKey("Kryptowährung").startsWith(CONCEPT_KEY_PREFIX)).toBe(true);
    expect(isConceptRow({ norm_key: "krypto", metadata: {} })).toBe(false);
  });

  it("Schema/Modell: kein Modellwechsel, Begriffe in derselben Antwort", () => {
    expect(ANALYSIS_MODEL).toBe("openai/gpt-5.6-luna");
    expect(RESPONSE_SCHEMA.required).toEqual(["candidates", "concepts", "relations"]);
  });
});

describe("Begriffe – Speicherung im Graph", () => {
  it("neues Thema → eigener Begriffsknoten (kein Textfeld in einer Erinnerung)", async () => {
    const { db, tables } = fakeDb();
    const { report } = await run(scopedDb(db, "normal"), [CRYPTO_TEXT], CRYPTO_RAW);
    expect(report.conceptsCreated).toBe(2);
    const nodes = conceptNodes(tables.orb_nodes!);
    expect(nodes.map((n) => n["content"]).sort()).toEqual(["Bitcoin", "Kryptowährung"]);
    for (const n of nodes) {
      expect(n["scope"]).toBe("normal");
      expect(n["topic"]).toBeNull();
      expect((n["metadata"] as Row)["kind"]).toBe("concept");
      expect((n["metadata"] as Row)["evidence"]).toHaveLength(1);
    }
  });

  it("verwandte Begriffe → nachvollziehbare Verbindung mit Typ, Beleg und Status", async () => {
    const { db, tables } = fakeDb();
    await run(scopedDb(db, "normal"), [CRYPTO_TEXT], CRYPTO_RAW);
    expect(tables.orb_connections).toHaveLength(1);
    const m = tables.orb_connections![0]!["metadata"] as Row;
    expect(m).toMatchObject({
      kind: "concept_relation",
      relation: "alternative_to",
      basis: "explicit",
      evidence_status: "stated_by_user",
    });
    expect((m["evidence"] as Row[])[0]!["quote"]).toContain("Bitcoin");
  });

  it("unterschiedliche Themen ohne gemeinsame Belegstelle → keine künstliche Verbindung", async () => {
    const { db, tables } = fakeDb();
    const texts = ["Ich koche gern Lasagne.", "Mein Fahrrad ist kaputt."];
    await run(scopedDb(db, "normal"), texts, {
      concepts: [
        { label: "Lasagne", evidence_quote: "Ich koche gern Lasagne", confidence: 0.9 },
        { label: "Fahrrad", evidence_quote: "Mein Fahrrad ist kaputt", confidence: 0.9 },
      ],
      relations: [
        {
          from: "Lasagne",
          to: "Fahrrad",
          relation: "related_to",
          basis: "inferred",
          evidence_quote: "Ich koche gern Lasagne",
          confidence: 0.9,
        },
      ],
    });
    expect(conceptNodes(tables.orb_nodes!)).toHaveLength(2);
    expect(tables.orb_connections).toHaveLength(0);
  });

  it("wiederkehrendes Thema / wiederholte Verarbeitung → keine Duplikate, Status bleibt", async () => {
    const { db, tables } = fakeDb();
    const sdb = scopedDb(db, "normal");
    await run(sdb, [CRYPTO_TEXT], CRYPTO_RAW);
    const second = await run(sdb, [CRYPTO_TEXT], CRYPTO_RAW);
    await run(sdb, [CRYPTO_TEXT], CRYPTO_RAW);
    expect(second.report.conceptsCreated).toBe(0);
    expect(second.report.conceptsReused).toBe(2);
    expect(conceptNodes(tables.orb_nodes!)).toHaveLength(2);
    expect(tables.orb_connections).toHaveLength(1);
    const m = tables.orb_connections![0]!["metadata"] as Row;
    expect(m["mentions"]).toBe(3);
    expect(m["evidence_status"]).toBe("stated_by_user"); // Wiederholung ≠ Bestätigung
    expect(m["evidence"]).toHaveLength(1); // gleicher Beleg nicht doppelt
    expect(tables.orb_connections![0]!["weight"]).toBe(0.35); // keine Verstärkung durch Wiederholung
  });

  it("Widerspruch im Beziehungstyp → keine stille Überschreibung, Konflikt vermerkt", async () => {
    const { db, tables } = fakeDb();
    const sdb = scopedDb(db, "normal");
    await run(sdb, [CRYPTO_TEXT], CRYPTO_RAW);
    const text2 = "Meine Kryptowährung ist eigentlich Teil von Bitcoin.";
    const { report } = await run(sdb, [text2], {
      concepts: [
        { label: "Kryptowährung", evidence_quote: "Meine Kryptowährung", confidence: 0.9 },
        { label: "Bitcoin", evidence_quote: "Teil von Bitcoin", confidence: 0.9 },
      ],
      relations: [
        {
          from: "Kryptowährung",
          to: "Bitcoin",
          relation: "part_of",
          basis: "explicit",
          evidence_quote: text2,
          confidence: 0.9,
        },
      ],
    });
    expect(report.relationConflicts).toBe(1);
    const m = tables.orb_connections![0]!["metadata"] as Row;
    expect(m["relation"]).toBe("alternative_to");
    expect(m["potential_conflict"]).toBe(true);
    expect((m["conflicting_relations"] as Row[])[0]!["relation"]).toBe("part_of");
  });

  it("Scope-Wechsel → Begriffe aus normal sind in orb_core unsichtbar und werden dort neu, getrennt angelegt", async () => {
    const { db, tables } = fakeDb();
    await run(scopedDb(db, "normal"), [CRYPTO_TEXT], CRYPTO_RAW);
    const core = scopedDb(db, "orb_core");
    const seen = await core
      .from("orb_nodes")
      .select("id")
      .eq("user_id", USER)
      .eq("norm_key", conceptKey("Bitcoin"))
      .maybeSingle();
    expect(seen.data).toBeNull();
    const { report } = await run(core, [CRYPTO_TEXT], CRYPTO_RAW);
    expect(report.conceptsCreated).toBe(2);
    for (const c of tables.orb_connections!) {
      const s = tables.orb_nodes!.find((n) => n["id"] === c["source_node_id"])!;
      const t = tables.orb_nodes!.find((n) => n["id"] === c["target_node_id"])!;
      expect(s["scope"]).toBe(c["scope"]);
      expect(t["scope"]).toBe(c["scope"]);
    }
  });

  it("unassigned bleibt für normale Chat-Scopes unsichtbar und wird nicht wiederverwendet", async () => {
    const { db, tables } = fakeDb();
    tables.orb_nodes!.push({
      id: "legacy",
      user_id: USER,
      scope: "unassigned",
      norm_key: conceptKey("Bitcoin"),
      content: "Bitcoin",
      metadata: { kind: "concept" },
      activation_count: 0,
    });
    await run(scopedDb(db, "normal"), [CRYPTO_TEXT], CRYPTO_RAW);
    const legacy = tables.orb_nodes!.find((n) => n["id"] === "legacy")!;
    expect(legacy["activation_count"]).toBe(0);
    expect(
      tables.orb_connections!.some(
        (c) => c["source_node_id"] === "legacy" || c["target_node_id"] === "legacy",
      ),
    ).toBe(false);
  });

  it("Erinnerung → Begriff nur, wenn der Begriff im Erinnerungstext vorkommt", async () => {
    const { db, tables } = fakeDb();
    const sdb = scopedDb(db, "normal");
    const memA = (
      await sdb
        .from("orb_nodes")
        .insert({ user_id: USER, content: "m1", norm_key: "m1" })
        .select("id")
        .single()
    ).data as Row;
    const memB = (
      await sdb
        .from("orb_nodes")
        .insert({ user_id: USER, content: "m2", norm_key: "m2" })
        .select("id")
        .single()
    ).data as Row;
    const { report } = await run(sdb, [CRYPTO_TEXT], CRYPTO_RAW, [
      { id: memA["id"] as string, text: "Mario möchte eine eigene Kryptowährung entwickeln." },
      { id: memB["id"] as string, text: "Mario mag Lasagne." },
    ]);
    expect(report.memoryLinks).toBe(1);
    const link = tables.orb_connections!.find((c) => c["source_node_id"] === memA["id"])!;
    expect((link["metadata"] as Row)["evidence_status"]).toBe("co_mentioned");
    expect(tables.orb_connections!.some((c) => c["source_node_id"] === memB["id"])).toBe(false);
  });

  it("mehrere Gespräche → zusammenhängender Graph statt isolierter Inseln", async () => {
    const { db, tables } = fakeDb();
    const sdb = scopedDb(db, "normal");
    await run(sdb, [CRYPTO_TEXT], CRYPTO_RAW);
    const t2 = "Bitcoin nutzt eine Blockchain mit hohem Energieverbrauch.";
    await run(sdb, [t2], {
      concepts: [
        { label: "Bitcoin", evidence_quote: "Bitcoin nutzt", confidence: 0.9 },
        { label: "Blockchain", evidence_quote: "eine Blockchain", confidence: 0.9 },
        { label: "Energieverbrauch", evidence_quote: "hohem Energieverbrauch", confidence: 0.9 },
      ],
      relations: [
        {
          from: "Bitcoin",
          to: "Blockchain",
          relation: "uses",
          basis: "explicit",
          evidence_quote: "Bitcoin nutzt eine Blockchain",
          confidence: 0.9,
        },
        {
          from: "Blockchain",
          to: "Energieverbrauch",
          relation: "related_to",
          basis: "inferred",
          evidence_quote: "Blockchain mit hohem Energieverbrauch",
          confidence: 0.7,
        },
      ],
    });
    const t3 = "Für meine Kryptowährung will ich einen sparsamen Konsensmechanismus.";
    await run(sdb, [t3], {
      concepts: [
        { label: "Kryptowährung", evidence_quote: "meine Kryptowährung", confidence: 0.9 },
        {
          label: "Konsensmechanismus",
          evidence_quote: "sparsamen Konsensmechanismus",
          confidence: 0.9,
        },
      ],
      relations: [
        {
          from: "Kryptowährung",
          to: "Konsensmechanismus",
          relation: "uses",
          basis: "explicit",
          evidence_quote: t3,
          confidence: 0.9,
        },
      ],
    });
    const nodes = conceptNodes(tables.orb_nodes!);
    expect(nodes).toHaveLength(5);
    // Zusammenhang prüfen (ungerichtet).
    const adj = new Map<string, string[]>();
    for (const c of tables.orb_connections!) {
      const s = c["source_node_id"] as string;
      const t = c["target_node_id"] as string;
      adj.set(s, [...(adj.get(s) ?? []), t]);
      adj.set(t, [...(adj.get(t) ?? []), s]);
    }
    const seen = new Set<string>([nodes[0]!["id"] as string]);
    const stack = [...seen];
    while (stack.length)
      for (const n of adj.get(stack.pop()!) ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n));
    expect(seen.size).toBe(5);
  });
});
