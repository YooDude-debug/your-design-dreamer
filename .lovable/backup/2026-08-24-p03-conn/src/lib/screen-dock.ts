/**
 * Andocken kleiner Werkzeugfenster (SlangTag-Vorschläge / -Aufnahme) am
 * oberen sichtbaren Bildschirmbereich.
 *
 * Grundsatz bleibt: keine Reaktion auf Dokument-Scroll. Die Position wird
 * jedoch am *sichtbaren* Viewport ausgerichtet (`visualViewport`), weil
 * Android/Chrome beim Öffnen der Tastatur den visuellen Viewport verkleinert
 * und verschiebt (`offsetTop`), während `position: fixed` weiter am
 * Layout-Viewport klebt. Ohne diese Korrektur wandert ein Fenster mit
 * `top: 10px` hinter bzw. über den sichtbaren Bereich und ist unsichtbar.
 */
import { useEffect, useState } from "react";

/** Abstand zum oberen Bildschirmrand (inkl. Platz für Notch/Statusleiste). */
export const DOCK_TOP = 10;

export type DockRect = { left: number; top: number; width: number };

/** Aktuell sichtbarer Bereich in Layout-Viewport-Koordinaten (fixed-Bezug). */
export function visibleViewport(): { top: number; left: number; width: number; height: number } {
  if (typeof window === "undefined") return { top: 0, left: 0, width: 320, height: 640 };
  const vv = window.visualViewport;
  if (!vv) return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
  // offsetTop/offsetLeft: Versatz des visuellen gegenüber dem Layout-Viewport.
  return {
    top: Math.max(0, Math.round(vv.offsetTop)),
    left: Math.max(0, Math.round(vv.offsetLeft)),
    width: Math.round(vv.width),
    height: Math.round(vv.height),
  };
}

/** Sichtbare Breite abzüglich Rand. */
export function dockWidth(max = 520): number {
  const v = visibleViewport();
  return Math.round(Math.min(max, v.width - 16));
}

/** Fenster am oberen sichtbaren Bildschirmbereich, optional darunter gestapelt. */
export function topDock(offset = 0, max = 520): DockRect {
  const v = visibleViewport();
  const width = dockWidth(max);
  const left = Math.round(Math.max(v.left + 8, v.left + v.width / 2 - width / 2));
  return { left, top: v.top + DOCK_TOP + Math.round(offset), width };
}

/** Nutzbare Höhe für ein oben angedocktes Fenster (immer im sichtbaren Bereich). */
export function dockMaxHeight(offset = 0, cap = 360): number {
  const v = visibleViewport();
  const room = v.height - DOCK_TOP - offset - 8;
  return Math.max(120, Math.min(cap, Math.round(room)));
}

/**
 * Hält eine Position im sichtbaren Viewport: verschiebt nur, wenn das Fenster
 * sonst (teilweise) unsichtbar wäre – z. B. hinter der Tastatur oder oberhalb
 * des sichtbaren Bereichs. Kein Dokument-Scroll, keine Layout-Änderung.
 */
export function clampToVisible(
  rect: { left: number; top: number; width: number },
  height: number,
): { left: number; top: number } {
  const v = visibleViewport();
  const maxTop = Math.max(v.top + DOCK_TOP, v.top + v.height - height - 8);
  const minTop = v.top + DOCK_TOP;
  const top = Math.min(Math.max(rect.top, minTop), Math.max(minTop, maxTop));
  const maxLeft = Math.max(v.left + 8, v.left + v.width - rect.width - 8);
  const left = Math.min(Math.max(rect.left, v.left + 8), maxLeft);
  return { left: Math.round(left), top: Math.round(top) };
}

/**
 * Re-Render, sobald sich der sichtbare Viewport ändert (Tastatur auf/zu,
 * Pinch-Zoom, Rotation). Bewusst nur `visualViewport` – kein `window.scroll`.
 */
export function useVisibleViewport(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!vv) return;
    const onChange = () => setTick((n) => n + 1);
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    };
  }, []);
  return tick;
}
