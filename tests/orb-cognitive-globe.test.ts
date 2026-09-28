import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { runCognitiveObservation } from "@/orb-core/cognitive-observation";
import {
  COVERAGE_KEYS,
  isCognitiveView,
  layerHasData,
  toCognitiveView,
} from "@/lib/orb-knowledge-graph/cognitive-layers";

const at = "2026-09-28T00:00:00.000Z";
const scene = readFileSync("src/lib/orb-knowledge-graph/cognitive-layer-scene.ts", "utf8");
const mapper = readFileSync("src/lib/orb-knowledge-graph/cognitive-layers.ts", "utf8");
const stage = readFileSync("src/components/orb-knowledge-graph/KnowledgeGraphStage.tsx", "utf8");

describe("Cognitive Globe – Mapping", () => {
  it("ohne/ungültige/fehlgeschlagene Daten → null, kein Fehler", () => {
    expect(toCognitiveView(undefined, at)).toBeNull();
    expect(toCognitiveView({ kind: "x" }, at)).toBeNull();
    expect(
      toCognitiveView({ kind: "orb.cognitive_observation", status: "failed", path: "chat" }, at),
    ).toBeNull();
    expect(layerHasData(null, "candidates")).toBe(false);
    expect(layerHasData(null, "memory")).toBe(true);
  });

  it("null bleibt null; Outcome/Adaptation leer; keine Faktoren erfunden", () => {
    const v = toCognitiveView(
      runCognitiveObservation({ path: "chat", memoryIds: ["a", "b"] }),
      at,
    )!;
    expect(isCognitiveView(v)).toBe(true);
    expect(v.outcome).toBeNull();
    expect(v.adaptation).toBeNull();
    expect(v.snapshot.attentionAvailability).toBeNull();
    expect(v.candidates.every((c) => Object.values(c.factors).every((f) => f === false))).toBe(
      true,
    );
    expect(layerHasData(v, "factors")).toBe(false);
    expect(layerHasData(v, "action")).toBe(false);
    expect(layerHasData(v, "outcome")).toBe(false);
    expect(layerHasData(v, "adaptation")).toBe(false);
  });

  it("mehrere Candidates: Reihenfolge erhalten, kein Ranking, maximumOverlap bleibt", () => {
    const v = toCognitiveView(
      runCognitiveObservation({ path: "chat", memoryIds: ["c", "a", "b"] }),
      at,
    )!;
    expect(v.candidates.map((c) => c.memoryId)).toEqual(["c", "a", "b"]);
    expect(v.competitions).toHaveLength(3);
    for (const c of v.competitions) {
      expect(Object.keys(c).sort()).toEqual(
        ["leftCandidateId", "maximumOverlap", "rightCandidateId"].sort(),
      );
    }
    expect(JSON.stringify(v)).not.toMatch(/"score"|rank|winner|best/i);
  });

  it("Coverage bleibt Coverage und ist bei mehreren Candidates null", () => {
    const v = toCognitiveView(
      runCognitiveObservation({ path: "chat", memoryIds: ["a", "b"] }),
      at,
    )!;
    for (const k of COVERAGE_KEYS) expect(v.coverage[k]).toBeNull();
    expect(Object.keys(v.coverage)).toEqual([...COVERAGE_KEYS]);
  });

  it("autonome Frage bleibt als Pfad markiert", () => {
    const v = toCognitiveView(
      runCognitiveObservation({ path: "proactive_question", memoryIds: ["g"] }),
      at,
    )!;
    expect(v.path).toBe("proactive_question");
  });
});

describe("Cognitive Globe – Darstellungsgrenzen", () => {
  it("Cognitive-Ebenen nutzen kein Rot/Grün/Gelb", () => {
    expect(scene).not.toMatch(/#ff2a2a|#b6ff3b|#ffd54a|RETRIEVAL_COLOR|PULSE_COLOR|PATH_COLOR/);
  });
  it("kein Score, kein LLM, keine DB, kein Polling in der Darstellungsschicht", () => {
    for (const src of [scene, mapper]) {
      expect(src).not.toMatch(/supabase|fetch\(|createServerFn|refetchInterval|setInterval/);
      expect(src).not.toMatch(/\bscore\b\s*:/);
    }
    expect(stage.match(/refetchInterval:/g)).toHaveLength(1);
  });
  it("wahrt UI → SDK-Grenze", () => {
    expect(mapper).not.toMatch(/from\s+["']@\/orb-core\//);
    expect(scene).not.toMatch(/from\s+["']@\/orb-core\//);
  });
});
