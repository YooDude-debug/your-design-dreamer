import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_LAB_PARAMS, type LabSnapshot } from "@/orb-core/synaptic-lab/simulation";
import { DEFAULT_LT_PARAMS, runLongTerm } from "@/orb-core/synaptic-lab/longterm";
import {
  VALIDATION_REST_STEPS,
  runValidation,
  seedList,
  stats,
} from "@/orb-core/synaptic-lab/validation";

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
const P = { ...DEFAULT_LAB_PARAMS, decay: 0.08 };

describe("P10 Robustheitsvalidierung", () => {
  const res = runValidation(snap, P, DEFAULT_LT_PARAMS);

  it("Ruhephasen 5/10/20/40 und mindestens 10 Seeds", () => {
    expect(res.map((r) => r.restSteps)).toEqual([...VALIDATION_REST_STEPS]);
    for (const r of res) expect(r.seeds.length).toBeGreaterThanOrEqual(10);
  });

  it("Reproduzierbar: gleiche Eingaben → identische Ergebnisse", () => {
    expect(JSON.stringify(runValidation(snap, P, DEFAULT_LT_PARAMS))).toBe(JSON.stringify(res));
  });

  it("Kontrollpaare zählen nie als Reaktivierung", () => {
    for (const r of res)
      for (const a of r.aggregate) {
        expect(a.controlsPresent).toBe(0);
        expect(a.falseReactivations).toBe(0);
      }
  });

  it("Modell A: Zielstärke gehalten, nicht als Wiederherstellung gezählt", () => {
    const m = runLongTerm(snap, P, DEFAULT_LT_PARAMS).metrics[0]!;
    expect(m.recovered).toBe(0);
    expect(m.meanStepsToRecovery).toBeNull();
    expect(m.targetHeld).toBe(m.tracked);
  });

  it("Klassifikation vollständig: gehalten + wiederhergestellt + nicht = beobachtet", () => {
    for (const m of runLongTerm(snap, P, DEFAULT_LT_PARAMS).metrics)
      expect(m.targetHeld + m.recovered + m.targetNotReached).toBe(m.tracked);
  });

  it("Statistik korrekt", () => {
    expect(stats([1, 3])).toEqual({ mean: 2, min: 1, max: 3, std: 1, n: 2 });
    expect(stats([])).toBeNull();
    expect(seedList(5, 3)).toEqual([5, 6, 7]);
  });

  it("C-schlechter-Markierung entspricht den Seed-Werten", () => {
    for (const r of res)
      for (const row of r.seeds) {
        const [a, b, c] = row.metrics.map((m) => m.retrievabilityEnd ?? 0);
        expect(r.cWorseSeeds.includes(row.seed)).toBe(c! < a! || c! < b!);
      }
  });

  it("kein Schreibweg", () => {
    for (const f of [
      "src/orb-core/synaptic-lab/validation.ts",
      "src/components/orb-synaptic-lab/ValidationLab.tsx",
    ])
      expect(readFileSync(f, "utf8")).not.toMatch(
        /\.(insert|update|upsert|delete)\(|supabase|localStorage|BroadcastChannel|createServerFn|fetch\(/,
      );
  });
});
