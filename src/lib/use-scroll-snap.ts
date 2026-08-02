import { useEffect, useRef } from "react";

/** Nur echte Smartphones: Touch-Gerät mit schmalem Viewport. */
function isPhone() {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = Math.min(window.innerWidth, window.innerHeight) <= 480;
  return coarse && narrow;
}

/**
 * Sanftes, JS-basiertes Scroll-Snapping – ausschließlich auf Smartphones.
 *
 * Während des Scrollens passiert nichts. Erst wenn das Scrollen endet UND der
 * Feed-Bereich unter dem Werbefeed sichtbar wird, richtet sich die Seite einmal
 * sanft so aus, dass der Werbefeed oben beginnt. Danach normales Scrollen.
 */
export function useAdFeedSnap<A extends HTMLElement, F extends HTMLElement>(options?: {
  /** Abstand zum oberen Rand (Header-Höhe) in px. */
  offset?: number;
  /** Wartezeit nach dem letzten Scroll-Event in ms. */
  delay?: number;
}) {
  const adRef = useRef<A | null>(null);
  const feedRef = useRef<F | null>(null);
  const offset = options?.offset ?? 56;
  const delay = options?.delay ?? 140;

  useEffect(() => {
    if (!isPhone()) return;

    let timer: number | undefined;
    let raf = 0;
    let animating = false;
    let armed = true; // Einrasten steht noch aus
    let lastY = window.scrollY;

    const cancelAnim = () => {
      animating = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const animateTo = (target: number) => {
      const start = window.scrollY;
      const dist = target - start;
      if (Math.abs(dist) < 3) return;
      const duration = Math.min(600, Math.max(240, Math.abs(dist) * 1.4));
      const t0 = performance.now();
      animating = true;
      const step = (now: number) => {
        if (!animating) return;
        const p = Math.min(1, (now - t0) / duration);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo(0, start + dist * e);
        if (p < 1) raf = requestAnimationFrame(step);
        else animating = false;
      };
      raf = requestAnimationFrame(step);
    };

    const maybeSnap = () => {
      if (animating) return;
      const ad = adRef.current;
      const feed = feedRef.current;
      if (!ad || !feed) return;

      const adRect = ad.getBoundingClientRect();
      const feedRect = feed.getBoundingClientRect();
      const vh = window.innerHeight;

      // Zurückgescrollt über den Werbefeed hinaus -> Snap wieder scharf stellen
      if (adRect.top > vh * 0.9) {
        armed = true;
        return;
      }
      if (!armed) return;

      // Übergang Werbefeed -> Feed: Feed ist sichtbar, Werbefeed noch nicht vorbei
      const feedVisible = feedRect.top < vh - 24;
      const adStillRelevant = adRect.bottom > offset;
      if (!feedVisible || !adStillRelevant) return;

      const target = Math.round(window.scrollY + adRect.top - offset);
      armed = false;
      animateTo(target);
    };

    const onScroll = () => {
      if (animating) return;
      const y = window.scrollY;
      const down = y > lastY;
      lastY = y;
      if (timer) window.clearTimeout(timer);
      // nur beim Scrollen nach unten unterstützen
      if (down) timer = window.setTimeout(maybeSnap, delay);
    };

    const onUserInteract = () => cancelAnim();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", onUserInteract, { passive: true });
    window.addEventListener("pointerdown", onUserInteract, { passive: true });
    window.addEventListener("wheel", onUserInteract, { passive: true });
    window.addEventListener("keydown", onUserInteract);

    return () => {
      if (timer) window.clearTimeout(timer);
      cancelAnim();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onUserInteract);
      window.removeEventListener("pointerdown", onUserInteract);
      window.removeEventListener("wheel", onUserInteract);
      window.removeEventListener("keydown", onUserInteract);
    };
  }, [offset, delay]);

  return { adRef, feedRef };
}
