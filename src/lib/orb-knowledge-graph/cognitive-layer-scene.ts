/**
 * Cognitive Globe – konzentrische Ebenen (three.js, nur Darstellung).
 *
 * Jede Cognitive-Ebene liegt auf einer eigenen Schale um den Memory Core.
 * Farben ausschliesslich neutral (weiss/grau): keine Ebene verwendet Rot,
 * Grün oder Gelb – diese bleiben Retrieval, Speicher-Diffs und Suche
 * vorbehalten. Markierungen entstehen nur aus vorhandenen Daten; es gibt
 * keine Gewinner-, Ranking- oder Auswahl-Darstellung (alle verfügbaren
 * Strategien sehen gleich aus).
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

export const LAYER_GAP = 1.35;
const PRESENT = new Color("#e8ecf2");
const ABSENT = new Color("#4a5260");
const RING_EMPTY = new Color("#3a404a");
const RING_DATA = new Color("#9aa4b4");

/** Radius der Schale i (0 = Memory Core). */
export function layerRadius(base: number, layerIndex: number): number {
  return base + layerIndex * LAYER_GAP;
}

/** Gleichmässig verteilte Äquator-Positionen (feste Reihenfolge, keine Wertung). */
function ringPoint(r: number, i: number, n: number, tilt: number): Vector3 {
  const a = (i / Math.max(1, n)) * Math.PI * 2;
  return new Vector3(Math.cos(a) * r, Math.sin(a) * r * Math.sin(tilt), Math.sin(a) * r * Math.cos(tilt));
}

type Marker = { pos: Vector3; present: boolean; size: number };
type Connector = { nodeIndex: number; from: Vector3; to: Vector3 };

export class CognitiveLayerScene {
  readonly root = new Group();
  private layers = new Map<CognitiveLayerId, Group>();
  private connectorLines: LineSegments | null = null;
  private connectors: Connector[] = [];

  constructor(private base: number) {}

