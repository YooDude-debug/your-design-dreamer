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
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import landPolygons from "@/data/land-50m.json";
import type { Object3D } from "three";
import { BorderLayer } from "./borders";
import type { GlobeRegion } from "./types";

type LandPolys = [number, number][][][];

const R = 1;
/**
 * Maximale Nähe der Kamera. 1.28 ≈ 0.28 Erdradien über der Oberfläche und
 * erlaubt damit die Stufen Welt → Kontinent → Land → Region → Stadt → lokal.
 * Tiefer heranzufahren bringt optisch nichts (Textur-LOD ist ausgereizt) und
 * würde nur Perspektivverzerrung erzeugen.
 */
const MIN_DIST = 1.28;
const MAX_DIST = 8.64;
const START_DIST = 5.36;
const DEG = Math.PI / 180;
/** Kameradistanzen der Detailstufen (Textur-LOD und Datenauflösung). */
const LOD_HI_DIST = 4.32;
const LOD_LOCAL_DIST = 2.3;
/** Ruhezeit ohne Eingabe, bevor die Auto-Rotation wieder anläuft. */
const IDLE_RESUME = 3;
/** Weltachse der Auto-Rotation (Polachse). */
const WORLD_Y = new Vector3(0, 1, 0);
/** Bildschirmfeste Horizontalachse der Kamera (Drag nach oben/unten). */
const CAM_X = new Vector3(1, 0, 0);
/** Blickachse (Zwei-Finger-Twist dreht um diese Achse). */
const CAM_Z = new Vector3(0, 0, 1);
/** Maximale Neigung: Polachse darf nicht flacher als dieser Kosinus stehen. */
const MAX_PITCH = 1.35;

/** Datendetailstufe – hängt ausschließlich von der Kameradistanz ab. */
export type GlobeDetail = "world" | "region" | "local";

export function detailForDistance(dist: number): GlobeDetail {
  if (dist <= LOD_LOCAL_DIST) return "local";
  if (dist <= LOD_HI_DIST) return "region";
  return "world";
}

export type GlobeEngineOptions = {
  onPick?: (region: GlobeRegion | null) => void;
  /** Wird nur beim Wechsel der Detailstufe aufgerufen (nicht pro Frame). */
  onDetailChange?: (detail: GlobeDetail) => void;
  /** Meldet, wenn die Engine die Auto-Rotation selbst abschaltet (z. B. nach flyTo). */
  onAutoRotateChange?: (on: boolean) => void;
};

