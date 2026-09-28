import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { assessCognitiveAttention } from "@/orb-core/cognitive/attention";
import { assessCognitiveRelevance } from "@/orb-core/cognitive/relevance";
import { assessCognitiveNovelty } from "@/orb-core/cognitive/novelty";
import { assessCognitiveUncertainty } from "@/orb-core/cognitive/uncertainty";
import { assessCognitiveGoalPressure } from "@/orb-core/cognitive/goal-pressure";
import { energyFromOrbState } from "@/orb-core/cognitive/foundation";

const focus = { kind: "conversation", id: "conv1" };
const NOW = "2026-09-28T10:00:00Z";
const run = (o: Parameters<typeof assessCognitiveAttention>[0]) => assessCognitiveAttention(o);

describe("Phase 6 – Cognitive Attention", () => {
  it("A/B – current focus nur mit explizitem Fokus", () => {
    expect(run({ focus, currentFocus: 0.8 }).factors.currentFocus).toBe(0.8);
    expect(run({ focus, currentFocus: 0.8 }).focus).toEqual(focus);
    expect(run({ currentFocus: 0.8 }).factors.currentFocus).toBeNull();
    expect(
      run({ focus: { kind: "made_up", id: "x" }, currentFocus: 0.8 }).factors.currentFocus,
    ).toBeNull();
    expect(run({ focus }).factors.currentFocus).toBeNull();
  });

  it("C/D – focus continuity", () => {
    expect(run({ focus, focusContinuity: 0.9 }).factors.focusContinuity).toBe(0.9);
    expect(run({ focus, focusContinuity: 0.1 }).factors.focusContinuity).toBe(0.1);
    expect(run({ focusContinuity: 0.9 }).factors.focusContinuity).toBeNull();
  });

  it("E/F – switch cost nicht umgekehrt", () => {
    expect(run({ focus, focusSwitchCost: 0.9 }).factors.focusSwitchCost).toBe(0.9);
    expect(run({ focus, focusSwitchCost: 0.1 }).factors.focusSwitchCost).toBe(0.1);
  });

  it("G/H – interruption", () => {
    expect(run({ interruption: 0.95 }).factors.interruption).toBe(0.95);
    expect(run({ interruption: 0.05 }).factors.interruption).toBe(0.05);
  });

  it("I/J – availability", () => {
    expect(run({ attentionAvailability: 1 }).factors.attentionAvailability).toBe(1);
    expect(run({ attentionAvailability: 0.1 }).factors.attentionAvailability).toBe(0.1);
  });

  it("K/L – recent attention", () => {
    expect(
      run({ lastAttendedAt: "2026-09-28T09:30:00Z", now: NOW }).factors.recentAttention,
    ).toBeCloseTo(0.5);
    expect(run({ lastAttendedAt: NOW, now: NOW }).factors.recentAttention).toBe(1);
    expect(run({ now: NOW }).factors.recentAttention).toBeNull();
  });

  it("M/N – attention decay nur mit Zeitinput", () => {
    expect(
      run({ previousFocusLastActiveAt: "2026-09-28T09:45:00Z", now: NOW }).factors.attentionDecay,
    ).toBeCloseTo(0.5);
    expect(
      run({ previousFocusLastActiveAt: "2026-09-28T08:00:00Z", now: NOW }).factors.attentionDecay,
    ).toBe(1);
    expect(
      run({ previousFocusLastActiveAt: "2026-09-28T09:45:00Z" }).factors.attentionDecay,
    ).toBeNull();
    expect(
      run({ previousFocusLastActiveAt: "kaputt", now: NOW }).factors.attentionDecay,
    ).toBeNull();
  });

  it("O/P/Q – NaN, Infinity, non-number, clamp", () => {
    const a = run({
      focus,
      currentFocus: NaN,
      focusContinuity: Infinity,
      interruption: "0.5",
      focusSwitchCost: 3,
      attentionAvailability: -1,
    });
    expect(a.factors.currentFocus).toBeNull();
    expect(a.factors.focusContinuity).toBeNull();
    expect(a.factors.interruption).toBeNull();
    expect(a.invalidFactors).toEqual(["currentFocus", "focusContinuity", "interruption"]);
    expect(a.factors.focusSwitchCost).toBe(1);
    expect(a.factors.attentionAvailability).toBe(0);
    expect(run().unknownFactors).toHaveLength(7);
  });

  it("R/S – Energy und Memory Decay semantisch getrennt", () => {
    const state = { energy: 0.05 };
    const a = run({ attentionAvailability: 0.9 });
    expect(a.factors.attentionAvailability).toBe(0.9);
    expect(energyFromOrbState(state)).toBe(0.05);
    const r = a as unknown as Record<string, unknown>;
    expect(r.energy).toBeUndefined();
    expect((a.factors as Record<string, unknown>).memoryDecay).toBeUndefined();
    const src = readFileSync("src/orb-core/cognitive/attention.ts", "utf8");
    expect(src).not.toMatch(/from "@\/orb-core\/(memory|presence|core|curiosity|impulse)"/);
  });

  it("T/U/V/W – andere Cognitive-Schichten unverändert", () => {
    const rel = assessCognitiveRelevance({ factors: { context: 0.4 } });
    const nov = assessCognitiveNovelty({ statement: "a b", known: [] });
    const unc = assessCognitiveUncertainty({ source: { type: "memory", memoryId: "m" } });
    const gp = assessCognitiveGoalPressure({ contextAlignment: 0.3 });
    run({ focus, currentFocus: 1, interruption: 1 });
    expect(assessCognitiveRelevance({ factors: { context: 0.4 } })).toEqual(rel);
    expect(assessCognitiveNovelty({ statement: "a b", known: [] })).toEqual(nov);
    expect(assessCognitiveUncertainty({ source: { type: "memory", memoryId: "m" } })).toEqual(unc);
    expect(assessCognitiveGoalPressure({ contextAlignment: 0.3 })).toEqual(gp);
  });

  it("X/AC – kein Gesamtscore, keine Aktion", () => {
    const a = run({ focus, currentFocus: 1, attentionAvailability: 1 }) as unknown as Record<
      string,
      unknown
    >;
    for (const k of ["attention", "score", "winner", "act", "impulse"])
      expect(a[k]).toBeUndefined();
  });

  it("Y/Z/AA/AB/AD – deterministisch, isoliert", () => {
    const i = { focus, currentFocus: 0.3, lastAttendedAt: "2026-09-28T09:00:00Z", now: NOW };
    expect(run(i)).toEqual(run(i));
    const src = readFileSync("src/orb-core/cognitive/attention.ts", "utf8");
    expect(src).not.toMatch(
      /Date\.now|Math\.random|supabase|fetch\(|createServerFn|\.server"|insert\(|speak\(|process\.env/,
    );
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk("src");
    const users = files.filter(
      (f) =>
        !f.endsWith("cognitive/attention.ts") &&
        f !== "src/orb-core/cognitive-observation.ts" &&
        readFileSync(f, "utf8").includes("cognitive/attention"),
    );
    // Einzige erlaubte Ausnahme: der Cognitive-Observation-Einstieg.
    expect(users).toEqual([]);
  });
});
