/**
 * Andocken kleiner Werkzeugfenster (SlangTag-Vorschläge / -Aufnahme) am
 * oberen sichtbaren Bildschirmbereich.
 *
 * Bewusst ohne Listener auf `scroll`, `resize` oder `visualViewport`:
 * die Position wird aus dem Layout-Viewport abgeleitet, der beim Öffnen und
 * Schließen der Tastatur konstant bleibt. Dokument-Scroll, Fokus, VAD und
 * Speech-to-Text verändern die Position dadurch nie.
 */

/** Abstand zum oberen Bildschirmrand (inkl. Platz für Notch/Statusleiste). */
export const DOCK_TOP = 10;

export type DockRect = { left: number; top: number; width: number };

/** Sichtbare Breite abzüglich Rand – unabhängig von der Tastatur. */
export function dockWidth(max = 520): number {
  if (typeof window === "undefined") return 320;
  return Math.round(Math.min(max, window.innerWidth - 16));
}

/** Fenster am oberen sichtbaren Bildschirmbereich, optional darunter gestapelt. */
export function topDock(offset = 0, max = 520): DockRect {
  const width = dockWidth(max);
  const left = Math.round(Math.max(8, (typeof window === "undefined" ? 320 : window.innerWidth) / 2 - width / 2));
  return { left, top: DOCK_TOP + Math.round(offset), width };
}

/** Nutzbare Höhe für ein oben angedocktes Fenster (tastaturunabhängig). */
export function dockMaxHeight(offset = 0, cap = 360): number {
  if (typeof window === "undefined") return 320;
  return Math.max(160, Math.min(cap, Math.round(window.innerHeight * 0.5) - offset));
}
