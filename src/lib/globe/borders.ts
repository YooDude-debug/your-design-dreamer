/**
 * Slang Globe – Ländergrenzen als eigene Vektor-Overlay-Ebene.
 *
 * Warum Vektoren und keine Textur: die grüne Globe-Oberfläche ist eine
 * Canvas-Textur (Küstenlinien). Texturen verlieren beim Hineinzoomen
 * zwangsläufig Schärfe. Grenzlinien werden deshalb als `LineSegments`
 * gezeichnet – Linien sind in WebGL immer exakt 1 Bildschirmpixel breit und
 * damit auf jeder Zoomstufe pixelscharf und aliasingarm.
 *
 * Daten: Natural Earth (Public Domain) über world-atlas, vorverarbeitet zu
 * reinen Innengrenzen (Küsten bleiben Teil der grünen Optik).
 * - `borders-50m.json`  ~19k Segmente → Weltansicht (dezent)
 * - `borders-10m.json`  ~68k Segmente → wird beim Hineinzoomen einmalig
 *   nachgeladen und danach wiederverwendet (kein erneutes Laden pro Zoom).
 *
 * Perceived line width: zusätzlich zur Hauptlinie liegen zwei minimal
 * versetzte Kopien (±`OFFSET_DEG`) darüber. Sie sind in der Weltansicht
 * unsichtbar und werden erst beim Hineinzoomen eingeblendet – so wirkt die
 * Grenze nah kräftiger, ohne global „dicker“ zu sein. Geometrie wird dabei
 * NIE neu berechnet, nur Material-Opazität animiert.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
} from "three";

/** [lon, lat] Polylinien. */
export type BorderLines = [number, number][][];

const DEG = Math.PI / 180;
/** Grenzen liegen knapp über der Landtextur (kein Z-Fighting, kein Versatz). */
const RADIUS = 1.0025;
/** Versatz der Verbreiterungs-Kopien in Grad (nah ≈ wenige Kilometer). */
const OFFSET_DEG = 0.018;
/** Blau der Grenzebene – hebt sich klar vom grünen Globe ab. */
const COLOR = 0x4aa8ff;

function pushVec(
  out: number[],
  lon: number,
  lat: number,
  offLon: number,
  offLat: number,
): void {
  const phi = (90 - (lat + offLat)) * DEG;
  const theta = (lon + offLon + 180) * DEG;
  out.push(
    -RADIUS * Math.sin(phi) * Math.cos(theta),
    RADIUS * Math.cos(phi),
    RADIUS * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Polylinien → LineSegments-Positionen. `offset` verschiebt jeden Punkt
 * senkrecht zum Linienverlauf (für die Verbreiterungs-Kopien).
 */
function toSegments(lines: BorderLines, offset: number): Float32Array {
  const out: number[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i += 1) {
      const a = line[i]!;
      const b = line[i + 1]!;
      let oaLon = 0;
      let oaLat = 0;
      if (offset !== 0) {
        // Senkrechte im lokalen lon/lat-Raum (lon nach Breitengrad korrigiert).
        const cos = Math.max(0.15, Math.cos(a[1] * DEG));
        const dx = (b[0] - a[0]) * cos;
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        oaLon = (-dy / len) * (offset / cos);
        oaLat = (dx / len) * offset;
      }
      pushVec(out, a[0], a[1], oaLon, oaLat);
      pushVec(out, b[0], b[1], oaLon, oaLat);
    }
  }
  return new Float32Array(out);
}

type Pass = { mesh: LineSegments; mat: LineBasicMaterial; offset: number };

/**
 * Grenz-Ebene mit eigener LOD-Verwaltung.
 *
 * Alle Datensätze werden genau einmal geladen und in GPU-Buffer übersetzt;
 * Zoomen ändert ausschließlich Opazitäten (keine Re-Renders, keine
 * Neuberechnung, keine weiteren Datenabfragen).
 */
export class BorderLayer {
  readonly group = new Group();
  private passes: Pass[] = [];
  private hiLoaded = false;
  private hiLoading = false;
  private baseLoading = false;
  private baseLoaded = false;

  constructor() {
    for (const offset of [0, OFFSET_DEG, -OFFSET_DEG]) {
      const mat = new LineBasicMaterial({
        color: COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new LineSegments(new BufferGeometry(), mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      this.passes.push({ mesh, mat, offset });
      this.group.add(mesh);
    }
  }

  /** Basisdaten (50m) nachladen – bewusst außerhalb des Initial-Bundles. */
  ensureBase(): void {
    if (this.baseLoading || this.baseLoaded) return;
    this.baseLoading = true;
    void import("@/data/borders-50m.json")
      .then((mod) => {
        this.apply((mod.default ?? mod) as unknown as BorderLines);
        this.baseLoaded = true;
      })
      .catch(() => {
        // Fehlende Grenzen dürfen den Globe nicht beeinträchtigen.
        this.baseLoading = false;
      });
  }

  /** Feine Grenzen (10m) – einmalig beim Hineinzoomen, danach im Speicher. */
  private ensureHi(): void {
    if (this.hiLoading || this.hiLoaded) return;
    this.hiLoading = true;
    void import("@/data/borders-10m.json")
      .then((mod) => {
        this.apply((mod.default ?? mod) as unknown as BorderLines);
        this.hiLoaded = true;
      })
      .catch(() => {
        this.hiLoading = false;
      });
  }

  private apply(lines: BorderLines): void {
    for (const pass of this.passes) {
      const geo = pass.mesh.geometry;
      geo.setAttribute("position", new BufferAttribute(toSegments(lines, pass.offset), 3));
      geo.computeBoundingSphere();
    }
  }

  /**
   * Zoomabhängige Intensität.
   *
   * @param dist Kameradistanz (klein = nah).
   * @param near Minimale Kameradistanz der Engine.
   * @param far  Maximale Kameradistanz der Engine.
   * @param settled Zoom steht praktisch still (erst dann teures Nachladen).
   */
  update(dist: number, near: number, far: number, settled: boolean): void {
    this.ensureBase();
    // t: 0 = Weltansicht, 1 = maximaler Zoom.
    const t = Math.min(1, Math.max(0, (far - dist) / (far - near)));
    // Weltansicht dezent (0.30) → Europa klarer → Land/Region deutlich (0.95).
    const main = 0.3 + Math.pow(t, 1.35) * 0.65;
    // Verbreiterung erst ab mittlerem Zoom, damit die Welt übersichtlich bleibt.
    const wide = Math.max(0, (t - 0.45) / 0.55) * 0.5;
    this.passes[0]!.mat.opacity = main;
    this.passes[1]!.mat.opacity = wide;
    this.passes[2]!.mat.opacity = wide;
    if (t > 0.35 && settled) this.ensureHi();
  }

  dispose(): void {
    for (const pass of this.passes) {
      pass.mesh.geometry.dispose();
      pass.mat.dispose();
    }
    this.passes = [];
    this.group.clear();
  }
}
