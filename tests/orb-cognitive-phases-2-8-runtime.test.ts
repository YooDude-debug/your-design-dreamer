import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runCognitiveObservation as run } from "@/orb-core/cognitive-observation";
import { SOURCE_UNCERTAINTY } from "@/orb-core/cognitive/uncertainty";

const ENTRY = readFileSync("src/orb-core/cognitive-observation.ts", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
const NULL_DIMS = [
  "relevance",
  "novelty",
  "goalPressure",
  "attention",
  "experience",
  "contradiction",
];

const obs = (ids: unknown[], path: "chat" | "proactive_question" = "chat") => {
  const r = run({ path, memoryIds: ids });
  if (r.status !== "observed") throw new Error("expected observed");
  return r;
};

describe("Phasen 2–8 im Runtimepfad (passiv)", () => {
  it("A – Chat mit Memory-IDs: Uncertainty nur aus Herkunft", () => {
    const c = obs(["m1", "m2"]).snapshot.candidates;
    expect(c).toHaveLength(2);
    for (const x of c) {
      expect(x.uncertainty?.factors).toEqual({
        sourceCertainty: SOURCE_UNCERTAINTY.memory,
        sourceAgreement: null,
        contradiction: null,
        inferenceDependency: 0,
        recencyUncertainty: null,
        missingEvidence: 0,
      });
      expect(x.uncertainty?.contradictions).toEqual([]);
      expect(x.uncertainty?.agreeingSources).toEqual([]);
    }
  });

  it("B – Chat ohne Memory-IDs: keine Candidates, keine Dimensionen", () => {
    const r = obs([]);
    expect(r.snapshot.candidates).toEqual([]);
    expect(r.decision.candidates.every((d) => d.decisionInputs.uncertaintyCoverage === null)).toBe(
      true,
    );
  });

  it("C – Proactive mit Gap-IDs: nur Kandidatenreferenz, keine Erfahrung/Ziel/Fokus", () => {
    const r = obs(["gap-node-1"], "proactive_question");
    const c = r.snapshot.candidates[0];
    expect(c.source).toEqual({ type: "memory", memoryId: "gap-node-1" });
    for (const k of NULL_DIMS) expect((c as Record<string, unknown>)[k]).toBeNull();
    expect(c.topic).toBeNull();
    expect(c.description).toBeNull();
  });

  it("D/E/F/G – fehlende Informationen bleiben null, nichts erfunden", () => {
    const r = obs(["a", "b"]);
    for (const c of r.snapshot.candidates)
      for (const k of NULL_DIMS) expect((c as Record<string, unknown>)[k]).toBeNull();
    expect(r.snapshot.goals).toEqual([]);
    expect(r.snapshot.experiences).toEqual([]);
    expect(r.snapshot.conflicts).toEqual([]);
    expect(r.snapshot.currentFocus).toBeNull();
    expect(r.snapshot.attentionAvailability).toBeNull();
  });

  it("H – Provenienz: Memory bleibt Memory, keine Inference", () => {
    const c = obs(["m1"]).snapshot.candidates[0];
    expect(c.uncertainty?.provenance).toEqual({ type: "memory", memoryId: "m1" });
    expect(c.uncertainty?.basedOnInference).toBe(false);
  });

  it("I – Phase 4 wird im Orchestrator tatsächlich aufgerufen; 2/3/5/6/7/8 nicht", () => {
    expect(ENTRY).toMatch(/assessCognitiveUncertainty\(/);
    for (const fn of [
      "assessCognitiveRelevance",
      "assessCognitiveNovelty",
      "assessCognitiveGoalPressure",
      "assessCognitiveAttention",
      "assessCognitiveExperience",
      "detectContradiction",
    ])
      expect(ENTRY).not.toContain(fn);
  });

  it("J/K – kein DB-, Netzwerk-, Modell- oder Uhrzugriff im Orchestrator", () => {
    for (const p of [
      /fetch\(/,
      /supabase/i,
      /\bdb\./,
      /Date\.now|new Date/,
      /Math\.random/,
      /llm/i,
    ])
      expect(ENTRY).not.toMatch(p);
  });

  it("L – Engine-Aufrufe unverändert; keine Cognitive-Phase direkt in der Engine", () => {
    expect(engine.match(/runCognitiveObservation\(/g)).toHaveLength(3);
    expect(engine).not.toMatch(/from "@\/orb-core\/cognitive\//);
  });

  it("M – Phase 9–14 bleiben funktional (Coverage bei genau einem Candidate)", () => {
    const one = obs(["a"]);
    expect(one.decision.candidates[0].decisionInputs.uncertaintyCoverage).toBe(0.5);
    expect(one.decision.candidates[0].decisionInputs.relevanceCoverage).toBeNull();
    expect(one.actionPlans.length).toBeGreaterThan(0);
    const two = obs(["a", "b"]);
    expect(two.decision.candidates[0].decisionInputs.uncertaintyCoverage).toBeNull();
    expect(run({ path: "chat", memoryIds: ["a"] })).toEqual(
      run({ path: "chat", memoryIds: ["a"] }),
    );
  });
});
