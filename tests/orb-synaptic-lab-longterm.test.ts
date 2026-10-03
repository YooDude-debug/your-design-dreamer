import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_LAB_PARAMS,
  WEAK_THRESHOLD,
  buildPool,
  initModel,
  stepModel,
  type LabParams,
  type LabSnapshot,
} from "@/orb-core/synaptic-lab/simulation";
import {
  DEFAULT_LT_PARAMS,
  compareSeeds,
  planLongTerm,
  runLongTerm,
  type LongTermParams,
} from "@/orb-core/synaptic-lab/longterm";

const snap: LabSnapshot = {
  nodes: Array.from({ length: 30 }, (_, i) => ({
    id: `n${String(i).padStart(2, "0")}`,
    group: i % 2 ? "a" : "b",
  })),
  edges: Array.from({ length: 20 }, (_, i) => ({
    source: `n${String(i).padStart(2, "0")}`,
    target: `n${String(i + 1).padStart(2, "0")}`,
  })),
};
const P: LabParams = { ...DEFAULT_LAB_PARAMS, decay: 0.08 };
const LT: LongTermParams = {
  ...DEFAULT_LT_PARAMS,
  buildSteps: 10,
  restSteps: 20,
  recallSteps: 6,
  trackedCount: 9,
};
const pool = buildPool(snap);
const pm = new Map(pool.map((e) => [e.key, e]));

describe("P9 Langzeittest", () => {
  it("1 Decay während der Ruhephase (B, C), nicht in A", () => {
    const { traces } = runLongTerm(snap, P, LT);
    for (const t of traces) {
      const a = t.samples[LT.buildSteps - 1]![0]!;
      const b = t.samples[LT.buildSteps + 5]![0]!;
      if (t.model === "A") expect(b.strength).toBe(a.strength);
      else if (b.present) expect(b.strength!).toBeLessThan(a.strength!);
    }
  });

  it("2 keine Aktivierung und kein Wachstum in der Ruhephase", () => {
    const plan = planLongTerm(pool, P, LT);
    const rest = plan.events.filter((e) => e.phase === "rest");
    expect(rest).toHaveLength(LT.restSteps);
    for (const e of rest) expect(e.activate.length + e.grow.length).toBe(0);
  });

  it("3 schwache vorhandene Verbindung wird in C reaktiviert, in B nicht", () => {
    const { metrics } = runLongTerm(snap, P, LT);
    const [, b, c] = metrics;
    expect(c!.weakPresentAfterRest).toBeGreaterThan(0);
    expect(c!.reactivated).toBeGreaterThan(0);
    expect(b!.reactivated).toBe(0);
  });

  it("4 entfernte Verbindung wird durch Abruf nicht reaktiviert oder neu erzeugt", () => {
    const k = pool[0]!.key;
    const p = { ...P, decay: 1 };
    let s = stepModel(initModel("C"), { grow: [k], activate: [] }, pm, p);
    for (let i = 0; i < 10; i++) s = stepModel(s, { grow: [], activate: [] }, pm, p);
    expect(s.candidates.get(k)!.lifecycle).toBe("removed");
    s = stepModel(s, { grow: [k], activate: [k] }, pm, p);
    expect(s.candidates.get(k)!.lifecycle).toBe("removed");
    expect(s.candidates.get(k)!.everReactivated).toBe(false);
    const long = runLongTerm(snap, { ...P, decay: 0.5 }, LT);
    for (const m of long.metrics) expect(m.falseReactivations).toBe(0);
    expect(long.metrics[2]!.lost).toBeGreaterThan(0);
  });

  it("5 identische Ereignisfolge für A/B/C", () => {
    const { plan, traces } = runLongTerm(snap, P, LT);
    for (const t of traces) expect(t.states).toHaveLength(plan.events.length);
    expect(planLongTerm(pool, P, LT)).toEqual(plan);
  });

  it("6 Determinismus bei gleichem Seed, anders bei anderem", () => {
    const a = JSON.stringify(runLongTerm(snap, P, LT).metrics);
    expect(JSON.stringify(runLongTerm(snap, P, LT).metrics)).toBe(a);
    expect(JSON.stringify(planLongTerm(pool, { ...P, seed: 7 }, LT).events)).not.toBe(
      JSON.stringify(planLongTerm(pool, P, LT).events),
    );
    expect(compareSeeds(snap, P, LT, [1, 2])).toHaveLength(2);
  });

  it("7/8 Snapshot bleibt unverändert", () => {
    const before = JSON.stringify(snap);
    runLongTerm(snap, P, LT);
    expect(JSON.stringify(snap)).toBe(before);
  });

  it("9/10 kein Schreibweg, keine Übertragung, keine Signale", () => {
    for (const f of [
      "src/orb-core/synaptic-lab/longterm.ts",
      "src/components/orb-synaptic-lab/LongTermLab.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(
        /\.(insert|update|upsert|delete)\(|supabase|localStorage|BroadcastChannel|createServerFn|fetch\(/,
      );
    }
  });

  it("schwach ≠ reaktiviert: Quote nur über vorhandene schwache Verbindungen", () => {
    const { metrics } = runLongTerm(snap, P, LT);
    for (const m of metrics) expect(m.reactivated).toBeLessThanOrEqual(m.weakPresentAfterRest);
    expect(WEAK_THRESHOLD).toBeGreaterThan(0);
  });
});
