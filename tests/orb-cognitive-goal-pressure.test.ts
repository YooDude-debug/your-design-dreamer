import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { assessCognitiveGoalPressure } from "@/orb-core/cognitive/goal-pressure";
import {
  isDirectMemory,
  type OrbGoal,
  type OrbInformationSource,
} from "@/orb-core/cognitive/foundation";
import { relevanceScore } from "@/orb-core/core";

const goal: OrbGoal = {
  id: "g1",
  title: "Y-Dude stabilisieren",
  priority: 0.4,
  status: "active",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-13T00:00:00Z",
};
const NOW = "2026-09-28T00:00:00Z";
const run = (o: Parameters<typeof assessCognitiveGoalPressure>[0]) =>
  assessCognitiveGoalPressure(o);

describe("Phase 5 – Cognitive Goal Pressure", () => {
  it("A/B/C – Status", () => {
    expect(run({ goal }).factors.goalStatus).toBe(1);
    expect(run({ goal: { ...goal, status: "paused" } }).factors.goalStatus).toBe(0);
    expect(run({ goal: { ...goal, status: "completed" } }).factors.goalStatus).toBe(0);
    expect(run({ goal: { ...goal, status: "weird" } }).factors.goalStatus).toBeNull();
  });

  it("D/E/R – Priority nur gelesen, nicht angepasst", () => {
    expect(run({ goal: { ...goal, priority: 0.9 } }).factors.goalPriority).toBe(0.9);
    const g = { ...goal };
    expect(run({ goal: g }).factors.goalPriority).toBe(0.4);
    expect(g.priority).toBe(0.4);
  });

  it("F/G/H/I – Alignment und Contribution getrennt, nur als Eingabe", () => {
    const a = run({ goal, contextAlignment: 0.9, taskContribution: 0.1 });
    expect(a.factors.contextAlignment).toBe(0.9);
    expect(a.factors.taskContribution).toBe(0.1);
    const b = run({ goal, contextAlignment: 0.05, taskContribution: 0.95 });
    expect(b.factors.contextAlignment).toBe(0.05);
    expect(b.factors.taskContribution).toBe(0.95);
    expect(run({ goal }).factors.contextAlignment).toBeNull();
  });

  it("J/K – Recency nur mit explizitem Zeitinput", () => {
    expect(run({ goal, now: NOW }).factors.goalRecency).toBeCloseTo(0.5);
    expect(run({ goal, now: NOW, explicitlyMentionedAt: NOW }).factors.goalRecency).toBe(1);
    expect(run({ goal }).factors.goalRecency).toBeNull();
    expect(
      run({ goal: { ...goal, createdAt: "x", updatedAt: "y" }, now: NOW }).factors.goalRecency,
    ).toBeNull();
    const fresh = run({ goal: { ...goal, priority: 0.1, updatedAt: NOW }, now: NOW });
    expect(fresh.factors.goalRecency).toBe(1);
    expect(fresh.factors.goalPriority).toBe(0.1);
  });

  it("L/M – nur explizite User-Signale", () => {
    const implicit = run({
      goal,
      userSignal: { silence: true, replyLength: 3, emoji: "🔥", strength: 1 },
    });
    expect(implicit.factors.userSignal).toBeNull();
    expect(run({ goal, userSignal: 1 }).factors.userSignal).toBeNull();
    expect(
      run({ goal, userSignal: { kind: "explicit_user_statement", strength: 1 } }).factors
        .userSignal,
    ).toBe(1);
    expect(
      run({ goal, userSignal: { kind: "explicit_user_statement", strength: 0.1 } }).factors
        .userSignal,
    ).toBe(0.1);
  });

  it("N/O/P – NaN, Infinity, clamp", () => {
    const a = run({
      goal: { ...goal, priority: NaN },
      contextAlignment: Infinity,
      taskContribution: 7,
    });
    expect(a.factors.goalPriority).toBeNull();
    expect(a.factors.contextAlignment).toBeNull();
    expect(a.invalidFactors).toEqual(["goalPriority", "contextAlignment"]);
    expect(a.factors.taskContribution).toBe(1);
    expect(run({ goal: { ...goal, priority: -2 } }).factors.goalPriority).toBe(0);
  });

  it("Q – keine Gesamtgewichtung", () => {
    const a = run({
      goal,
      contextAlignment: 1,
      taskContribution: 1,
      now: NOW,
    }) as unknown as Record<string, unknown>;
    expect(a.goalPressure).toBeUndefined();
    expect(a.score).toBeUndefined();
    expect(a.act).toBeUndefined();
  });

  it("R/S – Ziel wird nicht verändert", () => {
    const g = { ...goal };
    const snap = JSON.stringify(g);
    run({
      goal: g,
      contextAlignment: 1,
      userSignal: { kind: "explicit_user_statement", strength: 1 },
      now: NOW,
    });
    expect(JSON.stringify(g)).toBe(snap);
  });

  it("T/U – Provenance unverändert, Inference nie Memory", () => {
    const inf: OrbInformationSource = { type: "inference", sourceIds: ["m1"] };
    const a = run({ goal, source: inf });
    expect(a.provenance).toEqual(inf);
    expect(a.provenance).not.toBe(inf);
    expect(isDirectMemory(a.provenance)).toBe(false);
    expect(a.basedOnInference).toBe(true);
    expect(run({ goal, source: { type: "memory", memoryId: "m2" } }).provenance).toEqual({
      type: "memory",
      memoryId: "m2",
    });
    expect(run({ goal }).provenance).toEqual({ type: "unknown" });
  });

  it("V/W/X/Y – deterministisch, ohne Uhr/Zufall/DB/API/LLM, nicht eingebunden", () => {
    const i = { goal, contextAlignment: 0.3, now: NOW };
    expect(run(i)).toEqual(run(i));
    const src = readFileSync("src/orb-core/cognitive/goal-pressure.ts", "utf8");
    expect(src).not.toMatch(
      /Date\.now|Math\.random|supabase|fetch\(|createServerFn|\.server|insert\(|speak\(|process\.env/,
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
        !f.endsWith("cognitive/goal-pressure.ts") &&
        f !== "src/orb-core/cognitive-observation.ts" &&
        readFileSync(f, "utf8").includes("cognitive/goal-pressure"),
    );
    // Einzige erlaubte Ausnahme: der Cognitive-Observation-Einstieg.
    expect(users).toEqual([]);
  });

  it("Z – bestehende Scores unverändert", () => {
    const before = relevanceScore(0.5, 0.7, 0.3);
    run({ goal, contextAlignment: 1 });
    expect(relevanceScore(0.5, 0.7, 0.3)).toBe(before);
  });
});