  /** Neu aufbauen – nur bei neuer Observation oder neuer Memory-Struktur. */
  build(
    view: CognitiveView | null,
    positions: readonly Vector3[],
    index: ReadonlyMap<string, number>,
  ): void {
    this.clear();
    const dirOf = (memoryId: string | null) => {
      const i = memoryId ? index.get(memoryId) : undefined;
      return i === undefined ? null : { i, dir: positions[i]!.clone().normalize() };
    };
    COGNITIVE_LAYERS.forEach((layer, li) => {
      if (layer.id === "memory") return;
      const g = new Group();
      const r = layerRadius(this.base, li);
      const tilt = 0.35;
      const has = layerHasData(view, layer.id);
      g.add(this.ring(r, tilt, has));
      const markers: Marker[] = [];
      const lines: [Vector3, Vector3, number][] = [];

      if (view && layer.id === "factors") {
        for (const c of view.candidates) {
          const d = dirOf(c.memoryId);
          if (!d) continue;
          COGNITIVE_FACTOR_KEYS.forEach((k, fi) => {
            if (!c.factors[k]) return; // nie erfinden
            const off = new Vector3(0, (fi - 3) * 0.08, 0);
            markers.push({ pos: d.dir.clone().multiplyScalar(r).add(off), present: true, size: 0.1 });
          });
        }
      }
      if (view && layer.id === "candidates") {
        for (const c of view.candidates) {
          const d = dirOf(c.memoryId);
          if (!d) continue; // unbekannte Memory-ID: nicht platzieren
          const p = d.dir.clone().multiplyScalar(r);
          markers.push({ pos: p, present: true, size: 0.16 });
          this.connectors.push({ nodeIndex: d.i, from: positions[d.i]!.clone(), to: p });
        }
      }
      if (view && layer.id === "competition") {
        const candPos = new Map<string, Vector3>();
        for (const c of view.candidates) {
          const d = c.id ? dirOf(c.memoryId) : null;
          if (d && c.id) candPos.set(c.id, d.dir.clone().multiplyScalar(r));
        }
        for (const cp of view.competitions) {
          const a = cp.leftCandidateId ? candPos.get(cp.leftCandidateId) : undefined;
          const b = cp.rightCandidateId ? candPos.get(cp.rightCandidateId) : undefined;
          if (!a || !b) continue;
          // maximumOverlap nur als Linienhelligkeit; null → grau/unknown.
          lines.push([a, b, cp.maximumOverlap === null ? -1 : cp.maximumOverlap]);
        }
      }
      if (view && layer.id === "snapshot") {
        const s = view.snapshot;
        const items = [
          s.currentFocus !== null,
          s.attentionAvailability !== null,
          view.candidates.length > 0,
          view.competitions.length > 0,
          s.goals > 0,
          s.experiences > 0,
          s.conflicts > 0,
        ];
        items.forEach((present, i) =>
          markers.push({ pos: ringPoint(r, i, items.length, tilt), present, size: 0.14 }),
        );
      }
      if (view && layer.id === "strategy") {
        STRATEGY_KEYS.forEach((k, i) => {
          const s = view.strategies.find((x) => x.type === k);
          markers.push({
            pos: ringPoint(r, i, STRATEGY_KEYS.length, tilt),
            present: s?.available === true, // verfügbar ≠ ausgewählt: gleiche Darstellung für alle
            size: 0.16,
          });
        });
      }
      if (view && layer.id === "decision") {
        COVERAGE_KEYS.forEach((k, i) =>
          markers.push({
            pos: ringPoint(r, i, COVERAGE_KEYS.length, tilt),
            present: view.coverage[k] !== null,
            size: 0.14,
          }),
        );
      }
      if (view && layer.id === "action") {
        view.actionPlans.forEach((a, i) =>
          markers.push({
            pos: ringPoint(r, i, view.actionPlans.length, tilt),
            present: a.executable,
            size: 0.14,
          }),
        );
      }
      // outcome / adaptation: nur Schale, keine Simulation.

      if (markers.length) g.add(this.markers(markers));
      if (lines.length) g.add(this.lines(lines));
      this.layers.set(layer.id, g);
      this.root.add(g);
    });

    if (this.connectors.length) {
      const pos = new Float32Array(this.connectors.length * 6);
      this.connectors.forEach((c, i) =>
        pos.set([c.from.x, c.from.y, c.from.z, c.to.x, c.to.y, c.to.z], i * 6),
      );
      const geo = new BufferGeometry();
      geo.setAttribute("position", new BufferAttribute(pos, 3));
      geo.setAttribute("color", new BufferAttribute(new Float32Array(pos.length), 3));
      this.connectorLines = new LineSegments(
        geo,
        new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending }),
      );
      this.layers.get("candidates")?.add(this.connectorLines);
    }
  }

  /**
   * Aktivierungspfad Memory → Candidate: hellt nur auf, wenn der Memory-Knoten
   * gerade durch ein echtes Retrieval-Event pulsiert (neutral weiss, nie rot).
   */
  update(retrievalPulse: Float32Array): void {
    if (!this.connectorLines) return;
    const col = this.connectorLines.geometry.getAttribute("color") as BufferAttribute;
    const arr = col.array as Float32Array;
    this.connectors.forEach((c, i) => {
      const v = 0.12 + 0.85 * (retrievalPulse[c.nodeIndex] ?? 0);
      arr.fill(v, i * 6, i * 6 + 6);
    });
    col.needsUpdate = true;
  }

  setVisibility(visible: ReadonlySet<CognitiveLayerId>, focus: CognitiveLayerId | null): void {
    for (const [id, g] of this.layers) g.visible = focus ? focus === id : visible.has(id);
  }

  private ring(r: number, tilt: number, has: boolean): LineLoop {
    const n = 128;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pts.set(ringPoint(r, i, n, tilt).toArray(), i * 3);
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pts, 3));
    return new LineLoop(
      geo,
      new LineBasicMaterial({
        color: has ? RING_DATA : RING_EMPTY,
        transparent: true,
        opacity: has ? 0.55 : 0.25,
      }),
    );
  }

  private markers(list: Marker[]): InstancedMesh {
    const m = new InstancedMesh(
      new SphereGeometry(1, 10, 10),
      new MeshBasicMaterial({ transparent: true, opacity: 0.9 }),
      list.length,
    );
    const mat = new Matrix4();
    list.forEach((k, i) => {
      mat.compose(k.pos, new Quaternion(), new Vector3(k.size, k.size, k.size));
      m.setMatrixAt(i, mat);
      m.setColorAt(i, k.present ? PRESENT : ABSENT);
    });
    return m;
  }

  private lines(list: [Vector3, Vector3, number][]): LineSegments {
    const pos = new Float32Array(list.length * 6);
    const col = new Float32Array(list.length * 6);
    list.forEach(([a, b, mo], i) => {
      pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
      const c = mo < 0 ? ABSENT : PRESENT.clone().multiplyScalar(0.15 + 0.6 * mo);
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    });
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("color", new BufferAttribute(col, 3));
    return new LineSegments(
      geo,
      new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending }),
    );
  }

  private clear(): void {
    this.root.traverse((o) => {
      const x = o as { geometry?: BufferGeometry; material?: { dispose(): void } };
      x.geometry?.dispose();
      x.material?.dispose();
    });
    this.root.clear();
    this.layers.clear();
    this.connectors = [];
    this.connectorLines = null;
  }

  dispose(): void {
    this.clear();
  }
}
