/**
 * Reine Ansichts-Mathematik für das ORB-Spiderweb (Zoom/Pan).
 *
 * Ausschließlich Darstellung: hier werden keine Memory-, Importance-,
 * Confidence-, Decay- oder Verbindungswerte berechnet oder verändert.
 * Die Funktionen sind deterministisch und ohne Seiteneffekte.
 */

export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 6;
/** Empfindlichkeit des Mausrads (Faktor je Pixel Delta). */
export const WHEEL_INTENSITY = 0.0015;

export type Viewport = { zoom: number; x: number; y: number };

export const DEFAULT_VIEWPORT: Viewport = { zoom: 1, x: 0, y: 0 };

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Normalisiert Wheel-Deltas (Firefox liefert Zeilen/Seiten statt Pixel). */
export function normalizeWheelDelta(deltaY: number, deltaMode: number) {
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * 100;
  return deltaY;
}

/** Zoomfaktor aus einem normalisierten Wheel-Delta. */
export function wheelZoomFactor(normalizedDeltaY: number) {
  return Math.exp(-normalizedDeltaY * WHEEL_INTENSITY);
}

/**
 * Zoomt um einen Ankerpunkt (in Graph-/viewBox-Koordinaten), sodass der Punkt
 * unter Cursor bzw. Fingermitte stehen bleibt.
 */
export function zoomAt(view: Viewport, factor: number, anchorX: number, anchorY: number): Viewport {
  const zoom = clampZoom(view.zoom * factor);
  const k = zoom / view.zoom;
  return {
    zoom,
    x: anchorX - (anchorX - view.x) * k,
    y: anchorY - (anchorY - view.y) * k,
  };
}

export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  return { zoom: view.zoom, x: view.x + dx, y: view.y + dy };
}

export function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Rechnet Client-Pixel in die feste viewBox-Koordinaten des Graphen um. */
export function toGraphPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  viewBoxWidth: number,
  viewBoxHeight: number,
) {
  const sx = rect.width > 0 ? viewBoxWidth / rect.width : 1;
  const sy = rect.height > 0 ? viewBoxHeight / rect.height : 1;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

export function transformOf(view: Viewport) {
  return `translate(${view.x} ${view.y}) scale(${view.zoom})`;
}

export function zoomPercent(zoom: number) {
  return `${Math.round(zoom * 100)}%`;
}

export function isDefaultViewport(view: Viewport) {
  return view.zoom === DEFAULT_VIEWPORT.zoom && view.x === 0 && view.y === 0;
}
