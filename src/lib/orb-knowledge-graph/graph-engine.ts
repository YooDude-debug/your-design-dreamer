/**
 * Kleine three.js-Engine für den ORB-Wissensgraphen (Experiment).
 *
 * Übernimmt das Muster des Slang Globe (globe-engine.ts): ein einziger
 * RAF-Loop, 1:1-Drag mit exponentiell gedämpfter Trägheit, Auto-Rotation mit
 * Pause nach Berührung, Wheel/Pinch-Zoom, Pause bei verstecktem Tab,
 * vollständiges dispose(). React rendert nicht pro Frame.
 *
 * Hervorhebung wird ausschliesslich von aussen über pulse() ausgelöst – die
 * Engine selbst markiert nie etwas als aktiv.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

export type EngineNode = { id: string; type: string; importance: number };
export type EngineEdge = { id: string; source: string; target: string; weight: number };

const TYPE_COLORS: Record<string, string> = {
  memory: "#6f9bff",
  fact: "#55c7d9",
  emotion: "#ff7a7a",
  action: "#5fd69a",
  perception: "#e5cf6a",
  decision: "#ffb04d",
  goal: "#c88bff",
};
const PULSE_COLOR = new Color("#b6ff3b");
const THREAD_COLOR = new Color("#39d0ff");
const SELECT_COLOR = new Color("#ffffff");
const EDGE_BASE = new Color("#8aa0c0");

const RADIUS = 10;
const PULSE_DECAY = 0.9; // pro Sekunde (exp)
const INERTIA_DAMP = 3.2;
const IDLE_RESUME_MS = 3000;

export class KnowledgeGraphEngine {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private group = new Group();
  private nodes: EngineNode[] = [];
  private index = new Map<string, number>();
  private positions: Vector3[] = [];
  private baseColors: Color[] = [];
  private pulse = new Float32Array(0);
  private threadPulse = new Float32Array(0);
  private edges: EngineEdge[] = [];
  private edgeIndex = new Map<string, number>();
  private edgePulse = new Float32Array(0);
  private mesh: InstancedMesh | null = null;
  private lines: LineSegments | null = null;
  private selected: string | null = null;
  private raf = 0;
  private last = 0;
  private velocity = new Vector2();
  private dragging = false;
  private lastPointer = new Vector2();
  private downAt = new Vector2();
  private lastInteraction = 0;
  private distance = 30;
  private pinchStart = 0;
  private pointers = new Map<number, Vector2>();
  private raycaster = new Raycaster();
  private tmpM = new Matrix4();
  private tmpC = new Color();
  private onPick: (id: string | null) => void;

  constructor(
    private host: HTMLElement,
    onPick: (id: string | null) => void,
  ) {
    this.onPick = onPick;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.camera = new PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 0, this.distance);
    this.scene.add(this.group);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";
    this.resize();
    window.addEventListener("resize", this.resize);
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  setData(nodes: EngineNode[], edges: EngineEdge[]): void {
    // Positionen stabil halten: Fibonacci-Kugel nach sortierter ID.
    const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
    const n = sorted.length;
    const oldPulse = new Map(this.nodes.map((x, i) => [x.id, this.pulse[i] ?? 0]));
    this.nodes = sorted;
    this.index = new Map(sorted.map((x, i) => [x.id, i]));
    this.positions = sorted.map((_, i) => {
      const y = n <= 1 ? 0 : 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const phi = i * Math.PI * (3 - Math.sqrt(5));
      return new Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(RADIUS);
    });
    this.baseColors = sorted.map((x) => new Color(TYPE_COLORS[x.type] ?? TYPE_COLORS["memory"]));
    this.pulse = new Float32Array(n);
    this.threadPulse = new Float32Array(n);
    sorted.forEach((x, i) => (this.pulse[i] = oldPulse.get(x.id) ?? 0));

    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as MeshBasicMaterial).dispose();
    }
    this.mesh = new InstancedMesh(
      new SphereGeometry(1, 14, 14),
      new MeshBasicMaterial({ transparent: true, opacity: 0.92 }),
      Math.max(1, n),
    );
    this.mesh.count = n;
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, this.baseColors[i]!);
    this.group.add(this.mesh);

    this.edges = edges.filter((e) => this.index.has(e.source) && this.index.has(e.target));
    this.edgeIndex = new Map(this.edges.map((e, i) => [e.id, i]));
    this.edgePulse = new Float32Array(this.edges.length);
    if (this.lines) {
      this.group.remove(this.lines);
      this.lines.geometry.dispose();
      (this.lines.material as LineBasicMaterial).dispose();
    }
    const pos = new Float32Array(this.edges.length * 6);
    this.edges.forEach((e, i) => {
      const a = this.positions[this.index.get(e.source)!]!;
      const b = this.positions[this.index.get(e.target)!]!;
      pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    });
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(this.edges.length * 6), 3));
    this.lines = new LineSegments(
      g,
      new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending }),
    );
    this.group.add(this.lines);
  }

  /** Von aussen: nur mit echten, gespeicherten Aktivierungen aufrufen. */
  pulseNodes(ids: string[]): void {
    for (const id of ids) {
      const i = this.index.get(id);
      if (i !== undefined) this.pulse[i] = 1;
    }
  }
  pulseEdges(ids: string[]): void {
    for (const id of ids) {
      const i = this.edgeIndex.get(id);
      if (i !== undefined) this.edgePulse[i] = 1;
    }
  }
  pulseThreadMembers(ids: string[]): void {
    for (const id of ids) {
      const i = this.index.get(id);
      if (i !== undefined) this.threadPulse[i] = 1;
    }
  }
  select(id: string | null): void {
    this.selected = id;
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (!this.dragging) {
      const idle = now - this.lastInteraction > IDLE_RESUME_MS;
      this.velocity.multiplyScalar(Math.exp(-INERTIA_DAMP * dt));
      const auto = idle ? 0.08 : 0;
      this.rotate(this.velocity.x * dt + auto * dt, this.velocity.y * dt);
    }
    this.camera.position.z += (this.distance - this.camera.position.z) * (1 - Math.exp(-8 * dt));

    const k = Math.exp(-PULSE_DECAY * dt);
    const sel = this.selected !== null ? this.index.get(this.selected) : undefined;
    if (this.mesh) {
      for (let i = 0; i < this.nodes.length; i++) {
        this.pulse[i]! *= k;
        this.threadPulse[i]! *= k;
        const p = this.pulse[i]!;
        const tp = this.threadPulse[i]!;
        const s = (0.16 + 0.34 * this.nodes[i]!.importance) * (1 + 0.9 * p + 0.3 * tp);
        this.tmpM.compose(this.positions[i]!, new Quaternion(), new Vector3(s, s, s));
        this.mesh.setMatrixAt(i, this.tmpM);
        this.tmpC.copy(this.baseColors[i]!).multiplyScalar(0.55);
        this.tmpC.lerp(THREAD_COLOR, tp * 0.7).lerp(PULSE_COLOR, p);
        if (i === sel) this.tmpC.lerp(SELECT_COLOR, 0.75);
        this.mesh.setColorAt(i, this.tmpC);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
    if (this.lines) {
      const col = this.lines.geometry.getAttribute("color") as BufferAttribute;
      const arr = col.array as Float32Array;
      for (let i = 0; i < this.edges.length; i++) {
        this.edgePulse[i]! *= k;
        const e = this.edges[i]!;
        const ep = this.edgePulse[i]!;
        const touches =
          sel !== undefined &&
          (this.index.get(e.source) === sel || this.index.get(e.target) === sel);
        const base = 0.08 + 0.3 * e.weight + (touches ? 0.5 : 0);
        this.tmpC.copy(EDGE_BASE).multiplyScalar(base).lerp(PULSE_COLOR, ep);
        arr.set(
          [this.tmpC.r, this.tmpC.g, this.tmpC.b, this.tmpC.r, this.tmpC.g, this.tmpC.b],
          i * 6,
        );
      }
      col.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private rotate(dx: number, dy: number) {
    const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), dx);
    const qx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), dy);
    this.group.quaternion.premultiply(qy).premultiply(qx);
  }

  private radPerPx(): number {
    const h = this.host.clientHeight || 1;
    const fov = (this.camera.fov * Math.PI) / 180;
    return (2 * Math.tan(fov / 2) * this.camera.position.z) / h / RADIUS;
  }

  private onDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, new Vector2(e.clientX, e.clientY));
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.lastInteraction = performance.now();
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = a!.distanceTo(b!);
      this.dragging = false;
      return;
    }
    this.dragging = true;
    this.velocity.set(0, 0);
    this.lastPointer.set(e.clientX, e.clientY);
    this.downAt.set(e.clientX, e.clientY);
  };
  private onMove = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, new Vector2(e.clientX, e.clientY));
    this.lastInteraction = performance.now();
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = a!.distanceTo(b!);
      if (this.pinchStart > 0) this.zoomBy(this.pinchStart / d);
      this.pinchStart = d;
      return;
    }
    if (!this.dragging) return;
    const r = this.radPerPx();
    const dx = (e.clientX - this.lastPointer.x) * r;
    const dy = (e.clientY - this.lastPointer.y) * r;
    this.rotate(dx, dy);
    this.velocity.set(dx / 0.016, dy / 0.016).clampLength(0, 4);
    this.lastPointer.set(e.clientX, e.clientY);
  };
  private onUp = (e: PointerEvent) => {
    const wasDrag = this.dragging;
    this.pointers.delete(e.pointerId);
    this.dragging = false;
    this.pinchStart = 0;
    if (wasDrag && this.downAt.distanceTo(new Vector2(e.clientX, e.clientY)) < 5) {
      this.velocity.set(0, 0);
      this.pick(e.clientX, e.clientY);
    }
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.lastInteraction = performance.now();
    this.zoomBy(Math.exp(e.deltaY * 0.0012));
  };
  private zoomBy(f: number) {
    this.distance = Math.min(45, Math.max(12, this.distance * f));
  }
  private pick(x: number, y: number) {
    if (!this.mesh) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.mesh)[0];
    const id = hit?.instanceId !== undefined ? (this.nodes[hit.instanceId]?.id ?? null) : null;
    this.onPick(id);
  }
  private onVisibility = () => {
    cancelAnimationFrame(this.raf);
    if (!document.hidden) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  };
  private resize = () => {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onUp);
    el.removeEventListener("wheel", this.onWheel);
    this.mesh?.geometry.dispose();
    (this.mesh?.material as MeshBasicMaterial | undefined)?.dispose();
    this.lines?.geometry.dispose();
    (this.lines?.material as LineBasicMaterial | undefined)?.dispose();
    this.renderer.dispose();
    el.remove();
  }
}
