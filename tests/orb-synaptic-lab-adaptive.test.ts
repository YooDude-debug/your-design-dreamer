import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ADAPTIVE_MODELS,
  DEFAULT_ADAPTIVE_PARAMS as A,
  PROFILES,
  clampAdaptiveParams,
  planAdaptive,
  retentionFor,
  runAdaptiveModel,
  runAdaptiveValidation,
  syntheticSnapshot,
} from "@/orb-core/synaptic-lab/adaptive";
import {
  DEFAULT_LAB_PARAMS as P,
  buildPool,
  initModel,
  stepModel,
} from "@/orb-core/synaptic-lab/simulation";

const prof = (id: string) => PROFILES.find((p) => p.id === id)!;
const attr = (id: string, reuse: number) => ({ ...prof(id), reuse, profile: id });
const snap = syntheticSnapshot();

describe("P12 adaptive Aufbewahrung", () => {
  it("D bleibt feste Frist; Profile ordnen E/F-Fristen erwartungsgemäß", () => {
    for (const id of ["hr_lu", "lr_lu"]) expect(retentionFor("D", attr(id, 0), A, P)).toBe(P.dormantRetention);
    const E = (id: string, r: number) => retentionFor("E", attr(id, r), A, P);
    const F = (id: string, r: number) => retentionFor("F", attr(id, r), A, P);
    // hohe Relevanz selten > niedrige Relevanz häufig (E ignoriert Nutzung)
    expect(E("hr_lu", 3)).toBeGreaterThan(E("lr_hu", 19));
    expect(F("hr_hu", 19)).toBeGreaterThan(F("hr_lu", 3));
    expect(F("lr_hu", 19)).toBeGreaterThan(F("lr_lu", 3));
    // identische Relevanz, unterschiedliche Wiederverwendung: E gleich, F verschieden
    expect(E("mr_hu", 19)).toBe(E("mr_lu", 3));
    expect(F("mr_hu", 19)).toBeGreaterThan(F("mr_lu", 3));
  });

  it("Grenzfälle Mindest-/Höchstfrist", () => {
    const zero = { relevance: 0, importance: 0, reuse: 0, profile: null };
    const one = { relevance: 1, importance: 1, reuse: 999, profile: null };
    for (const m of ["E", "F"] as const) {
      expect(retentionFor(m, zero, A, P)).toBe(A.minRetention);
      expect(retentionFor(m, one, A, P)).toBe(A.maxRetention);
    }
    expect(clampAdaptiveParams({ ...A, minRetention: 50, maxRetention: 20 }).maxRetention).toBe(50);
    const fixed = { ...A, minRetention: 0, maxRetention: 0 };
    expect(retentionFor("F", one, fixed, P)).toBe(0);
  });

  it("Wiederverwendung nur aus Nutzungsphase, nie aus Recall", () => {
    const plan = planAdaptive(snap, P, A, 20);
    const k = plan.tracked[0]!;
    const buildActs = plan.events.filter((e) => e.phase === "build" && e.activate.includes(k)).length;
    expect(plan.attrs.get(k)!.reuse).toBe(buildActs);
    expect(plan.events.filter((e) => e.phase === "recall" && e.activate.includes(k)).length).toBe(A.recallSteps);
  });

  it("identische Ereignisfolge für D/E/F, deterministisch", () => {
    const a = JSON.stringify(planAdaptive(snap, P, A, 40).events);
    expect(JSON.stringify(planAdaptive(snap, P, A, 40).events)).toBe(a);
    expect(ADAPTIVE_MODELS).toEqual(["D", "E", "F"]);
    expect(JSON.stringify(runAdaptiveValidation(P, A, [40], 2))).toBe(
      JSON.stringify(runAdaptiveValidation(P, A, [40], 2)),
    );
  });

  it("hohe Wichtigkeit ≠ Retrieval-Erfolg; mind. 10 Seeds; keine falschen Rekonstruktionen", () => {
    const res = runAdaptiveValidation(P, { ...A, maxRetention: 15, minRetention: 15 }, [80]);
    expect(res[0]!.seeds).toHaveLength(10);
    for (const s of res[0]!.seeds)
      for (const m of s.metrics) {
        expect(m.perProfile.hr_hu!.retrievable).toBe(0);
        expect(m.importantLost).toBeGreaterThan(0);
        expect(m.falseReconstructions).toBe(0);
      }
  });

  it("expired bleibt endgültig; Zustände getrennt", () => {
    const pool = buildPool(snap);
    const pm = new Map(pool.map((e) => [e.key, e]));
    const k = pool[0]!.key;
    const p = { ...P, decay: 0.5 };
    const opt = { retention: () => 3 };
    let s = stepModel(initModel("D"), { grow: [k], activate: [] }, pm, p, opt);
    while (s.candidates.get(k)!.lifecycle !== "dormant") s = stepModel(s, { grow: [], activate: [] }, pm, p, opt);
    for (let i = 0; i < 4; i++) s = stepModel(s, { grow: [], activate: [] }, pm, p, opt);
    expect(s.candidates.get(k)!.lifecycle).toBe("expired");
    s = stepModel(s, { grow: [k], activate: [k] }, pm, p, opt);
    expect(s.candidates.get(k)!.lifecycle).toBe("expired");
    expect(s.candidates.get(k)!.restoredCount).toBe(0);
    expect(s.candidates.get(k)!.everReactivated).toBe(false);
  });

  it("Speicher und Dormant-Bestand separat; Rekonstruktion ≠ Reaktivierung", () => {
    const plan = planAdaptive(snap, P, A, 40);
    const m = runAdaptiveModel("F", plan, snap, P, A);
    expect(m.dormantPeakBytes).toBe(m.dormantPeak * 160);
    expect(typeof m.activeEndBytes).toBe("number");
    expect(m.restored).toBeLessThanOrEqual(m.dormantEverTracked);
  });

  it("nur synthetische Daten, kein Schreib-/Netzweg", () => {
    for (const f of ["src/orb-core/synaptic-lab/adaptive.ts", "src/components/orb-synaptic-lab/AdaptiveLab.tsx"])
      expect(readFileSync(f, "utf8")).not.toMatch(
        /\.(insert|update|upsert|delete)\(|supabase|localStorage|BroadcastChannel|createServerFn|fetch\(|getOrbKnowledgeGraph/,
      );
  });
});
