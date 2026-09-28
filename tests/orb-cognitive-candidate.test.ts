import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { createCognitiveCandidate } from "@/orb-core/cognitive/candidate";
import * as candidateModule from "@/orb-core/cognitive/candidate";
import { assessCognitiveRelevance } from "@/orb-core/cognitive/relevance";
import { assessCognitiveNovelty } from "@/orb-core/cognitive/novelty";
import { assessCognitiveUncertainty } from "@/orb-core/cognitive/uncertainty";
import { assessCognitiveGoalPressure } from "@/orb-core/cognitive/goal-pressure";
import { assessCognitiveAttention } from "@/orb-core/cognitive/attention";
import { assessCognitiveExperience } from "@/orb-core/cognitive/experience";
import { detectContradiction } from "@/orb-core/cognitive/contradiction";
import { isDirectMemory, energyFromOrbState } from "@/orb-core/cognitive/foundation";

const dims = () => ({
  relevance: assessCognitiveRelevance({ factors: { context: 0.9 } }),
  novelty: assessCognitiveNovelty({ statement: "ORB nutzt Retrieval", known: [] }),
  uncertainty: assessCognitiveUncertainty({ source: { type: "memory", memoryId: "m1" } }),
  goalPressure: assessCognitiveGoalPressure({ contextAlignment: 0.3 }),
  attention: assessCognitiveAttention({ attentionAvailability: 0.2 }),
  experience: assessCognitiveExperience({ actionId: "a1" }),
  contradiction: detectContradiction(
    { subject: "ORB", predicate: "ist", value: "a" },
    { subject: "ORB", predicate: "ist", value: "b" },
  ),
});
const full = () => ({
  id: "c1",
  topic: "ORB Memory Retrieval",
  description: "offene Frage",
  source: { type: "memory" as const, memoryId: "m1" },
  ...dims(),
});
const SRC = readFileSync("src/orb-core/cognitive/candidate.ts", "utf8");
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "");

describe("Phase 9 – Cognitive Candidate", () => {
  it("A/F – vollständiger Candidate mit allen Dimensionen", () => {
    const c = createCognitiveCandidate(full());
    expect(c).toEqual(full());
  });

  it("B/C/D/E – nur Topic + Source, Rest null", () => {
    const c = createCognitiveCandidate({ topic: "X", source: { type: "unknown" } });
    expect(c.topic).toBe("X");
    expect(c.id).toBeNull();
    expect(c.description).toBeNull();
    expect(createCognitiveCandidate({}).topic).toBeNull();
    expect(createCognitiveCandidate({}).source).toEqual({ type: "unknown" });
  });

  it("G – fehlende Dimension bleibt null, nicht ergänzt", () => {
    const { novelty: _n, ...rest } = full();
    const c = createCognitiveCandidate(rest);
    expect(c.novelty).toBeNull();
    expect(createCognitiveCandidate({ topic: "t" }).relevance).toBeNull();
  });

  it("H–N – Dimensionen exakt unverändert (tiefe Kopie)", () => {
    const i = full();
    const c = createCognitiveCandidate(i);
    for (const k of [
      "relevance",
      "novelty",
      "uncertainty",
      "goalPressure",
      "attention",
      "experience",
      "contradiction",
    ] as const) {
      expect(c[k]).toEqual(i[k]);
      expect(c[k]).not.toBe(i[k]);
    }
  });

  it("O/P – Source unverändert, Inference bleibt Inference", () => {
    const src = { type: "inference" as const, sourceIds: ["m1", "m2"] };
    const c = createCognitiveCandidate({ source: src });
    expect(c.source).toEqual(src);
    expect(c.source).not.toBe(src);
    expect(isDirectMemory(c.source)).toBe(false);
    expect(createCognitiveCandidate({ source: { type: "memory" } }).source).toEqual({
      type: "unknown",
    });
  });

  it("Q–V – kein Score, keine Verrechnung, kein Ranking/Auswahl", () => {
    const c = createCognitiveCandidate(full()) as unknown as Record<string, unknown>;
    for (const k of [
      "score",
      "cognitiveScore",
      "overallScore",
      "priorityScore",
      "attentionScore",
      "priority",
    ])
      expect(c[k]).toBeUndefined();
    expect(Object.keys(candidateModule).sort()).toEqual(["createCognitiveCandidate"]);
    expect(CODE).not.toMatch(/[^=!<>]\s[+*/]\s|\+=|\*=|Math\.|sort\(|reduce\(|rank|select|best/i);
  });

  it("W/X/Y/Z/AC/AD – keine ID-Erzeugung, Uhr, Zufall, DB/API/LLM, Learning, Aktion", () => {
    expect(createCognitiveCandidate({}).id).toBeNull();
    expect(CODE).not.toMatch(
      /randomUUID|Date\.now|new Date|Math\.random|supabase|fetch\(|createServerFn|\.server"|insert\(|speak\(|process\.env|learn/i,
    );
  });

  it("AA – Input wird nicht mutiert", () => {
    const i = full();
    const before = structuredClone(i);
    const c = createCognitiveCandidate(i);
    (c.relevance as { factors: { context: number } }).factors.context = 0;
    expect(i).toEqual(before);
  });

  it("AB – deterministisch", () => {
    expect(createCognitiveCandidate(full())).toEqual(createCognitiveCandidate(full()));
  });

  it("AE – Phase 1–8 unverändert, candidate.ts nirgends importiert", () => {
    const before = dims();
    createCognitiveCandidate(full());
    expect(dims()).toEqual(before);
    expect(energyFromOrbState({ energy: 0.4 })).toBe(0.4);
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
        !f.endsWith("cognitive/candidate.ts") &&
        readFileSync(f, "utf8").includes("cognitive/candidate"),
    );
    expect(users).toEqual([]);
  });
});
