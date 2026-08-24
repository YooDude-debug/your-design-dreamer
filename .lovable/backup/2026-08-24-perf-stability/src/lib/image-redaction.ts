/**
 * Einbrennen der Verpixelung unter SlangTags (einmalig beim Veröffentlichen).
 *
 * Das Ergebnis ist die VERÖFFENTLICHTE Bildversion: Der Bereich unter jedem
 * SlangTag ist dauerhaft im Pixelmaterial zerstört. Wird im Browser das
 * SlangTag entfernt oder HTML/CSS/JS manipuliert, bleibt darunter ausschließlich
 * das Mosaik – der Originalinhalt existiert in dieser Datei nicht mehr.
 *
 * Das Original wird davon unabhängig unverändert privat gespeichert.
 */
import { redactionRects } from "@/lib/slangtag-redaction";
import type { SlangTagPlacement } from "@/lib/types";

/** Kantenlänge eines Mosaikblocks relativ zur Bildbreite. */
const BLOCK_DIV = 28;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode failed"));
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Stark verkleinerte Kopie – Grundlage des Mosaiks. */
function mosaicSource(img: HTMLImageElement, w: number, h: number) {
  const small = document.createElement("canvas");
  small.width = Math.max(2, Math.round(w / BLOCK_DIV));
  small.height = Math.max(2, Math.round(h / BLOCK_DIV));
  const sctx = small.getContext("2d");
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0, small.width, small.height);
  return small;
}

/**
 * Erzeugt die veröffentlichte Bildversion mit eingebrannter Verpixelung.
 * Liefert `null`, wenn nichts zu tun ist oder die Verarbeitung nicht möglich ist
 * (dann wird ohne SlangTag-Bereiche gearbeitet – es gibt dann auch nichts zu
 * schützen, weil ohne Platzierung kein Bereich verdeckt wird).
 */
export async function renderRedactedImage(
  dataUrl: string,
  placements: Pick<SlangTagPlacement, "x" | "y" | "scale" | "rotation" | "variant">[],
): Promise<string | null> {
  const rects = redactionRects(placements);
  if (rects.length === 0) return null;
  if (typeof document === "undefined") return null;

  try {
    const img = await loadImage(dataUrl);
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;
    if (!W || !H) return null;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, W, H);

    const small = mosaicSource(img, W, H);
    if (!small) return null;

    for (const r of rects) {
      const cx = r.cx * W;
      const cy = r.cy * H;
      const w = r.w * W;
      const h = r.h * W; // Höhe ebenfalls über die Breite – Chips sind breitenbezogen
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((r.rotation * Math.PI) / 180);
      roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.18);
      ctx.clip();
      // Zurück in Bildkoordinaten: der Beschnitt bleibt bestehen.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.restore();
    }

    const type = canvas.toDataURL("image/webp").startsWith("data:image/webp")
      ? "image/webp"
      : "image/jpeg";
    return canvas.toDataURL(type, 0.92);
  } catch (e) {
    console.warn("[redaction] failed", e);
    return null;
  }
}
