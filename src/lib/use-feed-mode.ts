import { useCallback, useEffect, useRef, useState } from "react";
import { isFeedModeLocked } from "@/lib/feed-mode-lock";
import { patchFeedSession, readFeedSession } from "@/lib/feed-session";
import { resolveFeedScroller } from "@/lib/feed-scroll";
import { isIsolatedTarget } from "@/lib/scroll-isolate";
import { lockScroll } from "@/lib/scroll-lock";

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

/**
 * Andockhoehe – EINZIGE Messquelle.
 *
 * Nur die ausdruecklich gekennzeichnete globale Kopfleiste zaehlt. Ein
 * unspezifisches `querySelector("header")` traf sonst die erste
 * Beitragskarten-Kopfzeile im Feed (z. B. 54 px) und verfaelschte die
 * Andockhoehe dauerhaft. Ohne globale Kopfleiste ist die Hoehe 0.
 */
function measureAppHeader(): number {
  if (typeof document === "undefined") return 0;
  const header = document.querySelector<HTMLElement>("header[data-app-header]");
  return header ? header.getBoundingClientRect().height : 0;
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
  /** Zuletzt gemessene Andockhoehe – EINZIGE Quelle für `--yd-header-h`. */
  const headerHRef = useRef(0);
  // Tatsächlich gerenderte Höhe des Werbefeeds (ändert sich z. B. in der Werbepause).
  const [adH, setAdH] = useState(0);
  /**
   * Übergangssperre. Sie verhindert, dass sich zwei Layoutwechsel überlagern.
   *
   * WICHTIG: Der Ausrast-Nachlauf (`exitTimer`) hält die Sperre nach dem
   * sichtbaren Zurücksetzen noch kurz. Ein danach erkanntes, gültiges neues
   * Andocken darf davon NICHT blockiert werden – es beendet den Nachlauf
   * stattdessen sofort. Der abgebrochene Nachlauf darf den neuen Zustand
   * hinterher nicht mehr zurücksetzen.
   */
  const busy = useRef(false);
  /** Laufende Nummer des aktuellen Layoutwechsels (verhindert Nachläufer). */
  const phase = useRef(0);
  const exitTimer = useRef<number | null>(null);
  /** Rein visueller Kurz-Zustand fuer die vertikale Andock-Animation. */
  const [docking, setDocking] = useState(false);
  const dockAnimationTimer = useRef<number | null>(null);
  /** Rein visueller Kurz-Zustand fuer die vertikale Abdock-Animation. */
  const [undocking, setUndocking] = useState(false);
  const undockAnimationTimer = useRef<number | null>(null);
  const clearExitTimer = useCallback(() => {
    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
  }, []);
  useEffect(() => clearExitTimer, [clearExitTimer]);
  const clearDockAnimationTimer = useCallback(() => {
    if (dockAnimationTimer.current !== null) {
      window.clearTimeout(dockAnimationTimer.current);
      dockAnimationTimer.current = null;
    }
  }, []);
  useEffect(() => clearDockAnimationTimer, [clearDockAnimationTimer]);
  const clearUndockAnimationTimer = useCallback(() => {
    if (undockAnimationTimer.current !== null) {
      window.clearTimeout(undockAnimationTimer.current);
      undockAnimationTimer.current = null;
    }
  }, []);
  useEffect(() => clearUndockAnimationTimer, [clearUndockAnimationTimer]);

  /* Gerätetyp + Header-Höhe messen.
   * Die Headerhöhe ist die EINZIGE Layoutquelle für die Position von
   * Werbefeed und Feed: sie wird zusätzlich als CSS-Variable
   * `--yd-header-h` gesetzt, damit beide Bereiche immer synchron bleiben. */
  useEffect(() => {
    const apply = (h: number) => {
      headerHRef.current = h;
      // Im Feed-Modus ist die Top-Bar ausgeblendet -> Hoehe gehoert dem Feed.
      if (!document.documentElement.classList.contains("yd-feedmode")) {
        document.documentElement.style.setProperty("--yd-header-h", `${h}px`);
      }
      setHeaderH((prev) => (Math.abs(h - prev) > 0.5 ? h : prev));
    };
    // Das Element wird bei JEDER Messung neu aufgeloest: eine Kopfleiste kann
    // auch spaeter erscheinen oder verschwinden.
    const measure = () => {
      setEnabled(isSnapLayout());
      apply(measureAppHeader());
    };

    measure();
    window.addEventListener("resize", measure);
    let observer: ResizeObserver | undefined;
    const header = document.querySelector<HTMLElement>("header[data-app-header]");
    if (header && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => apply(header.getBoundingClientRect().height));
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
  /**
   * Vorab-Sperre aus `enter()`. Sie wird vom Feed-Modus-Effekt uebernommen
   * (dessen eigener Lock greift, danach wird dieser hier freigegeben) bzw. von
   * `exit()` freigegeben, falls der Effekt nie lief.
   */
  const eagerLock = useRef<(() => void) | null>(null);
  const releaseEagerLock = useCallback(() => {
    eagerLock.current?.();
    eagerLock.current = null;
  }, []);

  const enter = useCallback(
    (carry = 0) => {
      // Ein noch laufender Ausrast-Nachlauf ist kein Grund zu blockieren: er wird
      // hier beendet, damit UP -> sofort DOWN wieder andockt.
      const exitPending = exitTimer.current !== null;
      if (busy.current && !exitPending) return;
      clearExitTimer();
      clearDockAnimationTimer();
      clearUndockAnimationTimer();
      setUndocking(false);
      busy.current = true;
      const token = ++phase.current;
      // Dokument-Scroll SOFORT stilllegen: mobiles Momentum darf die andockende
      // Leiste nicht weiterschieben (kein Nachspringen nach dem Loslassen).
      // Zentrale, zaehlerbasierte Sperre – fremde Locks bleiben unberuehrt.
      releaseEagerLock();
      eagerLock.current = lockScroll();
      window.scrollTo(0, 0);

      setDocking(true);
      setFeedMode(true);
      dockAnimationTimer.current = window.setTimeout(() => {
        dockAnimationTimer.current = null;
        setDocking(false);
      }, 200);
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
        // Zwischenzeitlich wurde bereits wieder ausgerastet -> nichts nachziehen.
        if (phase.current !== token) return;
        window.scrollTo(0, 0);
        busy.current = false;
        setScrollReady(true);
        // Der Container ist erst nach dem Layoutwechsel scrollbar – deshalb im
        // naechsten Frame nachziehen, falls es jetzt noch nicht geklappt hat.
        if (!handOver()) requestAnimationFrame(handOver);
      });
    },
    [clearDockAnimationTimer, clearExitTimer, clearUndockAnimationTimer, releaseEagerLock],
  );

  const exit = useCallback(() => {
    // Nur ein laufendes Einrasten blockiert; ein alter Ausrast-Nachlauf nicht.
    if (busy.current && exitTimer.current === null) return;
    clearExitTimer();
    clearDockAnimationTimer();
    clearUndockAnimationTimer();
    busy.current = true;
    // Falls der Feed-Modus-Effekt nie lief: Vorab-Sperre hier freigeben.
    releaseEagerLock();
    const token = ++phase.current;

    // Reihenfolge wichtig: erst nach oben, dann Layoutwechsel -> keine Lücke
    // zwischen Header und Feed und kein Flackern.
    window.scrollTo(0, 0);
    setScrollReady(false);
    setDocking(false);
    setUndocking(true);
    setFeedMode(false);
    undockAnimationTimer.current = window.setTimeout(() => {
      undockAnimationTimer.current = null;
      setUndocking(false);
    }, 180);
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = null;
      // Ein neuer Zyklus hat den Nachlauf überholt -> dessen Zustand behalten.
      if (phase.current !== token) return;
      busy.current = false;
    }, 420);
  }, [clearDockAnimationTimer, clearExitTimer, clearUndockAnimationTimer, releaseEagerLock]);

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
   *
   * WICHTIG für Android: Nach dem Loslassen läuft der Scroll als Momentum
   * (Fling) noch sekundenlang weiter, OHNE weitere `touchmove`-Ereignisse.
   * Deshalb zählt nicht der Zeitpunkt der letzten Berührung, sondern eine
   * fortlaufende Scroll-Sitzung: sie beginnt mit einer echten Geste und bleibt
   * offen, solange ohne Unterbrechung weitergescrollt wird.
   */
  const gestureAt = useRef(0);
  const sessionUntil = useRef(0);
  useEffect(() => {
    const mark = (e: Event) => {
      // Gesten in isolierten Overlays (Messenger, Globe, Viewer) sind keine
      // Feed-Gesten und duerfen niemals eine Andock-Sitzung eroeffnen.
      if (isIsolatedTarget(e.target)) return;
      gestureAt.current = Date.now();
    };

    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener("touchmove", mark, opts);
    window.addEventListener("touchstart", mark, opts);
    window.addEventListener("touchend", mark, opts);
    window.addEventListener("wheel", mark, opts);
    window.addEventListener("keydown", mark, opts);
    return () => {
      window.removeEventListener("touchmove", mark);
      window.removeEventListener("touchstart", mark);
      window.removeEventListener("touchend", mark);
      window.removeEventListener("wheel", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  /* Einrasten: Werbefeed erreicht den oberen Rand (nur beim Scrollen nach unten)
   *
   * Die Leiste selbst haelt ihre Position ab sofort per nativem
   * `position: sticky` (siehe feed.tsx) – sie kann daher nicht mehr sichtbar
   * ueber den Andockpunkt hinausrutschen, auch nicht bei schnellem oder
   * Momentum-Scrollen, wo Scroll-Ereignisse verzoegert eintreffen. Dieser
   * Handler wechselt nur noch das Layout.
   *
   * Weil `getBoundingClientRect().top` einer sticky Leiste am Andockpunkt
   * stehen bleibt, wird der bereits darueber hinaus gescrollte Weg (`carry`)
   * aus der zuletzt gemessenen Ausloeseposition im Dokument berechnet.
   */
  useEffect(() => {
    if (!enabled || feedMode) return;
    let lastY = window.scrollY;
    let triggerY = Number.NaN;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      const ad = adRef.current;
      if (!ad) return;
      const now = Date.now();
      /* Scroll-Sitzung: startet mit einer echten Geste und bleibt waehrend des
       * Momentums (Fling) offen, solange ohne Pause weitergescrollt wird. */
      const fromGesture = now - gestureAt.current <= 500 || now < sessionUntil.current;
      if (dy !== 0 && fromGesture) sessionUntil.current = now + 1500;
      const top = ad.getBoundingClientRect().top;
      // Noch oberhalb des Andockpunkts: Ausloeseposition laufend merken.
      if (top > headerH + 1) {
        triggerY = y + top - headerH;
        return;
      }
      if (dy <= 0 || !settled.current) return;
      // Ohne echte Nutzergeste bzw. deren Momentum ist die Bewegung nicht gewollt.
      if (!fromGesture) return;
      if (isFeedModeLocked()) return;
      const carry = Number.isNaN(triggerY) ? 0 : y - triggerY;
      enter(Math.max(0, Math.round(carry)));
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
    // Restoffset zurücksetzen BEVOR gesperrt wird: sonst behalten mobile
    // Browser den alten Scrollstand und der sticky Header rutscht aus dem Bild.
    window.scrollTo(0, 0);
    /* Eigene Anforderung an die zentrale Sperre; erst danach die Vorab-Sperre
     * aus `enter()` freigeben, damit zwischendurch nie entsperrt wird. */
    const release = lockScroll();
    releaseEagerLock();
    // Header wird währenddessen fixiert und ausgeblendet (siehe styles.css);
    // seine Höhe geht vollständig an den Feed.
    root.classList.add("yd-feedmode");
    root.style.setProperty("--yd-header-h", "0px");
    return () => {
      release();
      root.classList.remove("yd-feedmode");
      // Genau der Wert, gegen den der Auslöser vergleicht – KEINE neue Messung.
      // Sonst laufen CSS-Andockhoehe und `headerH` auseinander und ein zweiter
      // Andockvorgang wird nie mehr erkannt.
      root.style.setProperty("--yd-header-h", `${headerHRef.current}px`);
    };
  }, [enabled, feedMode, releaseEagerLock]);

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

    /**
     * Ist der innere Feed-Scrollbereich bereits ganz oben?
     *
     * Stammt das Ereignis aus einem isolierten Overlay (Messenger, Globe,
     * Viewer), ist es KEIN Feed-Ereignis: sofort abbrechen, statt die
     * Elternkette des Overlay-Scrollcontainers als Feed zu deuten.
     */
    const feedAtTop = (target: EventTarget | null) => {
      if (isIsolatedTarget(target)) return false;
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
      // Gesten in isolierten Overlays gehoeren nie dem Feed.
      if (isIsolatedTarget(target)) {
        dragging = false;
        return;
      }
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

  return {
    adRef,
    feedMode,
    scrollReady,
    headerH,
    adH,
    pullY,
    docking,
    undocking,
    exitFeedMode: exit,
  };
}
