/**
 * Cognitive Globe – konzentrische Ebenen (three.js, nur Darstellung).
 *
 * Das reine Layout wird ausschließlich aus CognitiveView und den bestehenden
 * Memory-Positionen abgeleitet. Memory-Nodes und Memory-Kanten werden weder
 * erzeugt noch verändert. Unbekannte Zuordnungen bleiben unsichtbar.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

import {
  COGNITIVE_FACTOR_KEYS,
  COGNITIVE_LAYERS,
  COVERAGE_KEYS,
  STRATEGY_KEYS,
  layerHasData,
  type CognitiveLayerId,
  type CognitiveView,
} from "./cognitive-layers";

export const MIN_LAYER_GAP = 3.5;
export const LAYER_GAP_RATIO = 0.35;
const PRESENT = new Color("#e8ecf2");
const UNAVAILABLE = new Color("#747d8c");
const UNKNOWN = new Color("#343b46");
const RING_EMPTY = new Color("#3a404a");
const RING_DATA = new Color("#9aa4b4");
const RETRIEVAL = new Color("#ff2a2a");

/** Visuelle Reihenfolge: Candidate ist die erste Schale über dem Memory Core. */
const RADIAL_ORDER: CognitiveLayerId[] = [
  "memory",
  "candidates",
  "competition",
  "snapshot",
  "factors",
  "strategy",
  "decision",
  "action",
  "outcome",
  "adaptation",
];

export type CognitiveNodeState = "present" | "unavailable" | "unknown";

export type CognitiveVisualNode = {
  id: string;
  layer: CognitiveLayerId;
  position: Vector3;
  state: CognitiveNodeState;
  /** Unveränderter Datenwert; nur Competition/Coverage tragen Werte. */
  value: number | null;
};

export type CognitiveVisualEdge = {
  id: string;
  fromLayer: CognitiveLayerId;
  toLayer: CognitiveLayerId;
  from: Vector3;
  to: Vector3;
  /** Nur Competition führt maximumOverlap; null bleibt unknown. */
  intensity: number | null;
  kind:
    | "memory-candidate"
    | "candidate-competition"
    | "competition-pair"
    | "competition-snapshot"
    | "candidate-snapshot"
    | "strategy-action";
  memoryIndex?: number;
};

export type CognitiveVisualLayout = {
  nodes: CognitiveVisualNode[];
  edges: CognitiveVisualEdge[];
};

/** Tatsächlicher Radius der vorhandenen Memory-Positionen. */
export function measureMemoryCoreRadius(positions: readonly Vector3[], fallback = 1): number {
  let radius = 0;
  for (const position of positions) radius = Math.max(radius, position.length());
  return radius > 0 ? radius : fallback;
}

/** Sichtbarer Abstand, proportional zum realen Memory-Core und nie zu knapp. */
export function cognitiveLayerGap(memoryCoreRadius: number): number {
  return Math.max(MIN_LAYER_GAP, memoryCoreRadius * LAYER_GAP_RATIO);
}

/** Radius der Schale i (0 = Memory Core). */
export function layerRadius(base: number, layerIndex: number): number {
  return base + layerIndex * cognitiveLayerGap(base);
}

export function cognitiveLayerRadius(base: number, layer: CognitiveLayerId): number {
  return layerRadius(base, Math.max(0, RADIAL_ORDER.indexOf(layer)));
}

/** Gleichmäßig verteilte Schalenpositionen (feste Reihenfolge, keine Wertung). */
function ringPoint(r: number, i: number, n: number, tilt: number): Vector3 {
  const a = (i / Math.max(1, n)) * Math.PI * 2;
  return new Vector3(
    Math.cos(a) * r,
    Math.sin(a) * r * Math.sin(tilt),
    Math.sin(a) * r * Math.cos(tilt),
  );
}

function radialPoint(source: Vector3, radius: number): Vector3 | null {
  if (source.lengthSq() === 0) return null;
  return source.clone().normalize().multiplyScalar(radius);
}

