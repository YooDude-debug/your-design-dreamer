/**
 * SlangTag Videos (Shorts) – zentrale Medienlogik.
 *
 * Regeln (bewusst eng gehalten, damit später erweiterbar):
 * - maximal 5,0 Sekunden
 * - das Video hat NIE eine eigene Tonspur: beim Aufbereiten wird
 *   ausschliesslich die Bildspur uebernommen (`getVideoTracks()`).
 * - der Ton eines Shorts ist immer der SlangTag (separates Audio,
 *   bestehende SlangTag-Logik, nichts wird ins Video eingebrannt).
 *
 * Es gibt keinen Videoeditor: laengere Videos werden auf die ersten
 * 5 Sekunden gekuerzt, Aufnahmen stoppen automatisch nach 5 Sekunden.
 */

/** Harte Obergrenze fuer SlangTag-Videos in Sekunden. */
export const SHORT_VIDEO_MAX_SECONDS = 5;
/** Kleine Toleranz fuer Metadaten-Rundungen (z. B. 5,02 s). */
export const SHORT_VIDEO_TOLERANCE = 0.15;
/** Grenze fuer den Upload (Bildspur, 5 s, ohne Ton). */
export const SHORT_VIDEO_MAX_BYTES = 25 * 1024 * 1024;

export type ShortVideoInfo = {
  seconds: number;
  width: number;
  height: number;
};

type CaptureElement = HTMLVideoElement & { captureStream?: () => MediaStream };

function preferredMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

/** Liest Laenge und Maße eines Videos, ohne es abzuspielen. */
export function probeVideo(source: Blob): Promise<ShortVideoInfo | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const url = URL.createObjectURL(source);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    const done = (info: ShortVideoInfo | null) => {
      URL.revokeObjectURL(url);
      resolve(info);
    };
    el.onloadedmetadata = () => {
      const seconds = Number.isFinite(el.duration) ? el.duration : 0;
      done({ seconds, width: el.videoWidth, height: el.videoHeight });
    };
    el.onerror = () => done(null);
    el.src = url;
  });
}

/** Ist die Datei ohne Kuerzen erlaubt? */
export function withinShortLimit(seconds: number) {
  return seconds > 0 && seconds <= SHORT_VIDEO_MAX_SECONDS + SHORT_VIDEO_TOLERANCE;
}

export function shortVideoSupported() {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") return false;
  const el = document.createElement("video") as CaptureElement;
  return typeof el.captureStream === "function" && !!preferredMime();
}

/**
 * Bereitet ein ausgewaehltes Video fuer Y-Dude auf:
 * - kuerzt auf maximal 5 Sekunden
 * - uebernimmt ausschliesslich die Bildspur (Originalton entfaellt vollstaendig)
 *
 * Rueckgabe: stummes Video-Blob oder null (Aufbereitung nicht moeglich).
 */
export async function prepareSilentShort(
  source: Blob,
  maxSeconds: number = SHORT_VIDEO_MAX_SECONDS,
): Promise<{ blob: Blob; seconds: number } | null> {
  if (!shortVideoSupported()) return null;
  const mime = preferredMime();
  if (!mime) return null;

  const url = URL.createObjectURL(source);
  const el = document.createElement("video") as CaptureElement;
  el.src = url;
  el.muted = true;
  el.volume = 0;
  el.playsInline = true;
  el.preload = "auto";

  const cleanup = () => {
    el.pause();
    el.removeAttribute("src");
    el.load();
    URL.revokeObjectURL(url);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      el.onloadedmetadata = () => resolve();
      el.onerror = () => reject(new Error("video metadata failed"));
    });

    const stream = el.captureStream?.();
    if (!stream) return null;
    // Ausschliesslich Bildspur – die Tonspur des Originals wird nie verwendet.
    const videoTracks = stream.getVideoTracks();
    stream.getAudioTracks().forEach((track) => {
      track.stop();
      stream.removeTrack(track);
    });
    if (videoTracks.length === 0) return null;
    const silent = new MediaStream(videoTracks);

    const recorder = new MediaRecorder(silent, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    const started = Date.now();
    recorder.start(100);
    el.currentTime = 0;
    await el.play().catch(() => undefined);

    const limit = Math.min(maxSeconds, SHORT_VIDEO_MAX_SECONDS);
    await new Promise<void>((resolve) => {
      const finish = () => {
        window.clearInterval(timer);
        resolve();
      };
      const timer = window.setInterval(() => {
        if (el.ended || el.currentTime >= limit) finish();
      }, 50);
      el.onended = finish;
    });

    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    videoTracks.forEach((t) => t.stop());

    const blob = new Blob(chunks, { type: mime.split(";")[0] });
    if (blob.size === 0) return null;
    const seconds = Math.min(limit, Math.max(0.5, (Date.now() - started) / 1000));
    return { blob, seconds };
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

/** Millisekunden fuer die Datenbank (immer <= 5000). */
export function shortVideoMs(seconds: number) {
  return Math.min(SHORT_VIDEO_MAX_SECONDS * 1000, Math.max(0, Math.round(seconds * 1000)));
}

/**
 * Erstes Bild eines Shorts als Standbild (Data-URL). Dieses Standbild ist die
 * Bildgrundlage des Beitrags: Vorschau im Composer, Feed-Thumbnail und
 * verpixelte Teilen-Vorschau nutzen exakt die bestehende Bildlogik.
 */
export function shortVideoPoster(source: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const url = URL.createObjectURL(source);
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    const done = (value: string | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const draw = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = el.videoWidth || 720;
        canvas.height = el.videoHeight || 1280;
        const ctx = canvas.getContext("2d");
        if (!ctx) return done(null);
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/jpeg", 0.9));
      } catch {
        done(null);
      }
    };
    el.onloadeddata = () => {
      if (el.readyState >= 2) {
        el.currentTime = Math.min(0.1, (el.duration || 1) / 10);
      }
    };
    el.onseeked = draw;
    el.onerror = () => done(null);
    el.src = url;
  });
}
