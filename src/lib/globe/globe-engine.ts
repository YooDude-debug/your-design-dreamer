/**
 * Slang Globe – 3D-Engine (three.js, MIT).
 *
 * Imperativ gekapselt: React rendert nur den Container, jede Animation läuft
 * in einem einzigen requestAnimationFrame-Loop auf der GPU. Es gibt keine
 * React-State-Updates pro Frame (keine unnötigen Re-Renders).
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import landPolygons from "@/data/land-50m.json";
import type { GlobeRegion } from "./types";

type LandPolys = [number, number][][][];

const R = 1;
const MIN_DIST = 1.7;
const MAX_DIST = 5.4;
const START_DIST = 3.35;
const DEG = Math.PI / 180;
/** Ab dieser Kameradistanz lohnt sich die hochauflösende LOD-Stufe. */
const LOD_HI_DIST = 2.7;
/** Ruhezeit ohne Eingabe, bevor die Auto-Rotation wieder anläuft. */
const IDLE_RESUME = 3;

export type GlobeEngineOptions = {
  onPick?: (region: GlobeRegion | null) => void;
};

/** Einheitsvektor für Lat/Lng (Globe-Konvention, passt zur Equirect-Textur). */
function latLngToVec3(lat: number, lng: number, radius = R): Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Ziel-Rotation, damit ein Ort mittig zur Kamera zeigt. */
function orientationFor(lat: number, lng: number): { yaw: number; pitch: number } {
  const v = latLngToVec3(lat, lng);
  return { yaw: -Math.atan2(v.x, v.z), pitch: lat * DEG };
}

/**
 * Kontinent-Textur aus lizenzfreien Natural-Earth-Daten (Public Domain).
 * `width` steuert die LOD-Stufe: gleiche Optik, nur mehr Pixel und feinere Linien.
 */