/**
 * Reines, testbares Darstellungsmodell. Es enthält nur Beziehungen, die aus
 * der kompakten Observation oder einer exakten Memory-ID-Zuordnung hervorgehen.
 */
export function buildCognitiveVisualLayout(
  view: CognitiveView | null,
  positions: readonly Vector3[],
  memoryIndex: ReadonlyMap<string, number>,
  base: number,
): CognitiveVisualLayout {
  const nodes: CognitiveVisualNode[] = [];
  const edges: CognitiveVisualEdge[] = [];
  if (!view) return { nodes, edges };

  const nodeById = new Map<string, CognitiveVisualNode>();
  const addNode = (node: CognitiveVisualNode) => {
    nodes.push(node);
    nodeById.set(node.id, node);
  };
  const memoryDirection = (memoryId: string | null) => {
    const index = memoryId ? memoryIndex.get(memoryId) : undefined;
    if (index === undefined) return null;
    const position = positions[index];
    if (!position) return null;
    return { index, position };
  };

  const candidateRadius = cognitiveLayerRadius(base, "candidates");
  view.candidates.forEach((candidate, candidateIndex) => {
    const memory = memoryDirection(candidate.memoryId);
    const position = memory ? radialPoint(memory.position, candidateRadius) : null;
    if (!memory || !position) return;
    const candidateId = `candidate:${candidate.id ?? candidateIndex}`;
    addNode({ id: candidateId, layer: "candidates", position, state: "present", value: null });
    edges.push({
      id: `memory-candidate:${candidateIndex}`,
      fromLayer: "memory",
      toLayer: "candidates",
      from: memory.position.clone(),
      to: position.clone(),
      intensity: null,
      kind: "memory-candidate",
      memoryIndex: memory.index,
    });

    const factorRadius = cognitiveLayerRadius(base, "factors");
    COGNITIVE_FACTOR_KEYS.forEach((key, factorIndex) => {
      if (!candidate.factors[key]) return;
      const factorPosition = radialPoint(memory.position, factorRadius);
      if (!factorPosition) return;
      const tangent = new Vector3(-factorPosition.z, 0, factorPosition.x).normalize();
      factorPosition.addScaledVector(tangent, (factorIndex - 3) * 0.13);
      factorPosition.normalize().multiplyScalar(factorRadius);
      addNode({
        id: `factor:${candidateIndex}:${key}`,
        layer: "factors",
        position: factorPosition,
        state: "present",
        value: null,
      });
    });
  });

  const competitionRadius = cognitiveLayerRadius(base, "competition");
  view.competitions.forEach((competition, competitionIndex) => {
    const leftCandidate = nodeById.get(`candidate:${competition.leftCandidateId}`);
    const rightCandidate = nodeById.get(`candidate:${competition.rightCandidateId}`);
    if (!leftCandidate || !rightCandidate) return;
    const leftPosition = radialPoint(leftCandidate.position, competitionRadius);
    const rightPosition = radialPoint(rightCandidate.position, competitionRadius);
    if (!leftPosition || !rightPosition) return;
    const leftId = `competition:${competitionIndex}:left`;
    const rightId = `competition:${competitionIndex}:right`;
    addNode({
      id: leftId,
      layer: "competition",
      position: leftPosition,
      state: competition.maximumOverlap === null ? "unknown" : "present",
      value: competition.maximumOverlap,
    });
    addNode({
      id: rightId,
      layer: "competition",
      position: rightPosition,
      state: competition.maximumOverlap === null ? "unknown" : "present",
      value: competition.maximumOverlap,
    });
    edges.push(
      {
        id: `candidate-competition:${competitionIndex}:left`,
        fromLayer: "candidates",
        toLayer: "competition",
        from: leftCandidate.position.clone(),
        to: leftPosition.clone(),
        intensity: null,
        kind: "candidate-competition",
      },
      {
        id: `candidate-competition:${competitionIndex}:right`,
        fromLayer: "candidates",
        toLayer: "competition",
        from: rightCandidate.position.clone(),
        to: rightPosition.clone(),
        intensity: null,
        kind: "candidate-competition",
      },
      {
        id: `competition-pair:${competitionIndex}`,
        fromLayer: "competition",
        toLayer: "competition",
        from: leftPosition.clone(),
        to: rightPosition.clone(),
        intensity: competition.maximumOverlap,
        kind: "competition-pair",
      },
    );
  });

  const snapshotRadius = cognitiveLayerRadius(base, "snapshot");
  const snapshotEntries = [
    ["currentFocus", view.snapshot.currentFocus !== null],
    ["attentionAvailability", view.snapshot.attentionAvailability !== null],
    ["candidates", view.candidates.length > 0],
    ["competitions", view.competitions.length > 0],
    ["goals", view.snapshot.goals > 0],
    ["experiences", view.snapshot.experiences > 0],
    ["conflicts", view.snapshot.conflicts > 0],
  ] as const;
  snapshotEntries.forEach(([key, present], index) =>
    addNode({
      id: `snapshot:${key}`,
      layer: "snapshot",
      position: ringPoint(snapshotRadius, index, snapshotEntries.length, 0.35),
      state: present ? "present" : "unknown",
      value: null,
    }),
  );

  const snapshotCandidates = nodeById.get("snapshot:candidates");
  if (snapshotCandidates?.state === "present") {
    for (const candidate of nodes.filter((node) => node.layer === "candidates")) {
      edges.push({
        id: `${candidate.id}-snapshot:candidates`,
        fromLayer: "candidates",
        toLayer: "snapshot",
        from: candidate.position.clone(),
        to: snapshotCandidates.position.clone(),
        intensity: null,
        kind: "candidate-snapshot",
      });
    }
  }
  const snapshotCompetitions = nodeById.get("snapshot:competitions");
  if (snapshotCompetitions?.state === "present") {
    for (const competition of nodes.filter((node) => node.layer === "competition")) {
      edges.push({
        id: `${competition.id}-snapshot:competitions`,
        fromLayer: "competition",
        toLayer: "snapshot",
        from: competition.position.clone(),
        to: snapshotCompetitions.position.clone(),
        intensity: null,
        kind: "competition-snapshot",
      });
    }
  }

  const strategyRadius = cognitiveLayerRadius(base, "strategy");
  const strategies = STRATEGY_KEYS.map((key) =>
    view.strategies.find((item) => item.type === key),
  ).filter((item): item is CognitiveView["strategies"][number] => item !== undefined);
  strategies.forEach((strategy) => {
    const slot = STRATEGY_KEYS.indexOf(strategy.type as (typeof STRATEGY_KEYS)[number]);
    addNode({
      id: `strategy:${strategy.type}`,
      layer: "strategy",
      position: ringPoint(strategyRadius, slot, STRATEGY_KEYS.length, 0.35),
      state: strategy.available ? "present" : "unavailable",
      value: null,
    });
  });
  const decisionRadius = cognitiveLayerRadius(base, "decision");
  COVERAGE_KEYS.forEach((key, index) => {
    const coverage = view.coverage[key];
    addNode({
      id: `coverage:${key}`,
      layer: "decision",
      position: ringPoint(decisionRadius, index, COVERAGE_KEYS.length, 0.35),
      state: coverage === null ? "unknown" : "present",
      value: coverage,
    });
  });

  const actionRadius = cognitiveLayerRadius(base, "action");
  view.actionPlans.forEach((action, index) => {
    const actionNode: CognitiveVisualNode = {
      id: `action:${index}:${action.action}`,
      layer: "action",
      position: ringPoint(actionRadius, index, view.actionPlans.length, 0.35),
      state: action.executable ? "present" : "unavailable",
      value: null,
    };
    addNode(actionNode);
    const strategy = nodeById.get(`strategy:${action.strategy}`);
    if (!strategy) return;
    edges.push({
      id: `${strategy.id}-${actionNode.id}`,
      fromLayer: "strategy",
      toLayer: "action",
      from: strategy.position.clone(),
      to: actionNode.position.clone(),
      intensity: null,
      kind: "strategy-action",
    });
  });

  return { nodes, edges };
}

