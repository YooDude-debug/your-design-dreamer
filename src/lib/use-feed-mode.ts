import { useCallback, useEffect, useRef, useState } from "react";
import { isFeedModeLocked } from "@/lib/feed-mode-lock";

/**
 * Sticky-Werbefeed – EINZIGE aktive Sticky-/Scroll-Logik des Werbefeeds.
 *
 * Nur auf Smartphones/Tablets (Touch-Gerät mit schmalem Viewport): Sobald der
 * Werbefeed beim Herunterscrollen den oberen Rand erreicht, dockt er unter dem
 * Header an (Feed-Modus). Beim Zurückziehen/Hochscrollen kehrt das Startlayout
 * flüssig zurück.
 *
 * Auf Desktop ist der Feed-Modus vollständig deaktiviert: der Werbefeed
 * verhält sich dort wie jeder normale Feed-Beitrag und scrollt einfach aus dem
 * Bild.
 */

/** Touch-Layout = echtes Smartphone/Tablet (kein Desktop mit Maus). */
function isTouchLayout() {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return coarse && window.innerWidth < 1024;
}

export function useFeedMode<A extends HTMLElement>() {
  const adRef = useRef<A | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [feedMode, setFeedMode] = useState(false);
  // Erst wenn der Werbefeed exakt eingerastet ist, übernimmt der Feed das Scrollen.
  const [scrollReady, setScrollReady] = useState(false);
  const [headerH, setHeaderH] = useState(52);
  // Tatsächlich gerenderte Höhe des Werbefeeds (ändert sich z. B. in der Werbepause).
  const [adH, setAdH] = useState(0);
  const busy = useRef(false);

  /* Gerätetyp + Header-Höhe messen.
   * Die Headerhöhe ist die EINZIGE Layoutquelle für die Position von
   * Werbefeed und Feed: sie wird zusätzlich als CSS-Variable
   * `--yd-header-h` gesetzt, damit beide Bereiche immer synchron bleiben. */
  useEffect(() => {
    const header = document.querySelector("header");
    const apply = (h: number) => {
      document.documentElement.style.setProperty("--yd-header-h", `${h}px`);
      setHeaderH((prev) => (Math.abs(h - prev) > 0.5 ? h : prev));
    };
    const measure = () => {
      setEnabled(isTouchLayout());
      const h = header?.getBoundingClientRect().height;
      if (h) apply(h);
    };
    measure();
    window.addEventListener("resize", measure);
    let observer: ResizeObserver | undefined;
    if (header && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        const h = header.getBoundingClientRect().height;
        if (h) apply(h);
      });
      observer.observe(header);
    }
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);


  /* Desktop (oder Wechsel auf Desktop-Breite): Feed-Modus konsequent aus. */
  useEffect(() => {
    if (enabled) return;
    setFeedMode(false);
    setScrollReady(false);
  }, [enabled]);

  /** Höhe des Werbefeeds laufend messen -> exakte Andockposition. */
  useEffect(() => {
    const ad = adRef.current;
    if (!ad || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const h = ad.getBoundingClientRect().height;
      setAdH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
    });
    observer.observe(ad);
    return () => observer.disconnect();
  }, []);


  const enter = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    // Restweg exakt ausgleichen -> kein sichtbarer Sprung beim Umschalten.
    const ad = adRef.current;
    if (ad) {
      const delta = Math.round(ad.getBoundingClientRect().top - headerH);
      if (delta !== 0) window.scrollTo(0, window.scrollY + delta);
    }
    setFeedMode(true);
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
    // Reihenfolge wichtig: erst nach oben, dann Layoutwechsel -> keine Lücke
    // zwischen Header und Feed und kein Flackern.
    window.scrollTo(0, 0);
    setScrollReady(false);
    setFeedMode(false);
    window.setTimeout(() => (busy.current = false), 420);
  }, []);

  /**
   * Refresh-Schutz: Der Browser stellt beim Neuladen die alte Scrollposition
   * wieder her. Diese künstliche Bewegung darf den Feed-Modus nicht auslösen.
   */
  const settled = useRef(false);
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    const id = window.setTimeout(() => (settled.current = true), 650);
    return () => window.clearTimeout(id);
  }, []);

  /* Einrasten: Werbefeed erreicht den oberen Rand (nur beim Scrollen nach unten) */
  useEffect(() => {
    if (!enabled || feedMode) return;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      const ad = adRef.current;
      if (!ad || dy <= 6 || !settled.current) return;
      if (isFeedModeLocked()) return;
      if (ad.getBoundingClientRect().top <= headerH + 8) enter();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, feedMode, headerH, enter]);

  /**
   * Scroll-Sperre im Feed-Modus: Das Dokument selbst darf nicht mehr scrollen.
   * Nur der innere Feed-Container scrollt – damit kann der Feed niemals unter
   * die fixierte Werbeleiste geschoben werden (auch nicht per Momentum oder
   * Overscroll, weil dort `overscroll-behavior: contain` greift).
   */
  useEffect(() => {
    if (!enabled || !feedMode) return;
    const root = document.documentElement;
    const body = document.body;
    const prev = {
      rootOverflow: root.style.overflow,
      bodyOverflow: body.style.overflow,
      overscroll: body.style.overscrollBehaviorY,
    };
    // Restoffset zurücksetzen BEVOR gesperrt wird: sonst behalten mobile
    // Browser den alten Scrollstand und der sticky Header rutscht aus dem Bild.
    window.scrollTo(0, 0);
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehaviorY = "none";
    // Header wird währenddessen fixiert (siehe styles.css).
    root.classList.add("yd-feedmode");
    return () => {
      root.style.overflow = prev.rootOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehaviorY = prev.overscroll;
      root.classList.remove("yd-feedmode");
    };

  }, [enabled, feedMode]);

  /**
   * Ausrasten mit der ursprünglichen Pull-down-Animation: Die Leiste (und der
   * Feed darunter) folgen dem Finger gedämpft nach unten (`pullY`) und federn
   * zurück, wenn die Geste nicht ausreicht. Die Bewegung ist rein visuell
   * (transform) und verändert das Layout nicht.
   */
  const [pullY, setPullY] = useState(0);

  useEffect(() => {
    if (!enabled || !feedMode) {
      setPullY(0);
      return;
    }
    const ad = adRef.current;
    if (!ad) return;

    const TRIGGER = 24; // kurzer Ziehweg auf der Leiste
    const FEED_TRIGGER = 64; // längerer Ziehweg im Feed selbst
    const MAX = 110;
    let startY = 0;
    let dragging = false;
    let armed = false;
    let fromBar = false;
    let wheel = 0;
    let wheelTimer: number | undefined;

    /** Ist der innere Feed-Scrollbereich bereits ganz oben? */
    const feedAtTop = (target: EventTarget | null) => {
      let el = target instanceof Element ? target : null;
      while (el) {
        if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) return false;
        el = el.parentElement;
      }
      return true;
    };

    /** Gedämpfte Gummiband-Bewegung – fühlt sich natürlich an, nie ruckartig. */
    const rubber = (dy: number) => MAX * (1 - Math.exp(-dy / (MAX * 0.9)));

    const onTouchStart = (e: TouchEvent) => {
      if (isFeedModeLocked()) return;
      const target = e.target;
      fromBar = target instanceof Node && ad.contains(target);
      if (!fromBar && !feedAtTop(target)) return;
      dragging = true;
      armed = false;
      startY = e.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY;
      if (dy <= 0) {
        armed = false;
        setPullY(0);
        return;
      }
      // Die Geste gehört der Leiste bzw. dem Feed-Anfang -> kein Browser-Refresh.
      if (e.cancelable) e.preventDefault();
      setPullY(rubber(dy));
      armed = dy > (fromBar ? TRIGGER : FEED_TRIGGER);
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
      if (e.deltaY >= 0 || !feedAtTop(e.target)) {
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

    // Ein einziges Listener-Set (Dokument-Ebene) – deckt Leiste und Feed ab.
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
      if (wheelTimer) window.clearTimeout(wheelTimer);
    };
  }, [enabled, feedMode, exit]);

  return { adRef, feedMode, scrollReady, headerH, adH, pullY, exitFeedMode: exit };
}

