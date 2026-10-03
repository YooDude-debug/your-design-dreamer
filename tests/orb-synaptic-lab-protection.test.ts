import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_LAB_PARAMS } from "@/orb-core/synaptic-lab/simulation";
import {
  DEFAULT_ADAPTIVE_PARAMS,
  runAdaptiveValidation,
  type Attr,
} from "@/orb-core/synaptic-lab/adaptive";
import {
  PROTECTION_PROFILES,
  protectionRetention,
  runBudgetComparison,
  runProtectionValidation,
} from "@/orb-core/synaptic-lab/protection";

const a = DEFAULT_ADAPTIVE_PARAMS;
const p = DEFAULT_LAB_PARAMS;
const at = (importance: number, reuse: number): Attr => ({ relevance: 0.5, importance, reuse, profile: null });

describe("P13 Importance Protection", () => {
  it("schützt wichtige, selten genutzte Verbindungen länger als F", () => {
    const x = at(0.9, 3);
    const f = protectionRetention("F", x, a, p).retention;
    expect(protectionRetention("G", x, a, p).retention).toBeGreaterThan(f);
    expect(protectionRetention("H", x, a, p).retention).toBeGreaterThan(f);
  });
  it("hält Höchstgrenze ein, keine unbegrenzte Aufbewahrung", () => {
    for (const imp of [0, 0.5, 0.7, 0.9, 1])
      for (const reuse of [0, 5, 20, 1000])
        for (const m of ["F", "G", "H"] as const) {
          const r = protectionRetention(m, at(imp, reuse), a, p, 10_000).retention;
          expect(r).toBeLessThanOrEqual(a.maxRetention);
          expect(r).toBeGreaterThanOrEqual(a.minRetention);
        }
  });
  it("H-Bonus ist gedeckelt, additiv und nur ab Schwelle", () => {
    const lo = protectionRetention("H", at(0.5, 3), a, p, 20);
    expect(lo.extension).toBe(0);
    const hi = protectionRetention("H", at(1, 0), a, p, 20);
    expect(hi.extension).toBeLessThanOrEqual(20);
    expect(hi.retention).toBe(hi.base + hi.extension);
  });
  it("geplanter Recall verändert weder Nutzung noch Frist", () => {
    const r = runProtectionValidation(p, a, 20, [80], 2);
    for (const s of r[0]!.seeds)
      for (const m of s.metrics)
        for (const [id, pp] of Object.entries(m.perProfile)) {
          const pr = PROTECTION_PROFILES.find((x) => x.id === id)!;
          const expected = Math.floor((a.buildSteps - 1) / pr.usageEvery) * pp.n;
          expect(pp.reuse).toBe(expected);
          expect(pp.plannedRecalls).toBe(a.recallSteps * pp.n);
        }
  });
  it("unwichtige Verbindungen können weiterhin verfallen", () => {
    const r = runProtectionValidation(p, a, 20, [80], 3)[0]!;
    for (const mi of [1, 2])
      expect(r.seeds.reduce((x, s) => x + s.metrics[mi]!.unimportantLost, 0)).toBeGreaterThan(0);
  });
  it("Budget-Vergleich: G/H bleiben im Budget von F oder sind markiert", () => {
    const b = runBudgetComparison(p, a, 20, [40, 80], 3);
    for (const row of b)
      for (const m of row.models) {
        expect(m.maxRetention).toBeLessThanOrEqual(a.maxRetention);
        if (m.withinBudget) expect(m.used).toBeLessThanOrEqual(row.budget + 1e-9);
      }
  });
  it("deterministisch bei gleichen Eingaben", () => {
    expect(JSON.stringify(runProtectionValidation(p, a, 20, [20, 80], 2))).toBe(
      JSON.stringify(runProtectionValidation(p, a, 20, [20, 80], 2)),
    );
  });
  it("expired wird nie rekonstruiert, keine falschen Rekonstruktionen", () => {
    for (const r of runProtectionValidation(p, a, 20, [80], 3))
      for (const s of r.seeds)
        for (const m of s.metrics) {
          expect(m.falseReconstructions).toBe(0);
          for (const pp of Object.values(m.perProfile))
            expect(pp.restored + pp.expired).toBeLessThanOrEqual(pp.n);
        }
  });
  it("D/E/F unverändert (Snapshot der P12-Werte bei Ruhe 80)", () => {
    const r = runAdaptiveValidation(p, a, [80])[0]!;
    const rate = (mi: number) => r.seeds.reduce((x, s) => x + s.metrics[mi]!.retrievabilityEnd, 0) / r.seeds.length;
    expect(rate(0)).toBeCloseTo(0, 5);
    expect(rate(1)).toBeCloseTo(1 / 3, 5);
    expect(rate(2)).toBeCloseTo(0.5, 5);
  });
  it("keine produktiven Schreib- oder Netzwege", () => {
    const src = readFileSync("src/orb-core/synaptic-lab/protection.ts", "utf8") +
      readFileSync("src/components/orb-synaptic-lab/ProtectionLab.tsx", "utf8");
    expect(src).not.toMatch(/supabase|fetch\(|createServerFn|localStorage|BroadcastChannel|insert\(|update\(/);
  });
});