type RenderedEdgeGroup = {
  object: LineSegments;
  fromLayer: CognitiveLayerId;
  toLayer: CognitiveLayerId;
  baseOpacity: number;
};

export class CognitiveLayerScene {
  readonly root = new Group();
  private layers = new Map<CognitiveLayerId, Group>();
  private renderedEdges: RenderedEdgeGroup[] = [];
  private retrievalLines: LineSegments | null = null;
  private retrievalEdges: CognitiveVisualEdge[] = [];

  private memoryCoreRadius: number;

  constructor(private fallbackBase: number) {
    this.memoryCoreRadius = fallbackBase;
  }

  /** Neu aufbauen – nur bei neuer Observation oder neuer Memory-Struktur. */
  build(
    view: CognitiveView | null,
    positions: readonly Vector3[],
    index: ReadonlyMap<string, number>,
  ): void {
    this.clear();
    this.memoryCoreRadius = measureMemoryCoreRadius(positions, this.fallbackBase);
    const layout = buildCognitiveVisualLayout(view, positions, index, this.memoryCoreRadius);

    for (const layer of COGNITIVE_LAYERS) {
      if (layer.id === "memory") continue;
      const group = new Group();
      const radius = cognitiveLayerRadius(this.memoryCoreRadius, layer.id);
      group.add(this.ring(radius, 0.35, layerHasData(view, layer.id)));
      const nodes = layout.nodes.filter((node) => node.layer === layer.id);
      if (nodes.length) group.add(this.markers(nodes));
      this.layers.set(layer.id, group);
      this.root.add(group);
    }

    this.retrievalEdges = layout.edges.filter((edge) => edge.kind === "memory-candidate");
    if (this.retrievalEdges.length) {
      this.retrievalLines = this.edgeLines(this.retrievalEdges, 0.32);
      this.layers.get("candidates")?.add(this.retrievalLines);
    }

    const relationEdges = layout.edges.filter((edge) => edge.kind !== "memory-candidate");
    const groups = new Map<string, CognitiveVisualEdge[]>();
    for (const edge of relationEdges) {
      const key = `${edge.fromLayer}:${edge.toLayer}`;
      const list = groups.get(key) ?? [];
      list.push(edge);
      groups.set(key, list);
    }
    for (const edges of groups.values()) {
      const first = edges[0];
      if (!first) continue;
      const object = this.edgeLines(edges, first.kind === "competition-pair" ? 0.8 : 0.3);
      this.root.add(object);
      this.renderedEdges.push({
        object,
        fromLayer: first.fromLayer,
        toLayer: first.toLayer,
        baseOpacity: object.material instanceof LineBasicMaterial ? object.material.opacity : 1,
      });
    }
  }

