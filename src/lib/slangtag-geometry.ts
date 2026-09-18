/**
 * Reine Geometrie: Rechteck des dargestellten Bildes innerhalb eines
 * Containers – "contain" (eingepasst, komplett sichtbar) oder "cover"
 * (flächenfüllend, zentriert beschnitten; das Rechteck kann über den
 * Container hinausragen). Muss exakt der CSS-Darstellung entsprechen,
 * damit SlangTag-Prozentkoordinaten auf dem sichtbaren Bild liegen.
 */
export function fittedImageRect(
  mode: "contain" | "cover",
  w: number,
  h: number,
  natW: number,
  natH: number,
): { x: number; y: number; w: number; h: number } {
  if (!natW || !natH || !w || !h) return { x: 0, y: 0, w, h };
  const s = mode === "cover" ? Math.max(w / natW, h / natH) : Math.min(w / natW, h / natH);
  const iw = natW * s;
  const ih = natH * s;
  return { x: (w - iw) / 2, y: (h - ih) / 2, w: iw, h: ih };
}
