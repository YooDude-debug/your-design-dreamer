import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { runCognitiveObservation } from "@/orb-core/cognitive-observation";
import {
  COVERAGE_KEYS,
  isCognitiveView,
  layerHasData,
  toCognitiveView,
} from "@/lib/orb-knowledge-graph/cognitive-layers";
import {
  buildCognitiveVisualLayout,
  cognitiveLayerGap,
  cognitiveLayerRadius,
  measureMemoryCoreRadius,
} from "@/lib/orb-knowledge-graph/cognitive-layer-scene";

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
  it("Cognitive-Nodes nutzen kein Rot/Grün/Gelb; Rot bleibt Retrieval vorbehalten", () => {
    expect(scene).not.toMatch(/#b6ff3b|#ffd54a|PULSE_COLOR|PATH_COLOR/);
    expect(scene.match(/#ff2a2a/g)).toHaveLength(1);
    expect(scene).toContain('const RETRIEVAL = new Color("#ff2a2a")');
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

  it("legt echte Cognitive-Nodes auf getrennte Schalen, ohne Memory zu duplizieren", () => {
    const view = toCognitiveView(
      runCognitiveObservation({ path: "chat", memoryIds: ["a", "b"] }),
      at,
    );
    const memoryPositions = [new Vector3(10, 0, 0), new Vector3(0, 10, 0)];
    const layout = buildCognitiveVisualLayout(
      view,
      memoryPositions,
      new Map([
        ["a", 0],
        ["b", 1],
      ]),
      10,
    );
    expect(layout.nodes.some((node) => node.layer === "memory")).toBe(false);
    expect(layout.nodes.filter((node) => node.layer === "candidates")).toHaveLength(2);
    expect(layout.nodes.filter((node) => node.layer === "competition")).toHaveLength(2);
    expect(layout.nodes.filter((node) => node.layer === "snapshot")).toHaveLength(7);
    expect(layout.nodes.filter((node) => node.layer === "strategy")).toHaveLength(8);
    expect(layout.nodes.filter((node) => node.layer === "decision")).toHaveLength(7);
    expect(layout.nodes.filter((node) => node.layer === "action")).toHaveLength(0);
    expect(layout.nodes.filter((node) => node.layer === "outcome")).toHaveLength(0);
    expect(layout.nodes.filter((node) => node.layer === "adaptation")).toHaveLength(0);
  });

  it("leitet Candidate-Positionen radial vom eindeutig zugeordneten Memory ab", () => {
    const view = toCognitiveView(runCognitiveObservation({ path: "chat", memoryIds: ["a"] }), at);
    const layout = buildCognitiveVisualLayout(
      view,
      [new Vector3(6, 8, 0)],
      new Map([["a", 0]]),
      10,
    );
    const candidate = layout.nodes.find((node) => node.layer === "candidates");
    expect(candidate?.position.length()).toBeCloseTo(cognitiveLayerRadius(10, "candidates"));
    expect(candidate?.position.x).toBeCloseTo(cognitiveLayerRadius(10, "candidates") * 0.6);
    expect(candidate?.position.y).toBeCloseTo(cognitiveLayerRadius(10, "candidates") * 0.8);
    expect(candidate?.position.z).toBeCloseTo(0);
    const link = layout.edges.find((edge) => edge.kind === "memory-candidate");
    expect(link?.memoryIndex).toBe(0);
    expect(link?.from.toArray()).toEqual([6, 8, 0]);
  });

  it("misst den tatsächlichen Memory-Core und trennt alle Schalen deutlich", () => {
    const positions = [new Vector3(3, 4, 0), new Vector3(0, 0, 12)];
    const core = measureMemoryCoreRadius(positions, 10);
    expect(core).toBe(12);
    expect(cognitiveLayerGap(core)).toBe(4.2);
    expect(cognitiveLayerRadius(core, "candidates")).toBeCloseTo(16.2);
    expect(cognitiveLayerRadius(core, "competition")).toBeCloseTo(20.4);
    expect(cognitiveLayerRadius(core, "adaptation")).toBeCloseTo(49.8);
  });

  it("setzt sämtliche erzeugten Cognitive-Nodes exakt auf ihren Layer-Radius", () => {
    const view = toCognitiveView(
      runCognitiveObservation({ path: "chat", memoryIds: ["a", "b"] }),
      at,
    );
    const positions = [new Vector3(10, 0, 0), new Vector3(0, 10, 0)];
    const layout = buildCognitiveVisualLayout(
      view,
      positions,
      new Map([
        ["a", 0],
        ["b", 1],
      ]),
      measureMemoryCoreRadius(positions),
    );
    for (const node of layout.nodes)
      expect(node.position.length()).toBeCloseTo(cognitiveLayerRadius(10, node.layer), 5);
  });

  it("erfindet für unbekannte Memory-IDs weder Candidate noch Verbindung", () => {
    const view = toCognitiveView(
      runCognitiveObservation({ path: "chat", memoryIds: ["unknown"] }),
      at,
    );
    const layout = buildCognitiveVisualLayout(
      view,
      [new Vector3(10, 0, 0)],
      new Map([["a", 0]]),
      10,
    );
    expect(layout.nodes.filter((node) => node.layer === "candidates")).toEqual([]);
    expect(layout.edges.filter((edge) => edge.kind === "memory-candidate")).toEqual([]);
    expect(layout.edges.filter((edge) => edge.kind === "competition-pair")).toEqual([]);
  });

  it("bewahrt maximumOverlap und Coverage ohne Ranking oder Auswahl", () => {
    const view = toCognitiveView(
      runCognitiveObservation({ path: "chat", memoryIds: ["a", "b"] }),
      at,
    );
    const layout = buildCognitiveVisualLayout(
      view,
      [new Vector3(10, 0, 0), new Vector3(0, 10, 0)],
      new Map([
        ["a", 0],
        ["b", 1],
      ]),
      10,
    );
    const competition = layout.edges.find((edge) => edge.kind === "competition-pair");
    expect(competition?.intensity).toBe(view?.competitions[0]?.maximumOverlap ?? null);
    const coverage = layout.nodes.filter((node) => node.layer === "decision");
    expect(coverage).toHaveLength(COVERAGE_KEYS.length);
    expect(coverage.every((node) => node.state === "unknown" && node.value === null)).toBe(true);
    expect(JSON.stringify(layout)).not.toMatch(/rank|winner|best|selected/i);
  });

  it("zeichnet nur belegte Beziehungen und keine Kanten zu leeren Layern", () => {
    const view = toCognitiveView(
      runCognitiveObservation({ path: "chat", memoryIds: ["a", "b"] }),
      at,
    );
    const layout = buildCognitiveVisualLayout(
      view,
      [new Vector3(10, 0, 0), new Vector3(0, 10, 0)],
      new Map([
        ["a", 0],
        ["b", 1],
      ]),
      10,
    );
    expect(layout.edges.some((edge) => edge.kind === "memory-candidate")).toBe(true);
    expect(layout.edges.some((edge) => edge.kind === "candidate-competition")).toBe(true);
    expect(layout.edges.some((edge) => edge.kind === "competition-snapshot")).toBe(true);
    expect(layout.edges.some((edge) => edge.kind === "snapshot-strategy")).toBe(false);
    expect(layout.edges.some((edge) => edge.toLayer === "decision")).toBe(false);
    expect(layout.edges.some((edge) => edge.toLayer === "outcome")).toBe(false);
    expect(layout.edges.some((edge) => edge.toLayer === "adaptation")).toBe(false);
  });

  it("aktualisiert Instanzdaten sichtbar und fügt keine Datenquelle hinzu", () => {
    expect(scene).toContain("mesh.instanceMatrix.needsUpdate = true");
    expect(scene).toContain("mesh.instanceColor.needsUpdate = true");
    expect(scene).toContain("measureMemoryCoreRadius(positions");
    expect(scene).toContain("framingRadius(");
    expect(scene).toContain('const RETRIEVAL = new Color("#ff2a2a")');
    expect(scene).toContain("this.retrievalEdges.forEach");
    expect(scene).not.toMatch(/supabase|fetch\(|createServerFn|refetchInterval|setInterval/);
    expect(stage.match(/refetchInterval:/g)).toHaveLength(1);
  });
});