  /** Äusserster aktuell sichtbarer Ring; Fokus rahmt Core plus gewählte Ebene. */
  framingRadius(visible: ReadonlySet<CognitiveLayerId>, focus: CognitiveLayerId | null): number {
    if (focus) return Math.max(this.memoryCoreRadius, cognitiveLayerRadius(this.memoryCoreRadius, focus));
    let radius = this.memoryCoreRadius;
    for (const layer of visible)
      radius = Math.max(radius, cognitiveLayerRadius(this.memoryCoreRadius, layer));
    return radius;
  }

  getMemoryCoreRadius(): number {
    return this.memoryCoreRadius;
  }

  /** Aktivierungspfad Memory → Candidate, nur aus echtem Retrieval-Event. */
  update(retrievalPulse: Float32Array): void {
    if (!this.retrievalLines) return;
    const color = this.retrievalLines.geometry.getAttribute("color");
    if (!(color instanceof BufferAttribute)) return;
    const values = color.array as Float32Array;
    this.retrievalEdges.forEach((edge, edgeIndex) => {
      const pulse = edge.memoryIndex === undefined ? 0 : (retrievalPulse[edge.memoryIndex] ?? 0);
      const displayed = UNAVAILABLE.clone().lerp(RETRIEVAL, pulse);
      values.set(
        [displayed.r, displayed.g, displayed.b, displayed.r, displayed.g, displayed.b],
        edgeIndex * 6,
      );
    });
    color.needsUpdate = true;
  }

