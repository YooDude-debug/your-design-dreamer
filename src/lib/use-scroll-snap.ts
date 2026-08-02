import { useEffect, useRef } from "react";

/**
 * Intelligentes, JS-basiertes Scroll-Snapping.
 * Während des Scrollens passiert nichts. Erst wenn das Scrollen endet und das
 * Element zu mindestens `threshold` sichtbar ist, wird es sanft an den oberen
 * Bildschirmrand animiert. Jede Nutzer-Interaktion bricht die Animation ab.
 */
export function useScrollSnapTarget<T extends HTMLElement>(options?: {
  /** Sichtbarkeitsanteil, ab dem eingerastet wird (0–1). */
  threshold?: number;
  /** Abstand zum oberen Rand (z. B. Header-Höhe) in px. */
  offset?: number;
  /** Wartezeit nach dem letzten Scroll-Event in ms. */
  delay?: number;
  /** Snapping aktiv? */
  enabled?: boolean;
}) {
  const ref = useRef<T | null>(null);
  const threshold = options?.threshold ?? 0.6;
  const offset = options?.offset ?? 56;
  const delay = options?.delay ?? 140;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;

    let timer: number | undefined;
    let raf = 0;
    let animating = false;
    let lastSnappedTop: number | null = null;

    const cancelAnim = () => {
      animating = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const animateTo = (target: number) => {
      const start = window.scrollY;
      const dist = target - start;
      if (Math.abs(dist) < 2) return;
      const duration = Math.min(600, Math.max(220, Math.abs(dist) * 1.4));
      const t0 = performance.now();
      animating = true;
      const step = (now: number) => {
        if (!animating) return;
        const p = Math.min(1, (now - t0) / duration);
        // easeInOutCubic – weich und natürlich
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo(0, start + dist * e);
        if (p < 1) raf = requestAnimationFrame(step);
        else animating = false;
      };
      raf = requestAnimationFrame(step);
    };

    const maybeSnap = () => {
      if (animating) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, offset);
      const ratio = rect.height > 0 ? visible / rect.height : 0;
      if (ratio < threshold) {
        lastSnappedTop = null;
        return;
      }
      const target = Math.round(window.scrollY + rect.top - offset);
      if (Math.abs(window.scrollY - target) < 4) return;
      if (lastSnappedTop !== null && Math.abs(lastSnappedTop - target) < 4) return;
      lastSnappedTop = target;
      animateTo(target);
    };

    const onScroll = () => {
      if (animating) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(maybeSnap, delay);
    };

    const onUserInteract = () => {
      cancelAnim();
      lastSnappedTop = null;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onUserInteract, { passive: true });
    window.addEventListener("touchstart", onUserInteract, { passive: true });
    window.addEventListener("pointerdown", onUserInteract, { passive: true });
    window.addEventListener("keydown", onUserInteract);

    return () => {
      if (timer) window.clearTimeout(timer);
      cancelAnim();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onUserInteract);
      window.removeEventListener("touchstart", onUserInteract);
      window.removeEventListener("pointerdown", onUserInteract);
      window.removeEventListener("keydown", onUserInteract);
    };
  }, [enabled, threshold, offset, delay]);

  return ref;
}
