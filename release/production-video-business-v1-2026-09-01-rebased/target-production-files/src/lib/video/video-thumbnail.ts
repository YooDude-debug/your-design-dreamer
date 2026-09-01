/**
 * Deterministische Thumbnail-Auswahl für Beitragsvideos.
 *
 * Kein KI-System: es werden wenige feste Zeitpunkte geprüft (10 %, 25 %, 50 %)
 * und derjenige Frame gewählt, der nicht praktisch schwarz oder einfarbig ist.
 * Findet sich keiner, wird der erste geprüfte Frame verwendet – ein Thumbnail
 * ist besser als keines. Ausgabe ist WebP, passend zur bestehenden Bildlogik.
 */

const SAMPLE_FRACTIONS = [0.1, 0.25, 0.5];
const THUMB_MAX_EDGE = 720;

export type FrameStats = { meanLuma: number; variance: number };

/** Ist der Frame praktisch schwarz oder eine leere Fläche? */
export function isWeakFrame(stats: FrameStats): boolean {
  return stats.meanLuma < 12 || stats.variance < 40;
}

export function frameStatsFromPixels(pixels: Uint8ClampedArray): FrameStats {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  // Grobes Raster genügt und hält die Prüfung schnell.
  for (let i = 0; i < pixels.length; i += 4 * 8) {
    const luma = 0.299 * pixels[i]! + 0.587 * pixels[i + 1]! + 0.114 * pixels[i + 2]!;
    sum += luma;
    sumSq += luma * luma;
    count += 1;
  }
  if (count === 0) return { meanLuma: 0, variance: 0 };
  const mean = sum / count;
  return { meanLuma: mean, variance: sumSq / count - mean * mean };
}

function seek(el: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      el.removeEventListener("seeked", onSeeked);
      resolve();
    };
    el.addEventListener("seeked", onSeeked);
    el.onerror = () => reject(new Error("seek failed"));
    el.currentTime = time;
  });
}

/** Liefert ein WebP-Thumbnail oder `null`, wenn der Browser es nicht erzeugen kann. */
export async function pickVideoThumbnail(source: Blob): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(source);
  const el = document.createElement("video");
  el.muted = true;
  el.playsInline = true;
  el.preload = "auto";
  el.src = url;

  const cleanup = () => {
    el.removeAttribute("src");
    el.load();
    URL.revokeObjectURL(url);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      el.onloadedmetadata = () => resolve();
      el.onerror = () => reject(new Error("metadata failed"));
    });
    const duration = Number.isFinite(el.duration) ? el.duration : 0;
    if (duration <= 0) return null;

    const width = el.videoWidth || 720;
    const height = el.videoHeight || 1280;
    const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    let fallback: Blob | null = null;
    for (const fraction of SAMPLE_FRACTIONS) {
      await seek(el, Math.min(duration - 0.05, Math.max(0.05, duration * fraction)));
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      const stats = frameStatsFromPixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/webp", 0.8),
      );
      if (!blob) continue;
      fallback ??= blob;
      if (!isWeakFrame(stats)) return blob;
    }
    return fallback;
  } catch {
    return null;
  } finally {
    cleanup();
  }
}
