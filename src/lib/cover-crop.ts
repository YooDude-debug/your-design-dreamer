import type { CropRect } from "@/lib/image-crop";

/**
 * Rechenkern der Hintergrundbild-Positionierung.
 *
 * Das Bild wird im Vorschaurahmen formatfüllend eingepasst (wie im echten
 * Profil-Header) und kann darüber hinaus gezoomt und verschoben werden.
 * Daraus ergibt sich der Ausschnitt (Anteile 0..1 des Originalbildes), der
 * beim Übernehmen dauerhaft in das Bild gerechnet wird.
 */
export type CoverView = {
  frameW: number;
  frameH: number;
  imageW: number;
  imageH: number;
  /** >= 1; 1 = formatfüllend eingepasst */
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const COVER_MIN_SCALE = 1;
export const COVER_MAX_SCALE = 4;

/** Formatfüllende Grundgröße des Bildes im Rahmen (ohne Zoom). */
export function coverFitSize(v: Pick<CoverView, "frameW" | "frameH" | "imageW" | "imageH">) {
  const frameRatio = v.frameW / Math.max(1, v.frameH);
  const imageRatio = v.imageW / Math.max(1, v.imageH);
  if (imageRatio > frameRatio) return { w: v.frameH * imageRatio, h: v.frameH };
  return { w: v.frameW, h: v.frameW / imageRatio };
}

/** Angezeigte Bildgröße inklusive Zoom. */
export function coverDisplaySize(v: CoverView) {
  const scale = Math.min(COVER_MAX_SCALE, Math.max(COVER_MIN_SCALE, v.scale));
  const fit = coverFitSize(v);
  return { w: fit.w * scale, h: fit.h * scale };
}

/** Maximale Verschiebung – das Bild bleibt immer randlos. */
export function coverMaxOffset(v: CoverView) {
  const d = coverDisplaySize(v);
  return {
    x: Math.max(0, (d.w - v.frameW) / 2),
    y: Math.max(0, (d.h - v.frameH) / 2),
  };
}

/** Verschiebung auf den erlaubten Bereich begrenzen. */
export function clampCoverOffset(v: CoverView) {
  const max = coverMaxOffset(v);
  return {
    x: Math.min(max.x, Math.max(-max.x, v.offsetX)),
    y: Math.min(max.y, Math.max(-max.y, v.offsetY)),
  };
}

/** Sichtbarer Ausschnitt als Anteile 0..1 des Originalbildes. */
export function computeCoverCrop(v: CoverView): CropRect {
  const d = coverDisplaySize(v);
  const off = clampCoverOffset(v);
  const w = Math.min(1, v.frameW / d.w);
  const h = Math.min(1, v.frameH / d.h);
  const x = Math.min(1 - w, Math.max(0, ((d.w - v.frameW) / 2 - off.x) / d.w));
  const y = Math.min(1 - h, Math.max(0, ((d.h - v.frameH) / 2 - off.y) / d.h));
  return { x, y, w, h };
}
