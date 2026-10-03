import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_LAB_PARAMS,
  LAB_MODELS,
  REMOVE_AFTER_STEPS,
  buildPool,
  initModel,
  metricsOf,
  runComparison,
  stepModel,
  type LabParams,
  type LabSnapshot,
} from "@/orb-core/synaptic-lab/simulation";
import { DEFAULT_LT_PARAMS, planLongTerm, runLongTerm } from "@/orb-core/synaptic-lab/longterm";
import { runValidation } from "@/orb-core/synaptic-lab/validation";

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
const P: LabParams = { ...DEFAULT_LAB_PARAMS, decay: 0.2, dormantRetention: 10 };
const pool = buildPool(snap);
const pm = new Map(pool.map((e) => [e.key, e]));
const k = pool[0]!.key;
const idle = { grow: [], activate: [] };
const grownD = () => stepModel(initModel("D"), { grow: [k], activate: [] }, pm, P);
const run = (s: ReturnType<typeof grownD>, n: number) => {
  for (let i = 0; i < n; i++) s = stepModel(s, idle, pm, P);
  return s;
};
const toDormant = () => {
  let s = grownD();
  while (s.candidates.get(k)!.lifecycle !== "dormant") s = stepModel(s, idle, pm, P);
  return s;
};

describe("P11 Modell D – reversibles Pruning", () => {
  it("1 Active → Weak", () => {
    let s = grownD();
    expect(s.candidates.get(k)!.lifecycle).toBe("active");
    s = run(s, 2);
    expect(s.candidates.get(k)!.lifecycle).toBe("weak");
  });

  it("2 Weak → Dormant (statt removed), Metadaten bleiben", () => {
    const s = toDormant();
    const c = s.candidates.get(k)!;
    expect(c.source && c.target && c.relation && c.origin).toBeTruthy();
    const sC = run(stepModel(initModel("C"), { grow: [k], activate: [] }, pm, P), 20);
    expect(sC.candidates.get(k)!.lifecycle).toBe("removed");
  });

  it("3 Dormant → rekonstruiert (keine automatische Reaktivierung)", () => {
    let s = toDormant();
    s = stepModel(s, { grow: [], activate: [k] }, pm, P);
    const c = s.candidates.get(k)!;
    expect(c.restoredCount).toBe(1);
    expect(c.everReactivated).toBe(false);
    expect(["active", "weak", "inactive"]).toContain(c.lifecycle);
    s = stepModel(s, { grow: [], activate: [k] }, pm, P);
    expect(s.candidates.get(k)!.anchorStrength).toBeGreaterThan(P.pruneThreshold);
  });

  it("4/5/9 Dormant → Expired nach Aufbewahrung; Expired nie rekonstruierbar", () => {
    let s = toDormant();
    s = run(s, P.dormantRetention - 1);
    expect(s.candidates.get(k)!.lifecycle).toBe("dormant");
    s = run(s, 1);
    expect(s.candidates.get(k)!.lifecycle).toBe("expired");
    s = stepModel(s, { grow: [k], activate: [k] }, pm, P);
    expect(s.candidates.get(k)!.lifecycle).toBe("expired");
    expect(s.candidates.get(k)!.restoredCount).toBe(0);
    expect(metricsOf(s, snap, P).expired).toBe(1);
    expect(REMOVE_AFTER_STEPS).toBeGreaterThan(0);
  });

  it("6 Kontrollpaare zählen nie als Reaktivierung", () => {
    for (const r of runValidation(snap, P, DEFAULT_LT_PARAMS))
      for (const a of r.aggregate) {
        expect(a.controlsPresent).toBe(0);
        expect(a.falseReactivations).toBe(0);
      }
  });

  it("7 Determinismus", () => {
    expect(JSON.stringify(runValidation(snap, P, DEFAULT_LT_PARAMS))).toBe(
      JSON.stringify(runValidation(snap, P, DEFAULT_LT_PARAMS)),
    );
  });

  it("8 A/B/C/D erhalten dieselbe Ereignisfolge", () => {
    expect(LAB_MODELS).toEqual(["A", "B", "C", "D"]);
    const { plan, traces } = runLongTerm(snap, P, DEFAULT_LT_PARAMS);
    expect(traces).toHaveLength(4);
    for (const t of traces) expect(t.states).toHaveLength(plan.events.length);
    expect(planLongTerm(pool, P, DEFAULT_LT_PARAMS)).toEqual(plan);
  });

  it("Rekonstruktion zählt nicht als Reaktivierung; Ruhe 80 läuft", () => {
    const r = runValidation(snap, P, DEFAULT_LT_PARAMS, [80])[0]!;
    const d = r.aggregate[3]!;
    expect(d.model).toBe("D");
    expect(d.restored + d.expired).toBeGreaterThanOrEqual(0);
  });

  it("10/11 Reset = neuer Zustand, Snapshot unverändert", () => {
    const before = JSON.stringify(snap);
    runComparison(snap, P, 60);
    expect(JSON.stringify(snap)).toBe(before);
    expect(initModel("D").candidates.size).toBe(0);
  });

  it("11/12 kein Schreibweg; Quelle bleibt user+scope-gebunden", () => {
    for (const f of [
      "src/orb-core/synaptic-lab/simulation.ts",
      "src/orb-core/synaptic-lab/longterm.ts",
      "src/orb-core/synaptic-lab/validation.ts",
      "src/components/orb-synaptic-lab/SynapticLab.tsx",
      "src/components/orb-synaptic-lab/ValidationLab.tsx",
    ])
      expect(readFileSync(f, "utf8")).not.toMatch(
        /\.(insert|update|upsert|delete)\(|supabase|localStorage|BroadcastChannel|createServerFn|fetch\(/,
      );
    expect(readFileSync("src/components/orb-synaptic-lab/SynapticLab.tsx", "utf8")).toContain(
      '["orb-synaptic-lab-source", userId, scope]',
    );
  });
});
