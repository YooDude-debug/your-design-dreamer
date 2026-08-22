/**
 * Face-Tracking-Daten für SlangTags auf Videos.
 *
 * Es werden ausschliesslich kompakte Tracking-Punkte gespeichert (ca. 10 pro
 * Sekunde, Anteile 0..1 des Videobildes) – niemals bearbeitete Videoframes.
 * Fotos und alle bestehenden SlangTags bleiben davon unberührt: fehlt `follow`,
 * gilt exakt das bisherige, fixierte Verhalten.
 */

export type FaceTrackPoint = {
  /** Zeit im Video in Sekunden */
  t: number;
  /** Gesichtsmittelpunkt (Anteil 0..1) */
  x: number;
  y: number;
  /** Gesichtsbreite/-höhe (Anteil 0..1) */
  w: number;
  h: number;
  /** true = Gesicht in diesem Frame nicht erkannt (letzte Position gehalten) */
  lost?: boolean;
};

export type FaceTrack = {
  fps: number;
  /** Videolänge in Sekunden */
  duration: number;
  points: FaceTrackPoint[];
};

/** Folge-Modus einer Platzierung. `fixed` = bisheriges Verhalten. */
export type SlangTagFollowMode = "fixed" | "face";

export type SlangTagFollow = {
  mode: "face";
  /** Abstand des SlangTags zum Gesicht, in Gesichtsbreiten/-höhen. */
  offsetX: number;
  offsetY: number;
  track: FaceTrack;
};

/** Lineare Interpolation der Tracking-Punkte zu einem Zeitpunkt. */
export function sampleFaceTrack(track: FaceTrack, time: number): FaceTrackPoint | null {
  const pts = track.points;
  if (!pts.length) return null;
  if (time <= pts[0].t) return pts[0];
  const last = pts[pts.length - 1];
  if (time >= last.t) return last;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].t <= time) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const span = b.t - a.t;
  const k = span > 0 ? (time - a.t) / span : 0;
  return {
    t: time,
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    w: a.w + (b.w - a.w) * k,
    h: a.h + (b.h - a.h) * k,
    lost: a.lost && b.lost,
  };
}

/** Position des SlangTags relativ zum Gesicht speichern (Anteile → Offsets). */
export function faceRelativeOffset(
  tagX: number,
  tagY: number,
  face: FaceTrackPoint,
): { offsetX: number; offsetY: number } {
  const w = Math.max(0.02, face.w);
  const h = Math.max(0.02, face.h);
  return { offsetX: (tagX / 100 - face.x) / w, offsetY: (tagY / 100 - face.y) / h };
}

/** Aktuelle Prozentposition (0..100) eines folgenden SlangTags. */
export function faceFollowPosition(
  follow: SlangTagFollow,
  time: number,
): { x: number; y: number } | null {
  const face = sampleFaceTrack(follow.track, time);
  if (!face) return null;
  const x = (face.x + follow.offsetX * Math.max(0.02, face.w)) * 100;
  const y = (face.y + follow.offsetY * Math.max(0.02, face.h)) * 100;
  return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
}
