/**
 * Globales Browser-/Viewport-Zoom unterdruecken – die PWA soll sich wie eine
 * native App verhalten. Ausnahme: Elemente innerhalb von
 * `[data-zoom-surface]` (zentrale Bild-Viewer-Komponente) behalten ihre
 * eigenen Zoom-/Pan-Gesten.
 */
const isZoomSurface = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("[data-zoom-surface]");

export function installGlobalZoomGuards(): () => void {
  if (typeof window === "undefined") return () => undefined;

  // iOS Safari: proprietaere Gesture-Events (Pinch-Zoom der ganzen Seite)
  const onGesture = (e: Event) => {
    if (isZoomSurface(e.target)) return;
    e.preventDefault();
  };

  // Multi-Touch ausserhalb des Viewers erzeugt keinen Seiten-Zoom mehr
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length < 2 || isZoomSurface(e.target)) return;
    e.preventDefault();
  };

  // Doppeltipp-Zoom (iOS) unterdruecken
  let lastTouchEnd = 0;
  const onTouchEnd = (e: TouchEvent) => {
    if (isZoomSurface(e.target)) return;
    const now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  };

  // Trackpad-Pinch / Strg+Wheel (Browser-Zoom am Desktop)
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey || isZoomSurface(e.target)) return;
    e.preventDefault();
  };

  // Strg/Cmd +, -, 0
  const onKeyDown = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (["+", "-", "=", "0"].includes(e.key)) e.preventDefault();
  };

  const opts = { passive: false } as AddEventListenerOptions;
  document.addEventListener("gesturestart", onGesture, opts);
  document.addEventListener("gesturechange", onGesture, opts);
  document.addEventListener("gestureend", onGesture, opts);
  document.addEventListener("touchmove", onTouchMove, opts);
  document.addEventListener("touchend", onTouchEnd, opts);
  document.addEventListener("wheel", onWheel, opts);
  window.addEventListener("keydown", onKeyDown);

  return () => {
    document.removeEventListener("gesturestart", onGesture, opts);
    document.removeEventListener("gesturechange", onGesture, opts);
    document.removeEventListener("gestureend", onGesture, opts);
    document.removeEventListener("touchmove", onTouchMove, opts);
    document.removeEventListener("touchend", onTouchEnd, opts);
    document.removeEventListener("wheel", onWheel, opts);
    window.removeEventListener("keydown", onKeyDown);
  };
}