  setVisibility(visible: ReadonlySet<CognitiveLayerId>, focus: CognitiveLayerId | null): void {
    for (const [id, group] of this.layers) {
      group.visible = visible.has(id) || focus === id;
      this.setGroupOpacity(group, focus === null || focus === id ? 1 : 0.16);
    }
    for (const edge of this.renderedEdges) {
      const endpointsVisible =
        (visible.has(edge.fromLayer) || focus === edge.fromLayer) &&
        (visible.has(edge.toLayer) || focus === edge.toLayer);
      edge.object.visible = endpointsVisible;
      const material = edge.object.material;
      if (material instanceof LineBasicMaterial) {
        const relevant = focus === null || focus === edge.fromLayer || focus === edge.toLayer;
        material.opacity = edge.baseOpacity * (relevant ? 1 : 0.1);
      }
    }
  }

  private setGroupOpacity(group: Group, multiplier: number): void {
    group.traverse((object) => {
      if (
        !(
          object instanceof InstancedMesh ||
          object instanceof LineLoop ||
          object instanceof LineSegments
        )
      )
        return;
      const material = object.material;
      if (!(material instanceof MeshBasicMaterial || material instanceof LineBasicMaterial)) return;
      const baseOpacity =
        typeof material.userData.baseOpacity === "number"
          ? material.userData.baseOpacity
          : material.opacity;
      material.userData.baseOpacity = baseOpacity;
      material.opacity = baseOpacity * multiplier;
    });
  }

  private ring(radius: number, tilt: number, hasData: boolean): LineLoop {
    const count = 128;
    const points = new Float32Array(count * 3);
    for (let index = 0; index < count; index++)
      points.set(ringPoint(radius, index, count, tilt).toArray(), index * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(points, 3));
    const material = new LineBasicMaterial({
      color: hasData ? RING_DATA : RING_EMPTY,
      transparent: true,
      opacity: hasData ? 0.55 : 0.25,
    });
    material.userData.baseOpacity = material.opacity;
    return new LineLoop(geometry, material);
  }

  private markers(nodes: CognitiveVisualNode[]): InstancedMesh {
    const material = new MeshBasicMaterial({ transparent: true, opacity: 0.95 });
    material.userData.baseOpacity = material.opacity;
    const mesh = new InstancedMesh(new SphereGeometry(1, 12, 12), material, nodes.length);
    const matrix = new Matrix4();
    nodes.forEach((node, index) => {
      const size = node.layer === "candidates" || node.layer === "strategy" ? 0.56 : 0.48;
      matrix.compose(node.position, new Quaternion(), new Vector3(size, size, size));
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(
        index,
        node.state === "present" ? PRESENT : node.state === "unavailable" ? UNAVAILABLE : UNKNOWN,
      );
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  private edgeLines(edges: CognitiveVisualEdge[], opacity: number): LineSegments {
    const positions = new Float32Array(edges.length * 6);
    const colors = new Float32Array(edges.length * 6);
    edges.forEach((edge, index) => {
      positions.set(
        [edge.from.x, edge.from.y, edge.from.z, edge.to.x, edge.to.y, edge.to.z],
        index * 6,
      );
      const color =
        edge.intensity === null
          ? UNAVAILABLE
          : PRESENT.clone().multiplyScalar(0.2 + 0.8 * edge.intensity);
      colors.set([color.r, color.g, color.b, color.r, color.g, color.b], index * 6);
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    const material = new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
      blending: AdditiveBlending,
    });
    material.userData.baseOpacity = opacity;
    return new LineSegments(geometry, material);
  }

  private clear(): void {
    this.root.traverse((object) => {
      const disposable = object as { geometry?: BufferGeometry; material?: { dispose(): void } };
      disposable.geometry?.dispose();
      disposable.material?.dispose();
    });
    this.root.clear();
    this.layers.clear();
    this.renderedEdges = [];
    this.retrievalEdges = [];
    this.retrievalLines = null;
  }

  dispose(): void {
    this.clear();
  }
}
