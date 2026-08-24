/**
 * Slang Globe – Detail-Ebene für Verwaltungsgrenzen (z. B. Bundesländer).
 *
 * Bewusst dieselbe Technik wie `BorderLayer`: `LineSegments` sind auf jeder
 * Zoomstufe pixelscharf. Unterschied: diese Ebene existiert nur, solange ein
 * Land betrachtet wird, und wird beim Herauszoomen aus der Szene genommen
 * (kein Rendering, keine Draw-Calls).
 */
import { BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments } from "three";
import { toSegments, type BorderLines } from "./borders";

/** Etwas höher als die Ländergrenzen, damit beide Ebenen sichtbar bleiben. */
const OFFSET_DEG = 0.012;
/** Grünlich-türkis: bleibt im bestehenden Farbschema, unterscheidet sich aber
 *  klar von den blauen Ländergrenzen. */
const COLOR = 0x59f2c0;

export class SubdivisionLayer {
  readonly group = new Group();
  private mat: LineBasicMaterial;
  private mesh: LineSegments;
  private hasData = false;

  constructor() {
    this.mat = new LineBasicMaterial({
      color: COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.mesh = new LineSegments(new BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.group.add(this.mesh);
  }

  /** Geometrie einmal pro Datensatz aufbauen (Zoomen ändert nur Opazität). */
  setLines(lines: BorderLines): void {
    const geo = this.mesh.geometry;
    geo.setAttribute("position", new BufferAttribute(toSegments(lines, OFFSET_DEG * 0), 3));
    geo.computeBoundingSphere();
    this.hasData = true;
  }

  get ready(): boolean {
    return this.hasData;
  }

  /**
   * Sanftes Ein-/Ausblenden während der Kamerafahrt.
   * @param target Zielopazität (0 = unsichtbar).
   * @param dt Sekunden seit dem letzten Frame.
   */
  fade(target: number, dt: number): void {
    const k = 1 - Math.exp(-dt * 4.5);
    this.mat.opacity += (target - this.mat.opacity) * k;
    this.mesh.visible = this.mat.opacity > 0.01;
  }

  get opacity(): number {
    return this.mat.opacity;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.group.clear();
  }
}
