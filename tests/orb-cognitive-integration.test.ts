import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COGNITIVE_OBSERVATION_MAX_CANDIDATES,
  runCognitiveObservation as run,
} from "@/orb-core/cognitive-observation";
import { isDirectMemory } from "@/orb-core/cognitive/foundation";

const ENTRY = "src/orb-core/cognitive-observation.ts";
const CODE = readFileSync(ENTRY, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
const STRATS = [
  "continue_focus",
  "ask_clarification",
  "explore_gap",
  "resolve_conflict",
  "switch_focus",
  "defer",
  "observe",
  "follow_up",
];
const COVERAGE = [
  "relevanceCoverage",
  "noveltyCoverage",
  "uncertaintyCoverage",
  "goalPressureCoverage",
  "attentionCoverage",
  "experienceCoverage",
  "contradictionCoverage",
];
function srcFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? srcFiles(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}
const observed = (ids: unknown[], path: "chat" | "proactive_question" = "chat") => {
  const r = run({ path, memoryIds: ids });
  if (r.status !== "observed") throw new Error("expected observed");
  return r;
};
function fnBody(name: string): string {
  const start = engine.indexOf(`export async function ${name}(`);
  const next = engine.indexOf("\nexport async function ", start + 10);
  return engine.slice(start, next === -1 ? undefined : next);
}

describe("Cognitive Architecture – ORB-Core-Integration (observational)", () => {
  it("A/B/C – Chatlauf erzeugt Observation aus den abgerufenen Memory-IDs", () => {
    const body = fnBody("processInput");
    expect(body.match(/runCognitiveObservation\(/g)).toHaveLength(1);
    expect(body).toMatch(
      /cognitive: runCognitiveObservation\(\{\s+path: "chat",\s+memoryIds: recalled\.map\(\(r\) => r\.node\.id\),/,
    );
    const r = observed(["m1"]);
    expect(r.kind).toBe("orb.cognitive_observation");
    expect(r.path).toBe("chat");
    expect(r.snapshot.candidates[0].source).toEqual({ type: "memory", memoryId: "m1" });
  });

  it("B2 – autonome Frage: Observation in beiden Rückgabewegen, aus bereits geladenen Lücken", () => {
    const body = fnBody("askProactively");
    expect(body.match(/runCognitiveObservation\(/g)).toHaveLength(2);
    expect(body.match(/memoryIds: ctx\.gaps\.map\(\(g\) => g\.nodeId\)/g)).toHaveLength(2);
    expect(observed(["n1"], "proactive_question").path).toBe("proactive_question");
  });

  it("D/V – Candidates/Snapshot korrekt; mehrere Candidates ohne Auswahl", () => {
    const r = observed(["a", "b", "c", "a", "", 5]);
    expect(r.snapshot.candidates.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(r.snapshot.competitions).toHaveLength(3);
    expect(r.snapshot.currentFocus).toBeNull();
    for (const c of r.decision.candidates)
      for (const k of COVERAGE) expect(c.decisionInputs[k as never]).toBeNull();
    const swapped = observed(["c", "b", "a"]);
    expect(swapped.strategies).toEqual(r.strategies);
    expect(swapped.decision.candidates.map((c) => c.decisionInputs)).toEqual(
      r.decision.candidates.map((c) => c.decisionInputs),
    );
    const big = observed(Array.from({ length: 20 }, (_, i) => `m${i}`));
    expect(big.candidateCount).toBe(COGNITIVE_OBSERVATION_MAX_CANDIDATES);
    expect(big.truncated).toBe(true);
  });

  it("E/F/W – Strategy Assessment und Decision Foundation in fester Reihenfolge", () => {
    const r = observed(["a", "b"]);
    expect(r.strategies.strategies.map((s) => s.type)).toEqual(STRATS);
    expect(r.decision.candidates.map((c) => c.strategy)).toEqual(STRATS);
    const avail = r.strategies.strategies.filter((s) => s.available).map((s) => s.type);
    expect(avail).toEqual(["ask_clarification", "explore_gap", "defer", "observe"]);
    const none = observed([]);
    expect(none.strategies.strategies.filter((s) => s.available).map((s) => s.type)).toEqual([
      "observe",
    ]);
  });

  it("G/H/I/Y – Action Plan, Outcome, Adaptation passiv", () => {
    const r = observed(["a"]);
    expect(r.actionPlans).toEqual([]);
    expect(r.outcome).toBeNull();
    expect(r.adaptation).toBeNull();
    expect(CODE).not.toMatch(/createActionPlan\(|createOutcome\(|assessAdaptation\(/);
  });

  it("J–O – Antwort, Retrieval, Memory, Energy, Curiosity, Autonomy Gate unverändert", () => {
    const readers = srcFiles("src").filter((f) => {
      const t = readFileSync(f, "utf8");
      return /\.cognitive\b/.test(t) && f !== ENTRY;
    });
    expect(readers).toEqual([]);
    expect(engine).toContain("const recalled = selectByLevel(scored, RECALL_LIMIT);");
    expect(engine.match(/runCognitiveObservation\(/g)).toHaveLength(3);
    for (const line of engine.split("\n").filter((l) => l.includes("runCognitiveObservation(")))
      expect(line.trim()).toBe("cognitive: runCognitiveObservation({");
    const importers = srcFiles("src").filter(
      (f) => f !== ENTRY && readFileSync(f, "utf8").includes("cognitive-observation"),
    );
    expect(importers).toEqual([join("src", "orb-core", "engine.server.ts")]);
  });

  it("P/Q/R – keine Nachricht, kein Impuls, kein LLM, keine DB, kein Netzwerk", () => {
    expect(CODE).not.toMatch(
      /supabase|\bdb\b|fetch\(|createServerFn|\.server"|insert\(|update\(|upsert|speak\(|gateway|process\.env|Date\.now|new Date|Math\.random|randomUUID|setTimeout|setInterval|console\./i,
    );
    const imports = [...CODE.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    for (const i of imports) expect(i.startsWith("./cognitive/")).toBe(true);
  });

  it("S/T – fehlende Daten null/unknown, Provenance bleibt Memory-ID", () => {
    const r = observed(["m1"]);
    const c = r.snapshot.candidates[0];
    for (const k of [
      "relevance",
      "novelty",
      "uncertainty",
      "goalPressure",
      "attention",
      "experience",
      "contradiction",
    ])
      expect((c as Record<string, unknown>)[k]).toBeNull();
    expect(c.topic).toBeNull();
    expect(r.snapshot.goals).toEqual([]);
    expect(r.snapshot.experiences).toEqual([]);
    expect(r.snapshot.conflicts).toEqual([]);
    expect(r.snapshot.attentionAvailability).toBeNull();
    expect(isDirectMemory(c.source)).toBe(true);
    expect(r.decision.candidates[0].decisionInputs.relevanceCoverage).toBeNull();
  });

  it("U – deterministisch", () => {
    expect(run({ path: "chat", memoryIds: ["a", "b"] })).toEqual(
      run({ path: "chat", memoryIds: ["a", "b"] }),
    );
  });

  it("X – Coverage bleibt Coverage (keine Dimensionsnamen in Decision Inputs)", () => {
    const d = observed(["a"]).decision.candidates[0].decisionInputs as Record<string, unknown>;
    for (const k of [
      "relevance",
      "novelty",
      "uncertainty",
      "goalPressure",
      "attention",
      "experience",
      "contradiction",
    ])
      expect(k in d).toBe(false);
  });

  it("U2 – Fehler blockieren ORB nicht und erfinden nichts", () => {
    const evil = {
      path: "chat" as const,
      get memoryIds(): unknown[] {
        throw new Error("boom");
      },
    };
    expect(run(evil)).toEqual({
      kind: "orb.cognitive_observation",
      status: "failed",
      path: "chat",
    });
    expect(run(null as never).status).toBe("observed");
    const throwing = [
      {
        toString() {
          throw new Error("x");
        },
      },
    ];
    expect(() => run({ path: "chat", memoryIds: throwing })).not.toThrow();
  });
});
