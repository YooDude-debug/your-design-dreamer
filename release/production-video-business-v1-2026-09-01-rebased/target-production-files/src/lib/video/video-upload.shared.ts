/**
 * Konstanten und Pfadlogik des Video-Uploads.
 *
 * Liegt außerhalb der `*.functions.ts`, weil Dateien mit `createServerFn` beim
 * Build aufgeteilt werden.
 */

/** Pfad des Video-Thumbnails (`…__t.webp` neben dem Video, wie bei Bildern). */
export function videoThumbPath(videoPath: string): string | null {
  const dot = videoPath.lastIndexOf(".");
  if (dot <= 0) return null;
  return `${videoPath.slice(0, dot)}__t.webp`;
}

/** Gehört der Speicherpfad zum angemeldeten Konto und liegt er in `videos/`? */
export function isOwnedVideoPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/videos/`) && !path.includes("..") && path.length <= 400;
}
