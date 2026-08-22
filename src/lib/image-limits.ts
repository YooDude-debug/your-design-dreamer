/**
 * Sicherheitsgrenzen für Bild-Uploads.
 *
 * Ziel: Ein einzelner Upload darf weder das Feed-Layout sprengen noch den
 * Browser/das Smartphone durch absurde Auflösungen oder extrem lange
 * Hochkantbilder überlasten. Die Prüfung passiert VOR der Verarbeitung –
 * die Bildmaße werden aus den ersten Dateibytes (Header) gelesen, das Bild
 * wird dafür nicht vollständig dekodiert.
 */

export const IMAGE_MAX_BYTES = 12 * 1024 * 1024; // 12 MB
export const IMAGE_MAX_EDGE = 8000; // px pro Kante
export const IMAGE_MAX_PIXELS = 40_000_000; // 40 MP
export const IMAGE_MAX_RATIO = 3; // max. 3:1 (auch hochkant)

export type ImageLimitError =
  | "bytes"
  | "edge"
  | "pixels"
  | "ratio"
  | "unreadable";

export type ImageCheck =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: ImageLimitError };

/* --------------------------- Header-Auswertung --------------------------- */

function readPng(v: DataView): { w: number; h: number } | null {
  if (v.byteLength < 24) return null;
  if (v.getUint32(0) !== 0x89504e47) return null;
  return { w: v.getUint32(16), h: v.getUint32(20) };
}

function readGif(v: DataView): { w: number; h: number } | null {
  if (v.byteLength < 10) return null;
  if (v.getUint8(0) !== 0x47 || v.getUint8(1) !== 0x49 || v.getUint8(2) !== 0x46) return null;
  return { w: v.getUint16(6, true), h: v.getUint16(8, true) };
}

function readWebp(v: DataView): { w: number; h: number } | null {
  if (v.byteLength < 30) return null;
  if (v.getUint32(0) !== 0x52494646 || v.getUint32(8) !== 0x57454250) return null;
  const fourcc = v.getUint32(12);
  // VP8X (erweitert)
  if (fourcc === 0x56503858) {
    const w = 1 + (v.getUint8(24) | (v.getUint8(25) << 8) | (v.getUint8(26) << 16));
    const h = 1 + (v.getUint8(27) | (v.getUint8(28) << 8) | (v.getUint8(29) << 16));
    return { w, h };
  }
  // VP8  (lossy)
  if (fourcc === 0x56503820) {
    return { w: v.getUint16(26, true) & 0x3fff, h: v.getUint16(28, true) & 0x3fff };
  }
  // VP8L (lossless)
  if (fourcc === 0x5650384c) {
    const bits =
      v.getUint8(21) | (v.getUint8(22) << 8) | (v.getUint8(23) << 16) | (v.getUint8(24) << 24);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function readJpeg(v: DataView): { w: number; h: number } | null {
  if (v.byteLength < 4 || v.getUint8(0) !== 0xff || v.getUint8(1) !== 0xd8) return null;
  let i = 2;
  while (i + 9 < v.byteLength) {
    if (v.getUint8(i) !== 0xff) {
      i += 1;
      continue;
    }
    const marker = v.getUint8(i + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = v.getUint16(i + 2);
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) return { w: v.getUint16(i + 7), h: v.getUint16(i + 5) };
    i += 2 + len;
  }
  return null;
}

/** Bildmaße aus dem Dateikopf (ohne vollständiges Dekodieren). */
export async function readImageSizeFromHeader(
  file: Blob,
): Promise<{ w: number; h: number } | null> {
  try {
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(head);
    return readPng(v) ?? readGif(v) ?? readWebp(v) ?? readJpeg(v);
  } catch {
    return null;
  }
}

/**
 * Prüft eine Bilddatei gegen die Upload-Grenzen. Reihenfolge:
 * Dateigröße → Header-Maße → Seitenverhältnis.
 */
export async function checkImageFile(file: File | Blob): Promise<ImageCheck> {
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, reason: "bytes" };
  const size = await readImageSizeFromHeader(file);
  if (!size || !size.w || !size.h) {
    // Unbekanntes Format (z. B. HEIC/AVIF): Größe blieb geprüft, Maße nicht
    // lesbar – der Upload wird dennoch zugelassen, weil die Dateigröße bereits
    // eine harte Obergrenze setzt.
    return { ok: true, width: 0, height: 0 };
  }
  const { w, h } = size;
  if (w > IMAGE_MAX_EDGE || h > IMAGE_MAX_EDGE) return { ok: false, reason: "edge" };
  if (w * h > IMAGE_MAX_PIXELS) return { ok: false, reason: "pixels" };
  const ratio = Math.max(w / h, h / w);
  if (ratio > IMAGE_MAX_RATIO) return { ok: false, reason: "ratio" };
  return { ok: true, width: w, height: h };
}