function createLandTexture(polys: LandPolys, width: number, anisotropy: number): CanvasTexture {
  const w = width;
  const h = width / 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(38, 226, 130, 0.30)";
  ctx.strokeStyle = "rgba(120, 255, 190, 0.85)";
  ctx.lineWidth = Math.max(1, w / 1400);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const trace = (ring: [number, number][]) => {
    ctx.beginPath();
    ring.forEach(([lng, lat], i) => {
      const x = ((lng + 180) / 360) * w;
      const y = ((90 - lat) / 180) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };
  for (const rings of polys) {
    // Außenring füllen, alle Ringe konturieren (vermeidet invertierte Flächen).
    const outer = rings[0];
    if (outer) {
      trace(outer);
      ctx.fill();
    }
    for (const ring of rings) {
      trace(ring);
      ctx.stroke();
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}


function createStars(count: number): Points {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    // Gleichmäßig auf einer weit entfernten Kugelschale.
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = 14 + Math.random() * 10;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = r * s * Math.cos(a);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * s * Math.sin(a);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  const mat = new PointsMaterial({
    color: new Color("#cfe9ff"),
    size: 0.09,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  return new Points(geo, mat);
}

const HEAT_VERT = /* glsl */ `
  attribute float aIntensity;
  attribute float aPhase;
  attribute float aSelected;
  uniform float uTime;
  uniform float uScale;
  varying float vIntensity;
  varying float vFacing;
  varying float vSelected;
  void main() {
    vIntensity = aIntensity;
    vSelected = aSelected;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 nrm = normalize(mat3(modelMatrix) * position);
    vec3 toCam = normalize(cameraPosition - world.xyz);
    vFacing = dot(nrm, toCam);
    vec4 mv = viewMatrix * world;
    float pulse = 1.0 + 0.28 * sin(uTime * 2.0 + aPhase);
    float size = (14.0 + aIntensity * 34.0 + aSelected * 16.0) * pulse * uScale;
    gl_PointSize = size / max(0.2, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const HEAT_FRAG = /* glsl */ `
  precision mediump float;
  varying float vIntensity;
  varying float vFacing;
  varying float vSelected;
  void main() {
    if (vFacing < 0.03) discard;
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(1.0, 0.0, d);
    float glow = pow(core, 2.4);
    vec3 low = vec3(0.15, 0.90, 0.52);
    vec3 mid = vec3(0.98, 0.85, 0.25);
    vec3 high = vec3(1.0, 0.28, 0.32);
    vec3 col = vIntensity < 0.5
      ? mix(low, mid, vIntensity / 0.5)
      : mix(mid, high, (vIntensity - 0.5) / 0.5);
    col = mix(col, vec3(1.0), vSelected * 0.35);
    float alpha = glow * (0.55 + vIntensity * 0.45) * clamp(vFacing * 1.6, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMO_FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    float rim = 1.0 - abs(dot(normalize(vNormal), normalize(-vPos)));
    float a = pow(rim, 2.6) * 0.85;
    gl_FragColor = vec4(0.16, 0.95, 0.58, a);
  }
`;

export class GlobeEngine {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private globe = new Group();
  private heat: Points;
  private heatMat: ShaderMaterial;
  private regions: GlobeRegion[] = [];
  private landMat: MeshBasicMaterial;
  private hiLodLoading = false;
  private hiLodTex: CanvasTexture | null = null;
  private baseLodTex: CanvasTexture;
  private maxAniso = 4;
  private raf = 0;
  private clock = 0;
  private last = 0;
  private yaw = 0;
  private pitch = 0;
  private dist = START_DIST;
  private targetYaw = 0;
  private targetPitch = 0;
  private targetDist = START_DIST;
  /** Trägheit (rad/s) nach dem Loslassen. */
  private velYaw = 0;
  private velPitch = 0;
  /** Zeitstempel der letzten Fingerbewegung (für Trägheit). */
  private lastMove = 0;

  /** Sekunden seit der letzten Nutzereingabe. */
  private idleTime = IDLE_RESUME;
  /** true, solange eine Kamerafahrt (flyTo) läuft. */
  private flying = false;
  private autoRotate = true;
  private dragging = false;
  private pointers = new Map<number, Vector2>();
  private pinchStart = 0;
  private moved = 0;
  private selectedId: string | null = null;
  private visible = true;
  private readonly onPick?: (r: GlobeRegion | null) => void;
  private cleanups: (() => void)[] = [];


  constructor(
    private container: HTMLElement,
    opts: GlobeEngineOptions = {},
  ) {
    this.onPick = opts.onPick;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearAlpha(0);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.cursor = "grab";

    this.camera = new PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, this.dist);

    // Innerer Kern + Kontinente + Atmosphäre.
    const core = new Mesh(
      new SphereGeometry(R * 0.995, 64, 48),
      new MeshBasicMaterial({ color: new Color("#04140f"), transparent: true, opacity: 0.92 }),
    );
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy?.() ?? 4;
    const maxTex = this.renderer.capabilities.maxTextureSize || 4096;
    // LOD-Basis: 50m-Daten, Texturbreite nach GPU-Limit (schärfere Küstenlinien).
    this.baseLodTex = createLandTexture(
      landPolygons as LandPolys,
      Math.min(4096, maxTex),
      Math.min(8, this.maxAniso),
    );
    this.landMat = new MeshBasicMaterial({
      map: this.baseLodTex,
      transparent: true,
      depthWrite: false,
    });
    const land = new Mesh(new SphereGeometry(R, 128, 96), this.landMat);

    const atmo = new Mesh(
      new SphereGeometry(R * 1.045, 64, 48),
      new ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );

    this.heatMat = new ShaderMaterial({
      vertexShader: HEAT_VERT,
      fragmentShader: HEAT_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    });
    this.heat = new Points(new BufferGeometry(), this.heatMat);
    this.heat.frustumCulled = false;

    this.globe.add(core, land, atmo, this.heat);
    this.scene.add(this.globe, createStars(1100));

    this.bindEvents();
    this.resize();
    this.loop();
  }

  /** Heatmap-Punkte (neu) setzen – GPU-Buffer werden komplett ersetzt. */
  setRegions(regions: GlobeRegion[]): void {
    this.regions = regions;
    const n = regions.length;
    const pos = new Float32Array(n * 3);
    const intensity = new Float32Array(n);
    const phase = new Float32Array(n);
    const selected = new Float32Array(n);
    regions.forEach((r, i) => {
      const v = latLngToVec3(r.lat, r.lng, R * 1.012);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
      intensity[i] = r.intensity;
      phase[i] = (i % 17) * 0.61;
      selected[i] = r.id === this.selectedId ? 1 : 0;
    });
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("aIntensity", new BufferAttribute(intensity, 1));
    geo.setAttribute("aPhase", new BufferAttribute(phase, 1));
    geo.setAttribute("aSelected", new BufferAttribute(selected, 1));
    this.heat.geometry.dispose();
    this.heat.geometry = geo;
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    const attr = this.heat.geometry.getAttribute("aSelected") as BufferAttribute | undefined;
    if (!attr) return;
    this.regions.forEach((r, i) => attr.setX(i, r.id === id ? 1 : 0));
    attr.needsUpdate = true;
  }

  setAutoRotate(on: boolean): void {
    this.autoRotate = on;
  }

  /** Weiche Kamerafahrt zu einem Ort. */
  flyTo(lat: number, lng: number, dist = 2.25): void {
    const { yaw, pitch } = orientationFor(lat, lng);
    // kürzesten Weg wählen
    let d = yaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.targetYaw = this.yaw + d;
    this.targetPitch = pitch;
    this.targetDist = Math.min(MAX_DIST, Math.max(MIN_DIST, dist));
    this.velYaw = 0;
    this.velPitch = 0;
    this.flying = true;
    this.idleTime = 0;
  }


  resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.heatMat.uniforms.uScale!.value = Math.min(1.6, Math.max(0.7, h / 720));
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((fn) => fn());
    this.scene.traverse((obj) => {
      const mesh = obj as Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as { dispose?: () => void } | undefined;
      mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------------------------------------------------------------- Interaktion

  private bindEvents(): void {
    const el = this.renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.cleanups.push(() => el.removeEventListener(type, fn as EventListener));
    };

    on("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, new Vector2(e.clientX, e.clientY));
      this.dragging = true;
      this.moved = 0;
      this.flying = false;
      this.idleTime = 0;
      // Trägheit sofort abfangen: der Finger übernimmt ohne Nachziehen.
      this.velYaw = 0;
      this.velPitch = 0;
      this.targetYaw = this.yaw;
      this.targetPitch = this.pitch;
      el.style.cursor = "grabbing";
      if (this.pointers.size === 2) this.pinchStart = this.pinchDistance();
    });

    on("pointermove", (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.set(e.clientX, e.clientY);
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.idleTime = 0;
      if (this.pointers.size >= 2) {
        const d = this.pinchDistance();
        if (this.pinchStart > 0 && d > 0) {
          this.targetDist = clamp(this.dist * (this.pinchStart / d), MIN_DIST, MAX_DIST);
          this.pinchStart = d;
        }
        return;
      }
      // 1:1-Bewegung: Bildschirm-Pixel → Bogenmaß an der Kugeloberfläche.
      const rad = this.radiansPerPixel();
      const dYaw = -dx * rad;
      const dPitch = dy * rad;
      this.yaw += dYaw;
      this.pitch = clamp(this.pitch + dPitch, -1.35, 1.35);
      this.targetYaw = this.yaw;
      this.targetPitch = this.pitch;
      // Geschwindigkeit für die Trägheit (geglättet, damit kein Ruck entsteht).
      const now = performance.now();
      const dt = Math.max(0.008, Math.min(0.05, (now - this.lastMove) / 1000 || 0.016));
      this.lastMove = now;
      const blend = 0.65;
      this.velYaw = this.velYaw * (1 - blend) + (dYaw / dt) * blend;
      this.velPitch = this.velPitch * (1 - blend) + (dPitch / dt) * blend;
    });

    const endPointer = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchStart = 0;
      if (this.pointers.size === 0) {
        this.dragging = false;
        this.idleTime = 0;
        el.style.cursor = "grab";
        // Zu alte Geschwindigkeit (Finger lag still) erzeugt keine Trägheit.
        if (performance.now() - this.lastMove > 90) {
          this.velYaw = 0;
          this.velPitch = 0;
        }
        if (this.moved < 6) {
          this.velYaw = 0;
          this.velPitch = 0;
          this.pickAt(e.clientX, e.clientY, false);
        }
      }
    };
    on("pointerup", endPointer);
    on("pointercancel", endPointer);
    on("pointerleave", endPointer);

    on(
      "wheel",
      (e) => {
        e.preventDefault();
        this.idleTime = 0;
        this.flying = false;
        const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
        this.targetDist = clamp(this.targetDist * Math.exp(dy * 0.0015), MIN_DIST, MAX_DIST);
      },
      { passive: false },
    );


    on("dblclick", (e) => {
      e.preventDefault();
      this.pickAt(e.clientX, e.clientY, true);
    });

    const onResize = () => this.resize();
    window.addEventListener("resize", onResize, { passive: true });
    this.cleanups.push(() => window.removeEventListener("resize", onResize));

    const io = new IntersectionObserver(([entry]) => {
      this.visible = entry?.isIntersecting ?? true;
    });
    io.observe(el);
    this.cleanups.push(() => io.disconnect());

    const onVis = () => {
      this.visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVis));
  }

  private pinchDistance(): number {
    const pts = [...this.pointers.values()];
    return pts.length < 2 ? 0 : pts[0]!.distanceTo(pts[1]!);
  }

  /** Klickpunkt → nächstgelegene Region (Ray/Kugel analytisch, kein Raycaster nötig). */
  private pickAt(clientX: number, clientY: number, zoom: boolean): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const dir = new Vector3(ndc.x, ndc.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const o = this.camera.position.clone();
    const b = o.dot(dir);
    const c = o.dot(o) - R * R;
    const disc = b * b - c;
    if (disc < 0) {
      this.onPick?.(null);
      return;
    }
    const t = -b - Math.sqrt(disc);
    const hit = o.clone().add(dir.multiplyScalar(t));
    // in lokale Kugelkoordinaten zurückrechnen
    const local = this.globe.worldToLocal(hit).normalize();
    let best: GlobeRegion | null = null;
    let bestDot = -2;
    for (const r of this.regions) {
      const d = latLngToVec3(r.lat, r.lng).normalize().dot(local);
      if (d > bestDot) {
        bestDot = d;
        best = r;
      }
    }
    // ~12° Toleranz
    const region = bestDot > Math.cos(12 * DEG) ? best : null;
    if (region) {
      this.setSelected(region.id);
      if (zoom) this.flyTo(region.lat, region.lng, Math.min(this.targetDist, 1.9));
    }
    this.onPick?.(region);
  }

  // ------------------------------------------------------------------ Loop

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (!this.visible) return;
    this.clock += dt;

    if (this.dragging) {
      // Während der Berührung folgt die Kugel 1:1 dem Finger (keine Glättung).
      this.idleTime = 0;
    } else if (this.flying) {
      const k = 1 - Math.exp(-dt * 6);
      let d = this.targetYaw - this.yaw;
      this.yaw += d * k;
      this.pitch += (this.targetPitch - this.pitch) * k;
      if (Math.abs(d) < 0.002 && Math.abs(this.targetPitch - this.pitch) < 0.002) {
        this.flying = false;
        this.yaw = this.targetYaw;
        this.pitch = this.targetPitch;
      }
    } else {
      this.idleTime += dt;
      const spin = Math.abs(this.velYaw) + Math.abs(this.velPitch);
      if (spin > 0.0015) {
        // Trägheit: weiches Auslaufen mit exponentieller Dämpfung.
        this.yaw += this.velYaw * dt;
        this.pitch = clamp(this.pitch + this.velPitch * dt, -1.35, 1.35);
        const damp = Math.exp(-dt * 2.4);
        this.velYaw *= damp;
        this.velPitch *= damp;
        this.idleTime = 0;
      } else {
        this.velYaw = 0;
        this.velPitch = 0;
        if (this.autoRotate) {
          // Nach der Ruhezeit sanft wieder anlaufen (kein Sprung).
          const ramp = clamp((this.idleTime - IDLE_RESUME) / 1.6, 0, 1);
          this.yaw -= dt * 0.055 * ramp * ramp;
        }
      }
      this.targetYaw = this.yaw;
      this.targetPitch = this.pitch;
    }

    // Zoom bleibt immer weich gedämpft (flüssiges Pinch/Wheel-Verhalten).
    this.dist += (this.targetDist - this.dist) * (1 - Math.exp(-dt * 12));
    this.maybeUpgradeLod();

    this.globe.rotation.set(this.pitch, this.yaw, 0);
    this.camera.position.set(0, 0, this.dist);
    this.heatMat.uniforms.uTime!.value = this.clock;
    this.renderer.render(this.scene, this.camera);
  };

  /** Bogenmaß pro Bildschirmpixel an der Kugelvorderseite (1:1-Gefühl). */
  private radiansPerPixel(): number {
    const h = this.container.clientHeight || 1;
    const worldPerPx = (2 * Math.tan((this.camera.fov * DEG) / 2) * this.dist) / h;
    return clamp(worldPerPx / R, 0.0005, 0.02);
  }

  /**
   * Level of Detail: beim Hineinzoomen werden einmalig die feineren
   * Natural-Earth-10m-Umrisse nachgeladen und als schärfere Textur gesetzt.
   */
  private maybeUpgradeLod(): void {
    if (this.hiLodLoading || this.hiLodTex || this.dist > LOD_HI_DIST) return;
    this.hiLodLoading = true;
    void import("@/data/land-10m.json")
      .then((mod) => {
        const maxTex = this.renderer.capabilities.maxTextureSize || 4096;
        const width = Math.min(8192, maxTex);
        const tex = createLandTexture(
          (mod.default ?? mod) as unknown as LandPolys,
          width,
          Math.min(8, this.maxAniso),
        );
        this.hiLodTex = tex;
        this.landMat.map = tex;
        this.landMat.needsUpdate = true;
      })
      .catch(() => {
        this.hiLodLoading = false;
      });
  }

}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