/** Einheitsvektor für Lat/Lng in einen vorhandenen Vektor schreiben (allokationsfrei). */
function latLngToVec3Into(lat: number, lng: number, radius: number, out: Vector3): Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return out.set(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Einheitsvektor für Lat/Lng (Globe-Konvention, passt zur Equirect-Textur). */
function latLngToVec3(lat: number, lng: number, radius = R): Vector3 {
  return latLngToVec3Into(lat, lng, radius, new Vector3());
}

/** Ziel-Rotation, damit ein Ort mittig zur Kamera zeigt. */
function orientationFor(lat: number, lng: number): { yaw: number; pitch: number } {
  const v = latLngToVec3(lat, lng);
  return { yaw: -Math.atan2(v.x, v.z), pitch: lat * DEG };
}

/**
 * Kontinent-Textur aus lizenzfreien Natural-Earth-Daten (Public Domain).
 * `width` steuert die LOD-Stufe: gleiche Optik, nur mehr Pixel und feinere Linien.
 *
 * Das Rastern läuft inkrementell (`step()` mit Zeitbudget), damit eine feinere
 * LOD-Stufe während des Zoomens niemals einen langen Frame blockiert.
 */
class LandRaster {
  readonly texture: CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private i = 0;
  private readonly w: number;
  private readonly h: number;

  constructor(
    private polys: LandPolys,
    width: number,
    anisotropy: number,
  ) {
    this.w = width;
    this.h = width / 2;
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = "rgba(38, 226, 130, 0.30)";
    // Küstenkontur: deutlich feiner + dezenter als die blauen Ländergrenzen.
    ctx.strokeStyle = "rgba(120, 255, 190, 0.45)";
    ctx.lineWidth = Math.max(0.5, this.w / 3200);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this.ctx = ctx;
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = anisotropy;
    this.texture = tex;
  }

  get done(): boolean {
    return this.i >= this.polys.length;
  }

  private trace(ring: [number, number][]): void {
    const { ctx, w, h } = this;
    ctx.beginPath();
    for (let k = 0; k < ring.length; k += 1) {
      const p = ring[k]!;
      const x = ((p[0] + 180) / 360) * w;
      const y = ((90 - p[1]) / 180) * h;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /**
   * Zeichnet Polygone, bis das Zeitbudget (ms) erschöpft ist.
   *
   * Entscheidend: `texture.needsUpdate` wird NICHT pro Schritt gesetzt. Sonst
   * lädt three.js die komplette Textur (bis 4096²/8192² RGBA = 67–134 MB) in
   * JEDEM Frame erneut zur GPU, solange gerastert wird – die Hauptursache des
   * sporadischen Hängens beim Hineinzoomen. Der Upload passiert jetzt nur noch
   * am Ende (bzw. bei `finish()`), die Optik bleibt identisch.
   */
  step(budgetMs = 4): boolean {
    const t0 = performance.now();
    while (this.i < this.polys.length) {
      const rings = this.polys[this.i]!;
      // Außenring füllen, alle Ringe konturieren (vermeidet invertierte Flächen).
      const outer = rings[0];
      if (outer) {
        this.trace(outer);
        this.ctx.fill();
      }
      for (const ring of rings) {
        this.trace(ring);
        this.ctx.stroke();
      }
      this.i += 1;
      if (performance.now() - t0 > budgetMs) break;
    }
    if (this.done) this.texture.needsUpdate = true;
    return this.done;
  }

  /** Vollständig in einem Durchgang rastern (nur für die Basis-Stufe beim Start). */
  finish(): CanvasTexture {
    this.step(Number.POSITIVE_INFINITY);
    return this.texture;
  }
}

function createLandTexture(polys: LandPolys, width: number, anisotropy: number): CanvasTexture {
  return new LandRaster(polys, width, anisotropy).finish();
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
    float a = pow(rim, 3.1) * 0.5;
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
  /** Signatur der aktuell gesetzten Regionen – verhindert doppelte GPU-Uploads. */
  private regionSig = "";
  private landMat: MeshBasicMaterial;
  private hiLodLoading = false;
  private hiLodTex: CanvasTexture | null = null;
  /** Inkrementeller Raster-Job der feineren LOD-Stufe (nie blockierend). */
  private lodRaster: LandRaster | null = null;
  private baseLodTex: CanvasTexture;
  /** Blaue Ländergrenzen als eigene Vektor-Overlay-Ebene (zoomabhängig). */
  private borders = new BorderLayer();
  private maxAniso = 4;
  /** Zuletzt gemeldete Detailstufe (Callback feuert nur bei echten Wechseln). */
  private detail: GlobeDetail = detailForDistance(START_DIST);
  /** Sekunden, in denen die Zoomdistanz praktisch stillsteht. */
  private zoomSettled = 0;
  /** Letzte gerenderte Canvas-Größe (verhindert redundante resize-Arbeit). */
  private lastW = 0;
  private lastH = 0;
  /** Sichtbarkeit getrennt nach Viewport und Tab – kein Überschreiben. */
  private ioVisible = true;
  private docVisible = true;

  private raf = 0;
  private clock = 0;
  private last = 0;
  /** Nur vom Nutzer erzeugte Orientierung (Drag, Trägheit, flyTo). */
  private qUser = new Quaternion();
  /** Reiner Auto-Rotations-Winkel um die Polachse – völlig getrennt von qUser. */
  private autoYaw = 0;
  private qAuto = new Quaternion();
  private qScratch = new Quaternion();
  private qStep = new Quaternion();
  /** Ziel einer Kamerafahrt in Welt-Orientierung (Auto-Anteil noch enthalten). */
  private qFlyWorld = new Quaternion();
  private qTargetUser = new Quaternion();
  /** Start-Orientierung und Fortschritt der aktuellen Kamerafahrt (Ease-In/Out). */
  private qFlyFrom = new Quaternion();
  private flyT = 0;
  private flyDur = 1.35;

  private poleProbe = new Vector3();
  /** Scratch-Vektoren für `project()` – pro Frame vielfach genutzt. */
  private pWorld = new Vector3();
  private pNormal = new Vector3();
  private pToCam = new Vector3();
  private pNdc = new Vector3();

  private dist = START_DIST;
  private targetDist = START_DIST;
  /** Trägheit (rad/s) um die bildschirmfesten Achsen. */
  private velYaw = 0;
  private velPitch = 0;
  /** Zeitstempel der letzten Fingerbewegung (für Trägheit). */
  private lastMove = 0;
  /** Kurzes Zeitfenster der letzten Pixel-Bewegungen (robuste Wurfgeschwindigkeit). */
  private samples: { t: number; dx: number; dy: number }[] = [];

  /** Sekunden seit der letzten Nutzereingabe. */
  private idleTime = IDLE_RESUME;
  /** true, solange eine Kamerafahrt (flyTo) läuft. */
  private flying = false;
  private autoRotate = false;
  private dragging = false;
  private pointers = new Map<number, Vector2>();
  private pinchStart = 0;
  /** Zwei-Finger-Geste: letzter Mittelpunkt (Rotation) und Winkel (Drehung). */
  private pinchMid = new Vector2();
  private midScratch = new Vector2();
  private pinchMidValid = false;
  private pinchAngleLast = 0;
  private pinchAngleValid = false;
  private moved = 0;
  private selectedId: string | null = null;
  private readonly onPick?: (r: GlobeRegion | null) => void;
  private readonly onDetailChange?: (d: GlobeDetail) => void;
  private readonly onAutoRotateChange?: (on: boolean) => void;
  private cleanups: (() => void)[] = [];

  constructor(
    private container: HTMLElement,
    opts: GlobeEngineOptions = {},
  ) {
    this.onPick = opts.onPick;
    this.onDetailChange = opts.onDetailChange;
    this.onAutoRotateChange = opts.onAutoRotateChange;

    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearAlpha(0);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.cursor = "grab";
    // Wichtig: CSS-Größe des Canvas immer exakt = Container. Ohne das wächst
    // die Darstellung auf Geräten mit devicePixelRatio > 1 (Smartphone) über
    // den Container hinaus und der SlangTag-Overlay-Koordinatenraum passt nicht.
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";

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

    this.globe.add(core, land, this.borders.group, atmo, this.heat);
    // Orientierung läuft komplett über Quaternionen (kein verketteter Euler-Zustand),
    // damit horizontales Wischen nie von Neigung oder Auto-Rotation abhängt.
    this.globe.rotation.order = "XYZ";
    this.scene.add(this.globe, createStars(1100));

    this.bindEvents();
    this.resize();
    this.loop();
  }

  /**
   * Heatmap-Punkte setzen.
   *
   * Zwei Schutzmechanismen gegen unnötige Arbeit:
   * 1. identische Daten (gleiche Signatur) werden komplett ignoriert,
   * 2. bei gleicher Punktanzahl werden die vorhandenen GPU-Buffer aktualisiert
   *    statt neue Geometrie zu allokieren.
   */
  setRegions(regions: GlobeRegion[]): void {
    let sig = `${regions.length}`;
    for (const r of regions) sig += `|${r.id}:${r.intensity.toFixed(3)}`;
    if (sig === this.regionSig) return;
    this.regionSig = sig;
    this.regions = regions;
    const n = regions.length;
    const geo = this.heat.geometry;
    const posAttr = geo.getAttribute("position") as BufferAttribute | undefined;
    const reuse = posAttr?.count === n;
    const pos = reuse ? (posAttr!.array as Float32Array) : new Float32Array(n * 3);
    const intAttr = geo.getAttribute("aIntensity") as BufferAttribute | undefined;
    const phaseAttr = geo.getAttribute("aPhase") as BufferAttribute | undefined;
    const selAttr = geo.getAttribute("aSelected") as BufferAttribute | undefined;
    const intensity = reuse ? (intAttr!.array as Float32Array) : new Float32Array(n);
    const phase = reuse ? (phaseAttr!.array as Float32Array) : new Float32Array(n);
    const selected = reuse ? (selAttr!.array as Float32Array) : new Float32Array(n);
    const v = new Vector3();
    for (let i = 0; i < n; i += 1) {
      const r = regions[i]!;
      latLngToVec3Into(r.lat, r.lng, R * 1.012, v);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
      intensity[i] = r.intensity;
      phase[i] = (i % 17) * 0.61;
      selected[i] = r.id === this.selectedId ? 1 : 0;
    }
    if (reuse) {
      posAttr!.needsUpdate = true;
      intAttr!.needsUpdate = true;
      phaseAttr!.needsUpdate = true;
      selAttr!.needsUpdate = true;
      return;
    }
    const next = new BufferGeometry();
    next.setAttribute("position", new BufferAttribute(pos, 3));
    next.setAttribute("aIntensity", new BufferAttribute(intensity, 1));
    next.setAttribute("aPhase", new BufferAttribute(phase, 1));
    next.setAttribute("aSelected", new BufferAttribute(selected, 1));
    this.heat.geometry.dispose();
    this.heat.geometry = next;
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
    if (on) this.idleTime = IDLE_RESUME;
  }

  /**
   * Weiche Kamerafahrt zu einem Ort mit Ease-In/Ease-Out.
   *
   * Ziel und Startorientierung werden einmalig festgehalten; der Fortschritt
   * läuft zeitbasiert, damit die Bewegung sanft anfährt und sauber ausläuft.
   * Nach dem Erreichen bleibt der Globe stehen (keine Hintergrundrotation).
   */
  flyTo(lat: number, lng: number, dist = 3.6, duration = 1.35): void {
    const { yaw, pitch } = orientationFor(lat, lng);
    // Reihenfolge ist entscheidend: erst Yaw um die Polachse (bringt den
    // Längengrad nach vorn), danach Pitch um die bildschirmfeste Kameraachse
    // (hebt den Breitengrad in die Mitte). Als Quaternion-Produkt heißt das
    // Rx(pitch) * Ry(yaw), weil der rechte Faktor zuerst wirkt.
    this.qFlyWorld
      .setFromAxisAngle(CAM_X, pitch)
      .multiply(this.qScratch.setFromAxisAngle(WORLD_Y, yaw));
    // Auto-Anteil einmalig herausrechnen – er ist während der Fahrt eingefroren.
    this.qAuto.setFromAxisAngle(WORLD_Y, this.autoYaw);
    this.qTargetUser.copy(this.qFlyWorld).multiply(this.qScratch.copy(this.qAuto).invert());
    this.qFlyFrom.copy(this.qUser);
    this.targetDist = Math.min(MAX_DIST, Math.max(MIN_DIST, dist));
    this.velYaw = 0;
    this.velPitch = 0;
    this.flyT = 0;
    this.flyDur = Math.max(0.2, duration);
    this.flying = true;
    this.idleTime = 0;
    // Nach einer gezielten Navigation soll der Globe stehen bleiben.
    if (this.autoRotate) {
      this.autoRotate = false;
      this.onAutoRotateChange?.(false);
    }
  }

  /**
   * Dreht ausschließlich den User-Anteil um bildschirmfeste Achsen.
   * Die Achsen sind konstant – die Richtung kann sich also nie durch die
   * aktuelle Globe-Orientierung oder die Auto-Rotation umkehren.
   */
  private rotateUser(dYaw: number, dPitch: number): void {
    if (dYaw) {
      this.qStep.setFromAxisAngle(WORLD_Y, dYaw);
      this.qUser.premultiply(this.qStep);
    }
    if (dPitch) {
      this.qStep.setFromAxisAngle(CAM_X, dPitch);
      this.qScratch.copy(this.qUser).premultiply(this.qStep);
      // Neigung begrenzen: Polachse darf nicht über den Grenzwinkel kippen.
      this.poleProbe.set(0, 1, 0).applyQuaternion(this.qScratch);
      if (this.poleProbe.y >= Math.cos(MAX_PITCH)) this.qUser.copy(this.qScratch);
    }
  }

  /** Aktuelle Kameradistanz (für maßstabsgerechte Overlays). */
  get cameraDistance(): number {
    return this.dist;
  }

  /** 0 = Weltansicht, 1 = maximaler Zoom (für zoomabhängige Overlays). */
  get zoomProgress(): number {
    return clamp((MAX_DIST - this.dist) / (MAX_DIST - MIN_DIST), 0, 1);
  }

  /** true, solange Zoom und Kamerafahrt praktisch stillstehen. */
  get isSettled(): boolean {
    return !this.flying && this.zoomSettled > 0.12;
  }

  /**
   * Geografischer Punkt in der Bildmitte (Kamerablickachse → Kugel).
   * Wird für das progressive Nachladen genutzt: nur der betrachtete Bereich
   * lädt zusätzliche Geodaten.
   */
  centerLatLng(): { lat: number; lng: number } {
    // Kamera schaut entlang -Z auf den Globe; Punkt (0,0,1) in Globe-Koordinaten.
    const v = this.pWorld
      .set(0, 0, 1)
      .applyQuaternion(this.qScratch.copy(this.globe.quaternion).invert());
    const lat = Math.asin(clamp(v.y, -1, 1)) / DEG;
    // Umkehrung von latLngToVec3 (x = -sinφ·cosθ, z = sinφ·sinθ, θ = lng+180).
    const lng = Math.atan2(v.z, -v.x) / DEG - 180;
    return { lat, lng: ((lng + 540) % 360) - 180 };
  }

  /** Zusätzliche Detail-Ebene (Bundesländer u. Ä.) mit dem Globe mitdrehen. */
  attachOverlay(object: Object3D): void {
    this.globe.add(object);
  }

  /** Detail-Ebene wieder entfernen (Rendering endet sofort). */
  detachOverlay(object: Object3D): void {
    this.globe.remove(object);
  }

  /** true, solange die Bühne sichtbar ist (Tab aktiv, im Viewport). */
  get isVisible(): boolean {
    return this.ioVisible && this.docVisible;
  }

  /** Aktuelle Detailstufe (Welt / Region / lokal). */
  get detailLevel(): GlobeDetail {
    return this.detail;
  }

  /**
   * Projiziert einen geografischen Punkt (optional über der Oberfläche) auf
   * Container-Pixel. `facing` > 0 heißt Vorderseite der Kugel.
   *
   * Allokationsfrei (Scratch-Vektoren): wird pro Frame für jeden Satelliten
   * aufgerufen und darf keinen GC-Druck erzeugen.
   */
  project(lat: number, lng: number, radius = R): { x: number; y: number; facing: number } {
    const world = latLngToVec3Into(lat, lng, radius, this.pWorld).applyQuaternion(
      this.globe.quaternion,
    );
    const normal = this.pNormal.copy(world).normalize();
    const toCam = this.pToCam.copy(this.camera.position).sub(world).normalize();
    const facing = normal.dot(toCam);
    const ndc = this.pNdc.copy(world).project(this.camera);
    const w = this.lastW || this.container.clientWidth || 1;
    const h = this.lastH || this.container.clientHeight || 1;
    return { x: (ndc.x * 0.5 + 0.5) * w, y: (-ndc.y * 0.5 + 0.5) * h, facing };
  }

  resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    if (w === this.lastW && h === this.lastH) return;
    this.lastW = w;
    this.lastH = h;
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
    this.baseLodTex.dispose();
    this.hiLodTex?.dispose();
    // Ein noch laufender LOD-Raster-Job hinterlässt sonst Canvas + GPU-Textur.
    this.lodRaster?.texture.dispose();
    this.borders.dispose();
    this.lodRaster = null;
    this.heat.geometry.dispose();
    this.regions = [];
    this.pointers.clear();
    this.pinchMidValid = false;
    this.pinchAngleValid = false;
    this.pinchStart = 0;
    this.samples.length = 0;

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
      // Nutzerinteraktion darf die Auto-Rotation wieder freigeben, wenn sie
      // durch eine Kamerafahrt abgeschaltet wurde (kein Sprung: autoYaw bleibt).
      if (!this.autoRotate) {
        this.autoRotate = true;
        this.onAutoRotateChange?.(true);
      }
      // Auto-Rotation wird während der Berührung nur eingefroren.
      this.lastMove = performance.now();
      this.samples.length = 0;
      el.style.cursor = "grabbing";
      this.resetPinchRefs();
    });

    /** Eine einzelne Bewegung anwenden (Pixel → Bogenmaß, 1:1). */
    const applyMove = (id: number, x: number, y: number) => {
      const prev = this.pointers.get(id);
      if (!prev) return;
      const dx = x - prev.x;
      const dy = y - prev.y;
      prev.set(x, y);
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.pointers.size >= 2) {
        // Zwei Finger: Pinch-Zoom (Abstand), Rotation (Mittelpunkt) und Drehung
        // (Winkel) werden gleichzeitig aus derselben Geste gelesen.
        const d = this.pinchDistance();
        if (this.pinchStart > 0 && d > 0) {
          this.targetDist = clamp(this.targetDist * (this.pinchStart / d), MIN_DIST, MAX_DIST);
          this.pinchStart = d;
        }
        const mid = this.pinchMidInto(this.midScratch);
        if (this.pinchMidValid) {
          const rad = this.radiansPerPixel();
          this.rotateUser((mid.x - this.pinchMid.x) * rad, (mid.y - this.pinchMid.y) * rad);
        }
        this.pinchMid.copy(mid);
        this.pinchMidValid = true;
        const ang = this.pinchAngle();
        if (this.pinchAngleValid) {
          let dAng = ang - this.pinchAngleLast;
          if (dAng > Math.PI) dAng -= Math.PI * 2;
          else if (dAng < -Math.PI) dAng += Math.PI * 2;
          this.rotateRoll(dAng);
        }
        this.pinchAngleLast = ang;
        this.pinchAngleValid = true;
        this.velYaw = 0;
        this.velPitch = 0;
        this.lastMove = performance.now();
        this.samples.length = 0;
        return;
      }
      const rad = this.radiansPerPixel();
      // Richtung kommt ausschließlich aus der Pointer-Bewegung (bildschirmfeste Achsen).
      this.rotateUser(dx * rad, dy * rad);
      this.lastMove = performance.now();
      // Kurzes Zeitfenster (~90 ms) für eine ruckelfreie Wurfgeschwindigkeit.
      this.samples.push({ t: this.lastMove, dx, dy });
      while (this.samples.length > 1 && this.lastMove - this.samples[0]!.t > 90) {
        this.samples.shift();
      }
    };

    on("pointermove", (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.idleTime = 0;
      // Coalesced Events auflösen: volle Auflösung des Touch-Streams, ein Render pro Frame.
      const batch = e.getCoalescedEvents?.() ?? [];
      if (batch.length > 1) {
        for (const p of batch) applyMove(e.pointerId, p.clientX, p.clientY);
      } else {
        applyMove(e.pointerId, e.clientX, e.clientY);
      }
    });

    const endPointer = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      // Referenzen der Zwei-Finger-Geste sauber neu setzen (kein Sprung, wenn ein
      // Finger die Fläche verlässt und die Geste einfingrig weiterläuft).
      this.resetPinchRefs();
      if (this.pointers.size === 0) {
        this.dragging = false;
        this.idleTime = 0;
        el.style.cursor = "grab";
        // Wurfgeschwindigkeit aus dem Zeitfenster; liegt der Finger still → keine Trägheit.
        const now = performance.now();
        const span = this.samples.length > 1 ? (now - this.samples[0]!.t) / 1000 : 0;
        if (span > 0.012 && now - this.lastMove < 80) {
          let sx = 0;
          let sy = 0;
          for (const s of this.samples) {
            sx += s.dx;
            sy += s.dy;
          }
          const rad = this.radiansPerPixel();
          this.velYaw = (sx * rad) / span;
          this.velPitch = (sy * rad) / span;
        } else {
          this.velYaw = 0;
          this.velPitch = 0;
        }
        this.samples.length = 0;
        if (this.moved < 6) {
          this.velYaw = 0;
          this.velPitch = 0;
          this.pickAt(e.clientX, e.clientY, false);
        }
      }
    };
    on("pointerup", endPointer);
    on("pointercancel", endPointer);

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

    // Viewport- und Tab-Sichtbarkeit werden getrennt geführt: früher konnte ein
    // IntersectionObserver-Callback den Tab-Zustand überschreiben (Render im
    // Hintergrund-Tab → unnötige GPU-Last).
    const io = new IntersectionObserver(([entry]) => {
      this.ioVisible = entry?.isIntersecting ?? true;
    });
    io.observe(el);
    this.cleanups.push(() => io.disconnect());

    const onVis = () => {
      this.docVisible = !document.hidden;
    };

    document.addEventListener("visibilitychange", onVis);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVis));
  }

  private pinchDistance(): number {
    const pts = [...this.pointers.values()];
    return pts.length < 2 ? 0 : pts[0]!.distanceTo(pts[1]!);
  }

  /** Mittelpunkt der ersten zwei Finger (allokationsfrei in `out`). */
  private pinchMidInto(out: Vector2): Vector2 {
    const it = this.pointers.values();
    const a = it.next().value as Vector2 | undefined;
    const b = it.next().value as Vector2 | undefined;
    if (!a || !b) return out;
    return out.set((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  /** Winkel der Verbindungslinie beider Finger (Bogenmaß). */
  private pinchAngle(): number {
    const it = this.pointers.values();
    const a = it.next().value as Vector2 | undefined;
    const b = it.next().value as Vector2 | undefined;
    if (!a || !b) return 0;
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  /** Drehung um die Blickachse (Zwei-Finger-Twist) – Zoom bleibt unberührt. */
  private rotateRoll(dRoll: number): void {
    if (!dRoll) return;
    this.qStep.setFromAxisAngle(CAM_Z, -dRoll);
    this.qUser.premultiply(this.qStep);
  }

  /** Gestenreferenzen neu setzen, sobald sich die Fingeranzahl ändert. */
  private resetPinchRefs(): void {
    const two = this.pointers.size >= 2;
    this.pinchStart = two ? this.pinchDistance() : 0;
    this.pinchMidValid = false;
    this.pinchAngleValid = false;
    if (two) {
      this.pinchMidInto(this.pinchMid);
      this.pinchMidValid = true;
      this.pinchAngleLast = this.pinchAngle();
      this.pinchAngleValid = true;
    }
  }

  /** Klickpunkt → nächstgelegene Region (Ray/Kugel analytisch, kein Raycaster nötig). */
  private pickAt(clientX: number, clientY: number, zoom: boolean): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const dir = new Vector3(ndc.x, ndc.y, 0.5)
      .unproject(this.camera)
      .sub(this.camera.position)
      .normalize();
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
      if (zoom) this.flyTo(region.lat, region.lng, Math.min(this.targetDist, 2.2));
    }
    this.onPick?.(region);
  }

  // ------------------------------------------------------------------ Loop

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (!this.isVisible) return;
    this.clock += dt;

    if (this.dragging) {
      // Während der Berührung folgt die Kugel 1:1 dem Finger (keine Glättung).
      this.idleTime = 0;
    } else if (this.flying) {
      // Zeitbasierter Fortschritt mit Ease-In/Ease-Out (smootherstep):
      // sanftes Anfahren, sichtbare Bewegung, weiches Auslaufen.
      this.flyT = Math.min(1, this.flyT + dt / this.flyDur);
      const t = this.flyT;
      const e = t * t * t * (t * (t * 6 - 15) + 10);
      this.qUser.slerpQuaternions(this.qFlyFrom, this.qTargetUser, e);
      if (t >= 1) {
        this.qUser.copy(this.qTargetUser);
        this.flying = false;
        // Steht genau auf dem Ziel und bleibt dort (keine Auto-Rotation).
        this.idleTime = 0;
      }
    } else {
      this.idleTime += dt;
      const spin = Math.abs(this.velYaw) + Math.abs(this.velPitch);
      if (spin > 0.0015) {
        // Trägheit läuft über exakt denselben Achsenpfad wie der Drag.
        this.rotateUser(this.velYaw * dt, this.velPitch * dt);
        const damp = Math.exp(-dt * 3.4);
        this.velYaw *= damp;
        this.velPitch *= damp;
        this.idleTime = 0;
      } else {
        this.velYaw = 0;
        this.velPitch = 0;
        if (this.autoRotate) {
          // Nach der Ruhezeit sanft wieder anlaufen (kein Sprung).
          const ramp = clamp((this.idleTime - IDLE_RESUME) / 1.6, 0, 1);
          this.autoYaw -= dt * 0.055 * ramp * ramp;
        }
      }
    }

    // Zoom bleibt immer weich gedämpft (flüssiges Pinch/Wheel-Verhalten).
    const before = this.dist;
    this.dist += (this.targetDist - this.dist) * (1 - Math.exp(-dt * 16));
    // Zoombewegung erkennen: teure LOD-Arbeit läuft erst, wenn der Zoom ruht.
    this.zoomSettled = Math.abs(this.dist - before) > 0.0008 ? 0 : this.zoomSettled + dt;
    const nextDetail = detailForDistance(this.dist);
    if (nextDetail !== this.detail) {
      this.detail = nextDetail;
      this.onDetailChange?.(nextDetail);
    }
    this.maybeUpgradeLod();
    // Nur Material-Opazitäten – keine Geometrie- oder Datenneuberechnung.
    this.borders.update(this.dist, MIN_DIST, MAX_DIST, this.zoomSettled > 0.12);

    // Compositing: Auto-Rotation zuerst (lokale Polachse), danach die User-Orientierung.
    this.qAuto.setFromAxisAngle(WORLD_Y, this.autoYaw);
    this.globe.quaternion.copy(this.qUser).multiply(this.qAuto);
    this.camera.position.set(0, 0, this.dist);
    this.heatMat.uniforms.uTime!.value = this.clock;
    this.renderer.render(this.scene, this.camera);
  };

  /** Bogenmaß pro Bildschirmpixel an der Kugelvorderseite (1:1-Gefühl). */
  private radiansPerPixel(): number {
    const h = this.container.clientHeight || 1;
    // Maßstab an der Kugelvorderseite (Abstand Kamera → Oberfläche), damit sich
    // die Drehung exakt so schnell wie der Finger anfühlt.
    const depth = Math.max(0.56, this.dist - R);
    const worldPerPx = (2 * Math.tan((this.camera.fov * DEG) / 2) * depth) / h;
    return clamp(worldPerPx / R, 0.0004, 0.02);
  }

  /**
   * Level of Detail: beim Hineinzoomen werden einmalig die feineren
   * Natural-Earth-10m-Umrisse nachgeladen und als schärfere Textur gesetzt.
   *
   * Zwei Ursachen des früheren Ruckelns sind hier behoben:
   * 1. Die Textur wurde in EINEM Frame gerastert (bis ~8192 px breit) – genau
   *    während des Zoomens. Jetzt läuft das Rastern inkrementell mit 4 ms
   *    Zeitbudget pro Frame.
   * 2. Der Job startete mitten in der Zoombewegung. Jetzt erst, wenn der Zoom
   *    kurz zur Ruhe gekommen ist.
   */
  private maybeUpgradeLod(): void {
    // Laufender Raster-Job: pro Frame nur ein kleines Zeitbudget verbrauchen.
    if (this.lodRaster) {
      if (this.lodRaster.step(4)) {
        const tex = this.lodRaster.texture;
        this.lodRaster = null;
        this.hiLodTex = tex;
        this.landMat.map = tex;
        this.landMat.needsUpdate = true;
      }
      return;
    }
    if (this.hiLodLoading || this.hiLodTex || this.dist > LOD_HI_DIST) return;
    // Erst starten, wenn die Zoombewegung ruht (kein Import-/Parse-Peak im Zoom).
    if (this.zoomSettled < 0.18) return;
    this.hiLodLoading = true;
    void import("@/data/land-10m.json")
      .then((mod) => {
        const maxTex = this.renderer.capabilities.maxTextureSize || 4096;
        // Speicherbewusst: 8192² RGBA wäre auf schwachen GPUs zu viel.
        const budget = Math.min(window.innerWidth, window.innerHeight) < 700 ? 4096 : 8192;
        const width = Math.min(budget, maxTex);
        this.lodRaster = new LandRaster(
          (mod.default ?? mod) as unknown as LandPolys,
          width,
          Math.min(8, this.maxAniso),
        );
      })
      .catch(() => {
        // Fehlgeschlagenes Nachladen darf den Globe nicht blockieren: die
        // Basis-Textur bleibt sichtbar, ein späterer Versuch ist erlaubt.
        this.hiLodLoading = false;
      });
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
