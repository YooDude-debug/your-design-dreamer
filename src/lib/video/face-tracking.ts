/**
 * Clientseitiges Face Tracking für Video-SlangTags (MediaPipe Face Detector).
 *
 * Es wird ausschliesslich eine kompakte Punktliste erzeugt (siehe face-track.ts):
 * das Video selbst wird nie verändert oder neu kodiert. Der Lauf findet im
 * Browser statt, das Modell wird nur bei Bedarf nachgeladen (dynamischer Import).
 */

import type { FaceTrack, FaceTrackPoint } from "@/lib/video/face-track";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

/** Tracking-Rate: 10 Punkte pro Sekunde reichen für ruhiges Folgen. */
export const FACE_TRACK_FPS = 10;

type Detector = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => {
    detections: Array<{
      boundingBox?: { originX: number; originY: number; width: number; height: number };
    }>;
  };
  close: () => void;
};

let detectorPromise: Promise<Detector> | null = null;

/**
 * MediaPipe verlangt im Modus "VIDEO" streng monoton steigende Zeitstempel je
 * Detector-Instanz. Der Detector wird bewusst wiederverwendet (Modell-Ladezeit),
 * die Videozeit beginnt aber bei jedem neuen Lauf wieder bei 0 – dadurch kam es
 * ab dem zweiten Video zu "Packet timestamp mismatch" und das Tracking brach
 * still ab. Deshalb erhält jeder Lauf einen eigenen Zeit-Offset hinter dem
 * bisher höchsten verwendeten Zeitstempel.
 */
let lastTimestampMs = 0;
const RUN_TIMESTAMP_GAP_MS = 1_000;

function beginTimestampRun(): number {
  lastTimestampMs += RUN_TIMESTAMP_GAP_MS;
  return lastTimestampMs;
}

/** Liefert einen streng monoton steigenden Zeitstempel für den laufenden Lauf. */
function nextTimestamp(base: number, seconds: number): number {
  const ts = Math.max(lastTimestampMs + 1, base + Math.round(seconds * 1000));
  lastTimestampMs = ts;
  return ts;
}

/**
 * Läufe werden serialisiert: zwei gleichzeitige Läufe würden sich in derselben
 * Detector-Instanz die Zeitstempel-Reihenfolge zerstören.
 */
let runQueue: Promise<unknown> = Promise.resolve();

async function getDetector(): Promise<Detector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
      const detector = await vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.4,
      });
      return detector as unknown as Detector;
    })().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      resolve();
    };
    video.addEventListener("seeked", finish);
    video.currentTime = Math.max(0, time);
    // Sicherheitsnetz: manche Browser feuern "seeked" bei identischer Zeit nicht.
    window.setTimeout(finish, 400);
  });
}

async function ready(video: HTMLVideoElement) {
  if (video.readyState >= 2 && video.videoWidth) return;
  await new Promise<void>((resolve, reject) => {
    const ok = () => resolve();
    video.addEventListener("loadeddata", ok, { once: true });
    video.addEventListener("error", () => reject(new Error("video load failed")), { once: true });
    video.load();
  });
}

type Box = { x: number; y: number; w: number; h: number };

function detectBoxes(detector: Detector, video: HTMLVideoElement, tMs: number): Box[] {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const res = detector.detectForVideo(video, tMs);
  return (res.detections ?? [])
    .map((d) => d.boundingBox)
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .map((b) => ({
      x: (b.originX + b.width / 2) / vw,
      y: (b.originY + b.height / 2) / vh,
      w: b.width / vw,
      h: b.height / vh,
    }));
}

function nearest(boxes: Box[], to: { x: number; y: number }): Box | null {
  let best: Box | null = null;
  let bestD = Infinity;
  for (const b of boxes) {
    const d = (b.x - to.x) ** 2 + (b.y - to.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export type TrackFaceOptions = {
  /** Vom Nutzer angetippte Stelle (Anteile 0..1) – wählt bei mehreren Gesichtern. */
  pick: { x: number; y: number };
  fps?: number;
  onProgress?: (ratio: number) => void;
};

/**
 * Verfolgt ein Gesicht über die Videolänge.
 * - erstes Bild: Gesicht am Tipppunkt wählen (mehrere Gesichter möglich)
 * - Folgeframes: nächstgelegenes Gesicht zur letzten Position
 * - leichte Kopfbewegung: Glättung + kleine Totzone (kein Zittern)
 * - kurzer Verlust: letzte Position halten, danach Tracking fortsetzen
 */
export function trackFaceInVideo(
  src: string,
  opts: TrackFaceOptions,
): Promise<FaceTrack | null> {
  const run = runQueue.then(
    () => trackFaceRun(src, opts),
    () => trackFaceRun(src, opts),
  );
  runQueue = run.catch(() => null);
  return run;
}

async function trackFaceRun(
  src: string,
  opts: TrackFaceOptions,
): Promise<FaceTrack | null> {
  const fps = opts.fps ?? FACE_TRACK_FPS;
  const detector = await getDetector();
  const tsBase = beginTimestampRun();
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    await ready(video);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) return null;

    const step = 1 / fps;
    const points: FaceTrackPoint[] = [];
    let smooth: Box | null = null;
    let target = { x: opts.pick.x, y: opts.pick.y };
    let first = true;
    let detectFailed = false;

    for (let t = 0; t <= duration + 1e-3; t += step) {
      await seek(video, Math.min(t, Math.max(0, duration - 1e-3)));
      let box: Box | null = null;
      try {
        box = nearest(detectBoxes(detector, video, nextTimestamp(tsBase, t)), target);
      } catch (e) {
        // Erkennungsfehler dürfen den Lauf nicht still verschlucken.
        box = null;
        if (!detectFailed) {
          detectFailed = true;
          console.warn("[face-track] detect failed", e);
        }
      }
      if (first && !box) {
        // Kein Gesicht im ersten Bild: Tracking nicht möglich.
        opts.onProgress?.(1);
        return null;
      }
      if (box) {
        if (!smooth) smooth = box;
        else {
          // Glättung (EMA) + Totzone gegen Zittern bei leichter Kopfbewegung.
          const cur: Box = smooth;
          const dead = Math.max(0.004, cur.w * 0.04);
          const dx = box.x - cur.x;
          const dy = box.y - cur.y;
          const a = 0.45;
          smooth = {
            x: Math.abs(dx) < dead ? cur.x : cur.x + dx * a,
            y: Math.abs(dy) < dead ? cur.y : cur.y + dy * a,
            w: cur.w + (box.w - cur.w) * 0.25,
            h: cur.h + (box.h - cur.h) * 0.25,
          };
        }
        target = { x: smooth.x, y: smooth.y };
        points.push({ t, ...smooth });
      } else if (smooth) {
        // Kurzer Verlust: letzte bekannte Position halten.
        points.push({ t, ...smooth, lost: true });
      }
      first = false;
      opts.onProgress?.(Math.min(1, t / duration));
    }
    if (points.length < 2) return null;
    return { fps, duration, points };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
