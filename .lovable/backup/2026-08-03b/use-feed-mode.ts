import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dynamisches Feed-Layout: Sobald der Werbefeed beim Scrollen den oberen
 * Bildschirmrand (unter dem bestehenden Header) erreicht, wechselt die Seite in
 * den erweiterten Feed-Modus. Profil und Composer fahren nach oben aus dem
 * Bild, der Werbefeed dockt oben an und dient als Pull-down-Leiste: Zieht man
 * ihn am oberen Ende des Feeds nach unten, kehrt das Startlayout zurück.
 *
 * Alle Übergänge laufen über transform/opacity (GPU-beschleunigt).
 */
export function useFeedMode<A extends HTMLElement>() {
  const adRef = useRef<A | null>(null);
  const [feedMode, setFeedMode] = useState(false);
  const [headerH, setHeaderH] = useState(52);
  const busy = useRef(false);

  const measure = useCallback(() => {
    const h = document.querySelector("header")?.getBoundingClientRect().height;
    if (h && Math.abs(h - headerH) > 1) setHeaderH(Math.round(h));
  }, [headerH]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const enter = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setFeedMode(true);
    // Werbefeed bleibt optisch an derselben Stelle -> kein Layoutsprung.
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      window.setTimeout(() => (busy.current = false), 420);
    });
  }, []);

  const exit = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setFeedMode(false);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      window.setTimeout(() => (busy.current = false), 420);
    });
  }, []);

  /* Trigger: Werbefeed erreicht den oberen Rand (nur beim Scrollen nach unten) */
  useEffect(() => {
    if (feedMode) return;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const down = y > lastY;
      lastY = y;
      const ad = adRef.current;
      if (!ad || !down) return;
      if (ad.getBoundingClientRect().top <= headerH + 1) enter();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [feedMode, headerH, enter]);

  /* Pull-down auf dem Werbefeed -> Startlayout zurück */
  useEffect(() => {
    if (!feedMode) return;
    const ad = adRef.current;
    let startY = 0;
    let pulling = false;
    let wheel = 0;
    let wheelTimer: number | undefined;

    const atTop = () => window.scrollY <= 1;

    const onTouchStart = (e: TouchEvent) => {
      pulling = atTop();
      startY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pulling || !atTop()) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY;
      if (dy > 70) {
        pulling = false;
        exit();
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!atTop() || e.deltaY >= 0) {
        wheel = 0;
        return;
      }
      wheel += -e.deltaY;
      if (wheelTimer) window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => (wheel = 0), 250);
      if (wheel > 120) {
        wheel = 0;
        exit();
      }
    };

    ad?.addEventListener("touchstart", onTouchStart, { passive: true });
    ad?.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      ad?.removeEventListener("touchstart", onTouchStart);
      ad?.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("wheel", onWheel);
      if (wheelTimer) window.clearTimeout(wheelTimer);
    };
  }, [feedMode, exit]);

  return { adRef, feedMode, headerH, exitFeedMode: exit };
}
