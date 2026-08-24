/**
 * Geometrie der dauerhaften Verpixelung unter SlangTags.
 *
 * Die Positionen eines SlangTags sind Prozentwerte des Bildes, die Chip-Größe
 * wird jedoch in CSS-Pixeln gerendert und ist damit relativ zum Bild auf
 * kleinen Displays am größten. Damit die eingebrannte Verpixelung den Chip auf
 * JEDEM Endgerät vollständig abdeckt, wird der größte auftretende Fall
 * (schmales Mobilbild) als Referenz verwendet – plus Sicherheitsrand.
 *
 * Alle Werte sind Bruchteile der Bildbreite (0..1) und damit auflösungs- und
 * zoomunabhängig: die Verpixelung skaliert exakt mit dem Bild.
 */
import type { SlangTagPlacement } from "@/lib/types";

/** Referenzbreite eines Bildes auf einem schmalen Mobilgerät (CSS-Pixel). */
const REF_WIDTH = 390;

/** Chip-Grundmaße je Darstellungsvariante in CSS-Pixeln bei REF_WIDTH. */
const CHIP_SIZE: Record<SlangTagPlacement["variant"], { w: number; h: number }> = {
  glass: { w: 230, h: 130 },
  compact: { w: 190, h: 70 },
  dot: { w: 150, h: 52 },
};

/** Sicherheitsrand, damit Rundungen und Schatten mit abgedeckt sind. */
const MARGIN = 1.1;

export type RedactionRect = {
  /** Mittelpunkt in Bruchteilen der Bildbreite/-höhe (0..1) */
  cx: number;
  cy: number;
  /** Breite und Höhe – beide als Bruchteil der BILDBREITE */
  w: number;
  h: number;
  rotation: number;
};

/**
 * Rechtecke, die beim Veröffentlichen dauerhaft verpixelt werden.
 * Reine Rechenfunktion – identisch auf Client und Server nutzbar.
 */
export function redactionRects(
  placements: Pick<SlangTagPlacement, "x" | "y" | "scale" | "rotation" | "variant">[],
): RedactionRect[] {
  return placements.map((p) => {
    const base = CHIP_SIZE[p.variant] ?? CHIP_SIZE.compact;
    const scale = Math.min(3, Math.max(0.3, p.scale || 1));
    return {
      cx: Math.min(1, Math.max(0, (p.x || 0) / 100)),
      cy: Math.min(1, Math.max(0, (p.y || 0) / 100)),
      w: ((base.w * scale) / REF_WIDTH) * MARGIN,
      h: ((base.h * scale) / REF_WIDTH) * MARGIN,
      rotation: p.rotation || 0,
    };
  });
}
