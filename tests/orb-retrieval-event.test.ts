import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRetrievalEvent,
  createRetrievalPulseGate,
  isRetrievalEvent,
  RETRIEVAL_PULSE_LOCK_MS,
} from "@/orb-core/retrieval-event";

const recalled = [
  { id: "m1", level: "A" as const, score: 0.8 },
  { id: "m2", level: "B" as const, score: 0.5 },
];
const base = {
  eventId: "evt_1",
  nowMs: Date.UTC(2026, 8, 27),
  recalled,
  modelVisibleIds: ["m1", null],
  activationExcludedIds: new Set(["m2"]),
};

function srcFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? srcFiles(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}
const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");

describe("ORB Retrieval-Event", () => {
  it("1. echtes recalled → gültiges Event ohne Inhalte", () => {
    const e = buildRetrievalEvent(base)!;
    expect(isRetrievalEvent(e)).toBe(true);
    expect(e).toMatchObject({
      event_id: "evt_1",
      memory_ids: ["m1", "m2"],
      rank: [1, 2],
      level: ["A", "B"],
      score: [0.8, 0.5],
      model_visible_ids: ["m1"],
      activation_excluded_ids: ["m2"],
    });
    expect(JSON.stringify(e)).not.toContain("content");
  });

  it("2. recalled leer → kein Event", () => {
    expect(buildRetrievalEvent({ ...base, recalled: [] })).toBeNull();
  });

  it("3–7. Event entsteht ausschliesslich in processInput (nicht Speichern, Feedback, Analyse, Feed, autonome Frage)", () => {
    const callers = srcFiles("src").filter(
      (f) =>
        !f.endsWith("retrieval-event.ts") && readFileSync(f, "utf8").includes("buildRetrievalEvent("),
    );
    expect(callers).toEqual([join("src", "orb-core", "engine.server.ts")]);
    expect(engine.match(/buildRetrievalEvent\(/g)).toHaveLength(1);
    const start = engine.indexOf("export async function processInput(");
    const call = engine.indexOf("buildRetrievalEvent(");
    const next = engine.indexOf("\nexport async function ", start + 10);
    expect(call).toBeGreaterThan(start);
    expect(call).toBeLessThan(next);
    // Autonome Frage (recalled: [gap.memory]) liefert kein Event.
    const ask = engine.slice(engine.indexOf("recalled: [gap.memory]") - 2000);
    expect(ask.slice(0, 2600)).not.toContain("retrievalEvent");
    for (const f of [
      "src/orb-core/feed.server.ts",
      "src/orb-core/confirmation-effect.ts",
      "src/orb-core/analysis/apply.server.ts",
    ]) {
      expect(readFileSync(f, "utf8")).not.toContain("retrievalEvent");
    }
  });

  it("8–9. Thread-Aktivierung und Suche sind keine Retrieval-Events", () => {
    expect(isRetrievalEvent({ nodes: [], edges: [], threads: [{ id: "t" }] })).toBe(false);
    expect(isRetrievalEvent({ nodeIds: ["m1"], edgeIds: [], steps: [] })).toBe(false);
    const stage = readFileSync("src/components/orb-knowledge-graph/KnowledgeGraphStage.tsx", "utf8");
    expect(stage.match(/pulseRetrieval\(/g)).toHaveLength(1);
    const i = stage.indexOf("pulseRetrieval(");
    expect(stage.slice(i - 400, i)).toContain("isRetrievalEvent(msg.data)");
  });

  it("10. ungültige/unbekannte Events → false", () => {
    const ok = buildRetrievalEvent(base)!;
    for (const bad of [
      null,
      "x",
      {},
      { ...ok, kind: "other" },
      { ...ok, event_id: "" },
      { ...ok, memory_ids: [] },
      { ...ok, rank: [1] },
      { ...ok, level: ["A", "X"] },
      { ...ok, score: [0.1, Number.NaN] },
      { ...ok, at: "nope" },
      { ...ok, model_visible_ids: undefined },
    ]) {
      expect(isRetrievalEvent(bad)).toBe(false);
    }
  });

  it("11. zwei schnelle Events → Sperrzeit", () => {
    const gate = createRetrievalPulseGate();
    expect(gate(1000)).toBe(true);
    expect(gate(1000 + RETRIEVAL_PULSE_LOCK_MS - 1)).toBe(false);
    expect(gate(1000 + RETRIEVAL_PULSE_LOCK_MS)).toBe(true);
  });

  it("12. Recall-Ergebnisse bleiben unverändert", () => {
    const copy = structuredClone(recalled);
    buildRetrievalEvent(base);
    expect(recalled).toEqual(copy);
    expect(engine).toContain("const recalled = selectByLevel(scored, RECALL_LIMIT);");
    expect(engine).toMatch(/recalled: recalled\.map\(\(r\) => \(\{\s+id: r\.node\.id,\s+content: r\.node\.content,/);
  });
});
