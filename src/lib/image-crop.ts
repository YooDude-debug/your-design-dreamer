export type CropRect = { x: number; y: number; w: number; h: number };

/**
 * Schneidet den im Beitragsersteller gewählten Ausschnitt (Anteile 0..1 des
 * Originalbildes) aus einem Bild-DataURL heraus. Fällt bei Fehlern auf das
 * Originalbild zurück – die bestehende Upload-Logik bleibt unverändert.
 */
export async function cropImageDataUrl(dataUrl: string, crop: CropRect): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  if (crop.w >= 0.999 && crop.h >= 0.999) return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.decoding = "async";
      el.src = dataUrl;
    });
    const sw = Math.max(1, Math.round(img.naturalWidth * crop.w));
    const sh = Math.max(1, Math.round(img.naturalHeight * crop.h));
    const sx = Math.max(0, Math.min(img.naturalWidth - sw, Math.round(img.naturalWidth * crop.x)));
    const sy = Math.max(0, Math.min(img.naturalHeight - sh, Math.round(img.naturalHeight * crop.y)));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const type = dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";
    return canvas.toDataURL(type, type === "image/jpeg" ? 0.92 : undefined);
  } catch {
    return dataUrl;
  }
}

/** Position (in % des Originalbildes) auf den Ausschnitt umrechnen. */
export function remapPercent(x: number, y: number, crop: CropRect) {
  return {
    x: Math.min(100, Math.max(0, ((x / 100 - crop.x) / crop.w) * 100)),
    y: Math.min(100, Math.max(0, ((y / 100 - crop.y) / crop.h) * 100)),
  };
}
