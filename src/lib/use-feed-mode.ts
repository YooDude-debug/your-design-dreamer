import { useCallback, useEffect, useRef, useState } from "react";
import { isFeedModeLocked } from "@/lib/feed-mode-lock";
import { patchFeedSession, readFeedSession } from "@/lib/feed-session";
import { resolveFeedScroller } from "@/lib/feed-scroll";

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

/**
 * Aktiv, sobald es ein Fenster gibt. Touch-Geste und Mausrad/Trackpad sind
 * bewusst nur zwei Eingabequellen fuer DIESELBE Einrast-Logik – deshalb wird
 * hier nicht mehr nach Zeigergeraet gefiltert.
 */
function isSnapLayout() {
  return typeof window !== "undefined";
}

export function useFeedMode<A extends HTMLElement>() {
  const adRef = useRef<A | null>(null);
  /**
   * Rückkehr aus Market/Channels/Profil: der zuletzt gemerkte Einrast-Zustand
   * gilt sofort wieder – ohne künstliches Scrollen und ohne neue Geste.
   */
  const restored = useRef(readFeedSession()?.feedMode ?? false);
  // Lazy: sonst würde der Desktop-Zurücksetzer beim ersten Commit greifen.
  const [enabled, setEnabled] = useState(() => isSnapLayout());
  const [feedMode, setFeedMode] = useState(restored.current);
  // Erst wenn der Werbefeed exakt eingerastet ist, übernimmt der Feed das Scrollen.
  const [scrollReady, setScrollReady] = useState(restored.current);

  // Ohne globale Kopfleiste ist die Höhe 0 – der Platz gehört dem Feed.
  const [headerH, setHeaderH] = useState(0);
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
      // Im Feed-Modus ist die Top-Bar ausgeblendet -> Hoehe gehoert dem Feed.
      if (!document.documentElement.classList.contains("yd-feedmode")) {
        document.documentElement.style.setProperty("--yd-header-h", `${h}px`);
      }
      setHeaderH((prev) => (Math.abs(h - prev) > 0.5 ? h : prev));
    };
    const measure = () => {
      setEnabled(isSnapLayout());
      const h = header ? header.getBoundingClientRect().height : 0;
      apply(h);
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

  /**
   * Einrasten.
   *
   * `carry` ist der Scrollweg, den der Nutzer im selben Zug BEREITS ueber den
   * Einrastpunkt hinaus zurueckgelegt hat. Beim schnellen Scrollen meldet der
   * Browser das Scroll-Ereignis erst nach einem grossen Sprung – ohne
   * Uebergabe dieses Restwegs an den inneren Feed-Container ginge er beim
   * `window.scrollTo(0, 0)` verloren und der Feed spraenge sichtbar zurueck an
   * den Anfang.
   */
  const enter = useCallback((carry = 0) => {
    if (busy.current) return;
    busy.current = true;
    // Dokument-Scroll SOFORT stilllegen: mobiles Momentum darf die andockende
    // Leiste nicht weiterschieben (kein Nachspringen nach dem Loslassen).
    const root = document.documentElement;
    const body = document.body;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehaviorY = "none";
    window.scrollTo(0, 0);
    setFeedMode(true);
    /** Restweg an den Feed-Container weiterreichen, sobald dieser scrollt. */
    const handOver = () => {
      if (carry <= 0) return true;
      const scroller = resolveFeedScroller(
        document.querySelector<HTMLElement>("[data-feedscroll]"),
      );
      if (!scroller) return false;
      scroller.scrollTop = Math.min(carry, scroller.scrollHeight - scroller.clientHeight);
      return true;
    };
    // Der Feed übernimmt das Scrollen im selben Frame -> kein Zwischenzustand,
    // in dem sich noch das Dokument bewegt.
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      busy.current = false;
      setScrollReady(true);
      // Der Container ist erst nach dem Layoutwechsel scrollbar – deshalb im
      // naechsten Frame nachziehen, falls es jetzt noch nicht geklappt hat.
      if (!handOver()) requestAnimationFrame(handOver);
    });
  }, []);

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

  /** Einrast-Zustand für die Rückkehr aus anderen Seiten merken. */
  useEffect(() => {
    patchFeedSession({ feedMode });
  }, [feedMode]);

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

  /**
   * Nur ECHTE Nutzergesten dürfen einrasten.
   *
   * Scrollbewegungen entstehen auch ohne Zutun des Nutzers: der Browser
   * verschiebt die Position, wenn oberhalb Inhalte wachsen (Scroll-Anchoring,
   * „Beitrag erstellen“ öffnet, Bilder/Werbung laden nach). Solche
   * Verschiebungen dürfen den Feed-Modus niemals auslösen – sonst springt der
   * Nutzer ungewollt in den Feed.
   */
  const gestureAt = useRef(0);
  useEffect(() => {
    const mark = () => {
      gestureAt.current = Date.now();
    };
    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener("touchmove", mark, opts);
    window.addEventListener("touchstart", mark, opts);
    window.addEventListener("wheel", mark, opts);
    window.addEventListener("keydown", mark, opts);
    return () => {
      window.removeEventListener("touchmove", mark);
      window.removeEventListener("touchstart", mark);
      window.removeEventListener("wheel", mark);
      window.removeEventListener("keydown", mark);
    };
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
      if (!ad || dy <= 0 || !settled.current) return;
      // Ohne frische Nutzergeste (Finger/Rad/Taste) ist die Bewegung nicht gewollt.
      if (Date.now() - gestureAt.current > 400) return;
      if (isFeedModeLocked()) return;
      const top = ad.getBoundingClientRect().top;
      if (top <= headerH + 20) {
        // Bereits ueber den Einrastpunkt hinaus gescrollter Weg (bei sehr
        // schnellem Scrollen mehrere hundert Pixel) wandert in den Feed.
        enter(Math.max(0, Math.round(headerH - top)));
      }
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
    // Restoffset zurücksetzen BEVOR gesperrt wird: sonst behalten mobile
    // Browser den alten Scrollstand und der sticky Header rutscht aus dem Bild.
    window.scrollTo(0, 0);
    // `enter()` sperrt bereits synchron; hier nur idempotent sicherstellen.
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehaviorY = "none";
    // Header wird währenddessen fixiert und ausgeblendet (siehe styles.css);
    // seine Höhe geht vollständig an den Feed.
    root.classList.add("yd-feedmode");
    root.style.setProperty("--yd-header-h", "0px");
    return () => {
      // Immer auf den Ausgangswert zurück – nicht auf einen ggf. schon
      // gesperrten Zwischenzustand.
      root.style.overflow = "";
      body.style.overflow = "";
      body.style.overscrollBehaviorY = "";

      root.classList.remove("yd-feedmode");
      const h = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      root.style.setProperty("--yd-header-h", `${Math.round(h)}px`);
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
