import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  COGNITIVE_KEYS,
  energyFromOrbState,
  isCognitiveImpulse,
  isCognitiveState,
  isDirectMemory,
  isGoalStatus,
  isInformationSource,
  isOrbExperience,
  isOrbGoal,
  isValidGoalPriority,
  normalizeCognitiveState,
  provenanceKind,
  type OrbInformationSource,
} from "@/orb-core/cognitive/foundation";
import { nextState, type OrbState } from "@/orb-core/core";

const goal = {
  id: "g1",
  title: "B2 Griechisch",
  priority: 0.7,
  status: "active",
  createdAt: "2026-09-28T00:00:00Z",
  updatedAt: "2026-09-28T00:00:00Z",
};

describe("Cognitive State", () => {
  it("gültige Werte bleiben erhalten, alle in [0,1]", () => {
    const input = Object.fromEntries(COGNITIVE_KEYS.map((k, i) => [k, i / 10]));
    const { state, invalid } = normalizeCognitiveState(input);
    expect(invalid).toEqual([]);
    expect(isCognitiveState(state)).toBe(true);
    for (const k of COGNITIVE_KEYS) expect(state[k]).toBe(input[k]);
  });

  it("NaN/Infinity/fehlend/außerhalb → sauber behandelt", () => {
    const { state, invalid } = normalizeCognitiveState({
      relevance: Number.NaN,
      novelty: Infinity,
      uncertainty: 1.5,
      goalPressure: -2,
      attention: "x" as unknown as number,
    });
    for (const k of COGNITIVE_KEYS) {
      expect(Number.isFinite(state[k])).toBe(true);
      expect(state[k]).toBeGreaterThanOrEqual(0);
      expect(state[k]).toBeLessThanOrEqual(1);
    }
    expect(state.uncertainty).toBe(1);
    expect(state.goalPressure).toBe(0);
    expect(invalid).toEqual(
      expect.arrayContaining([
        "relevance",
        "novelty",
        "uncertainty",
        "goalPressure",
        "attention",
        "energy",
      ]),
    );
    expect(isCognitiveState({ ...state, novelty: Number.NaN })).toBe(false);
  });

  it("energy nur aus bestehendem OrbState gelesen", () => {
    expect(energyFromOrbState({ energy: 0.42 })).toBe(0.42);
    expect(energyFromOrbState({ energy: Number.NaN })).toBe(0);
  });
});

describe("Goals", () => {
  it("nur active/paused/completed", () => {
    for (const s of ["active", "paused", "completed"]) expect(isGoalStatus(s)).toBe(true);
    for (const s of ["done", "", null, 1]) expect(isGoalStatus(s)).toBe(false);
    expect(isOrbGoal(goal)).toBe(true);
    expect(isOrbGoal({ ...goal, status: "archived" })).toBe(false);
  });

  it("priority validierbar", () => {
    expect(isValidGoalPriority(0)).toBe(true);
    expect(isValidGoalPriority(1)).toBe(true);
    for (const p of [-0.1, 1.1, Number.NaN, Infinity, "0.5"])
      expect(isValidGoalPriority(p)).toBe(false);
    expect(isOrbGoal({ ...goal, priority: 2 })).toBe(false);
  });
});

describe("Provenance", () => {
  const sources: OrbInformationSource[] = [
    { type: "memory", memoryId: "m1" },
    { type: "conversation", messageId: "c1" },
    { type: "inference", sourceIds: ["m1", "c1"] },
    { type: "unknown" },
  ];
  it("unterscheidet alle vier Arten", () => {
    expect(sources.map(provenanceKind)).toEqual([
      "direct_memory",
      "current_conversation",
      "inference",
      "unknown",
    ]);
    for (const s of sources) expect(isInformationSource(s)).toBe(true);
  });
  it("inference braucht sourceIds und ist nie Direct Memory", () => {
    expect(isInformationSource({ type: "inference", sourceIds: [] })).toBe(false);
    expect(isInformationSource({ type: "inference" })).toBe(false);
    expect(isInformationSource({ type: "inference", sourceIds: [""] })).toBe(false);
    expect(isDirectMemory(sources[2])).toBe(false);
    expect(isDirectMemory(sources[0])).toBe(true);
    expect(isInformationSource({ type: "guess" })).toBe(false);
  });
});

describe("Impulse / Experience", () => {
  it("Impulse nur mit definierten Typen", () => {
    for (const t of [
      "knowledge_gap",
      "goal_relevance",
      "novelty",
      "contradiction",
      "experience",
      "follow_up",
    ])
      expect(isCognitiveImpulse({ id: "i", type: t, reason: "r" })).toBe(true);
    expect(isCognitiveImpulse({ id: "i", type: "boredom", reason: "r" })).toBe(false);
    expect(isCognitiveImpulse({ id: "", type: "novelty", reason: "r" })).toBe(false);
    expect(isCognitiveImpulse({ id: "i", type: "novelty" })).toBe(false);
    const impulseType = readFileSync("src/orb-core/cognitive/foundation.ts", "utf8").match(
      /export type OrbCognitiveImpulse = \{[^}]*\}/,
    )![0];
    expect(impulseType).not.toMatch(/score/);
    expect(impulseType).toMatch(/id: string;[\s\S]*type: OrbCognitiveImpulseType;[\s\S]*reason: string;/);
  });
  it("Experience success/usefulness in 0..1", () => {
    const e = { actionId: "a", success: 0.5, usefulness: 1, createdAt: "t" };
    expect(isOrbExperience(e)).toBe(true);
    expect(isOrbExperience({ ...e, success: 1.2 })).toBe(false);
    expect(isOrbExperience({ ...e, usefulness: Number.NaN })).toBe(false);
    expect(isOrbExperience({ ...e, userFeedback: -1 })).toBe(false);
  });
});

describe("Regression: bestehender ORB bleibt unberührt", () => {
  it("kein bestehendes Modul importiert die neue Schicht", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) {
          if (!p.endsWith("cognitive")) walk(p);
        } else if (/\.tsx?$/.test(f) && readFileSync(p, "utf8").includes("cognitive/foundation"))
          hits.push(p);
      }
    };
    walk("src");
    expect(hits).toEqual([]);
  });
  it("nextState/Energy-Berechnung unverändert", () => {
    const s: OrbState = {
      curiosity: 0.6,
      joy: 0.5,
      fear: 0.08,
      trust: 0.4,
      uncertainty: 0.3,
      energy: 0.8,
    };
    const n = nextState(s, { importance: 0.5, isQuestion: false, isLearning: false, recalled: 0 });
    expect(n.energy).toBeCloseTo(0.8 - 0.03 - 0.02, 10);
  });
});
