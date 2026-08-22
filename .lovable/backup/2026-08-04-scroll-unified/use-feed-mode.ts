import { useCallback, useEffect, useRef, useState } from "react";
import { isFeedModeLocked } from "@/lib/feed-mode-lock";

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
  // Erst wenn der Werbefeed exakt eingerastet ist, übernimmt der Feed das Scrollen.
  const [scrollReady, setScrollReady] = useState(false);
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
    // Restweg exakt ausgleichen -> Werbefeed sitzt beim Umschalten genau in der
    // Kopfzeile, dadurch entsteht kein sichtbarer Sprung und kein Überlappen.
    const ad = adRef.current;
    if (ad) {
      const delta = Math.round(ad.getBoundingClientRect().top - headerH);
      if (delta !== 0) window.scrollTo(0, window.scrollY + delta);
    }
    setFeedMode(true);
    // Werbefeed bleibt optisch an derselben Stelle -> kein Layoutsprung.
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      window.setTimeout(() => {
        busy.current = false;
        setScrollReady(true);
      }, 420);
    });
  }, [headerH]);

  const exit = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setScrollReady(false);
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
      const dy = y - lastY;
      lastY = y;
      const ad = adRef.current;
      // Nur echte Scrollgesten nach unten (>6 px) zaehlen. Kleine Verschiebungen
      // durch Fokus, Tastatur oder Layoutwechsel bleiben ohne Wirkung.
      if (!ad || dy <= 6) return;
      // Waehrend eines offenen SlangTag-Popups/Aufnahme bleibt das Layout ruhig.
      if (isFeedModeLocked()) return;
      // Kleine Toleranz: verhindert Überfahren der Snap-Position bei schnellem Scrollen.
      if (ad.getBoundingClientRect().top <= headerH + 8) enter();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [feedMode, headerH, enter]);

  /**
   * Pull-down direkt auf dem Werbefeed: Die Leiste ist die Greiffläche.
   * Die Bewegung folgt sofort dem Finger (pullY) und löst schon bei einer
   * kleinen Bewegung aus. `preventDefault` verhindert dabei den Browser-Refresh.
   */
  const [pullY, setPullY] = useState(0);

  useEffect(() => {
    if (!feedMode) {
      setPullY(0);
      return;
    }
    const ad = adRef.current;
    if (!ad) return;

    const TRIGGER = 14; // sehr kurzer Ziehweg
    let startY = 0;
    let dragging = false;
    let armed = false;
    let wheel = 0;
    let wheelTimer: number | undefined;

    const onTouchStart = (e: TouchEvent) => {
      dragging = true;
      armed = false;
      startY = e.touches[0]?.clientY ?? 0;
      setPullY(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY;
      if (dy <= 0) {
        setPullY(0);
        return;
      }
      // Geste gehört der Leiste -> Browser-Pull-to-Refresh unterdrücken.
      if (e.cancelable) e.preventDefault();
      setPullY(Math.min(dy * 0.65, 96));
      if (dy > TRIGGER) armed = true;
    };

    const onTouchEnd = () => {
      if (!dragging) return;
      dragging = false;
      setPullY(0);
      if (armed) {
        armed = false;
        exit();
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (window.scrollY > 1 || e.deltaY >= 0) {
        wheel = 0;
        return;
      }
      wheel += -e.deltaY;
      if (wheelTimer) window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => (wheel = 0), 250);
      if (wheel > 40) {
        wheel = 0;
        exit();
      }
    };

    ad.addEventListener("touchstart", onTouchStart, { passive: true });
    ad.addEventListener("touchmove", onTouchMove, { passive: false });
    ad.addEventListener("touchend", onTouchEnd, { passive: true });
    ad.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      ad.removeEventListener("touchstart", onTouchStart);
      ad.removeEventListener("touchmove", onTouchMove);
      ad.removeEventListener("touchend", onTouchEnd);
      ad.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
      if (wheelTimer) window.clearTimeout(wheelTimer);
    };
  }, [feedMode, exit]);

  return { adRef, feedMode, scrollReady, headerH, pullY, exitFeedMode: exit };
}
