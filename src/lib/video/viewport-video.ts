/**
 * Viewport-basierte Wiedergabe der Feed-Videos (Video-Beitraege mit Tonspur).
 *
 * Grundsatz: es laeuft immer nur EIN automatisch gestartetes Video – naemlich
 * das am stärksten sichtbare. Verlaesst ein Video den sichtbaren Feedbereich,
 * wird es sofort pausiert. Manuelle Bedienung hat immer Vorrang:
 *
 *   sichtbar (Regel aus `isAutoPlayVisible`) → Autostart
 *   weniger sichtbar / ausgescrollt         → pausiert (Position bleibt)
 *   ca. 5 Feed-Karten entfernt              → Wiedergabe auf 0:00 zurueckgesetzt
 *   Nutzer pausiert selbst                  → kein erneuter Autostart
 *   Nutzer startet selbst                   → laufendes Auto-Video pausiert
 *
 * Ton: siehe `video-sound.ts` – Autostart ist stumm, bis der Nutzer den Ton
 * bewusst einschaltet; danach wird Ton fuer weitere Videos versucht und faellt
 * bei Browser-Ablehnung automatisch auf stumm zurueck.
 *
 * Es gibt bewusst keine Timer und keine Scroll-Listener: Sichtbarkeit und
 * Abstand kommen ausschliesslich aus IntersectionObservern, das Umschalten
 * wird pro Frame gebuendelt.
 */

import { useEffect } from "react";
import { isAutoPlayVisible } from "@/lib/autoplay";
import {
  isVideoSoundPreferred,
  mayAutoplayWithSound,
  setVideoSoundPreferred,
  trackUserGesture,
} from "@/lib/video/video-sound";

/** Abstand in Feed-Karten, ab dem die Wiedergabe zurueckgesetzt wird. */
export const RESET_DISTANCE_CARDS = 5;

type Entry = {
  el: HTMLVideoElement;
  /** Karten-Element des Beitrags – liefert die Kartenhoehe als Abstandsmass. */
  card: HTMLElement | null;
  /** Position der Karte im Feed (fuer den kartenbasierten Abstand). */
  index: number;
  /** Sichtbarkeitsanteil (0..1) – entscheidet, welches Video laufen darf. */
  ratio: number;
  /** Erfuellt die Sichtbarkeitsregel des AutoPlay-Systems. */
  visible: boolean;
  /** Nutzer hat bewusst pausiert – kein automatischer Neustart. */
  userPaused: boolean;
  /** Zweiter Observer mit Karten-Abstand als `rootMargin`. */
  farIO: IntersectionObserver | null;
  /** Kartenhoehe, mit der `farIO` aufgebaut wurde. */
  farCardHeight: number;
  root: HTMLElement | null;
};

const registry = new Map<HTMLVideoElement, Entry>();
/** Aktuell automatisch gestartetes Video (maximal eines). */
let active: HTMLVideoElement | null = null;
/** Von uns ausgeloeste pause()/play()/muted-Aenderungen nicht als Nutzeraktion werten. */
const suppressed = new Set<HTMLVideoElement>();
let frame: number | null = null;

function beginInternal(el: HTMLVideoElement) {
  suppressed.add(el);
}
function endInternal(el: HTMLVideoElement) {
  // Media-Events kommen asynchron – erst im naechsten Tick freigeben.
  setTimeout(() => suppressed.delete(el), 0);
}

function pauseAuto(el: HTMLVideoElement) {
  if (el.paused) return;
  beginInternal(el);
  try {
    el.pause();
  } finally {
    endInternal(el);
  }
}

/** Stumm/laut setzen, ohne die Aenderung als Nutzeraktion zu werten. */
function setMutedInternal(el: HTMLVideoElement, muted: boolean) {
  if (el.muted === muted) return;
  beginInternal(el);
  el.muted = muted;
  endInternal(el);
}

/**
 * Autostart. Mit gespeicherter Ton-Praeferenz (und vorheriger echter
 * Nutzergeste) wird Ton versucht; lehnt der Browser ab, wird stumm gestartet.
 */
function playAuto(el: HTMLVideoElement) {
  el.playsInline = true;
  // Sichtbares Video darf puffern, ausgescrollte bleiben auf "metadata".
  if (el.preload !== "auto") el.preload = "auto";
  const wantSound = mayAutoplayWithSound();
  setMutedInternal(el, !wantSound);

  beginInternal(el);
  let result: Promise<void> | undefined;
  try {
    result = el.play() as Promise<void> | undefined;
  } catch {
    result = undefined;
  }
  if (result && typeof result.then === "function") {
    void result.then(
      () => endInternal(el),
      () => {
        // Browser hat unmuted Autoplay abgelehnt → einmalig stumm nachziehen.
        if (!el.muted) {
          setMutedInternal(el, true);
          try {
            const retry = el.play() as Promise<void> | undefined;
            if (retry && typeof retry.catch === "function") retry.catch(() => undefined);
          } catch {
            /* ignorieren – Browser erlaubt keinen Autostart */
          }
        }
        endInternal(el);
      },
    );
  } else {
    endInternal(el);
  }
}

/** Wiedergabe auf Anfang zuruecksetzen (Video ist weit aus dem Feed heraus). */
function resetEntry(entry: Entry) {
  const el = entry.el;
  pauseAuto(el);
  if (el.currentTime !== 0) {
    beginInternal(el);
    try {
      el.currentTime = 0;
    } catch {
      /* Quelle noch nicht seekbar – naechster Autostart beginnt ohnehin bei 0 */
    } finally {
      endInternal(el);
    }
  }
  // Nach vollstaendigem Reset darf wieder automatisch gestartet werden.
  entry.userPaused = false;
  if (el.preload !== "metadata") el.preload = "metadata";
  if (active === el) active = null;
}

/**
 * Zweiter Observer: schlaegt an, wenn die Karte ~5 Kartenhoehen ausserhalb des
 * sichtbaren Feedbereichs liegt. Kartenhoehe statt fixer Pixelwerte, damit das
 * Verhalten auf jeder Bildschirmgroesse gleich bleibt.
 */
function ensureFarObserver(entry: Entry) {
  const target = entry.card ?? entry.el;
  const height = Math.round(
    (entry.card?.offsetHeight || entry.el.getBoundingClientRect().height || 0) as number,
  );
  if (!height) return;
  // Neu aufbauen, wenn die Karte sich deutlich veraendert hat (Bild geladen o.ae.).
  if (entry.farIO && Math.abs(height - entry.farCardHeight) / entry.farCardHeight < 0.25) return;
  entry.farIO?.disconnect();
  entry.farCardHeight = height;
  const margin = height * (RESET_DISTANCE_CARDS - 1);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) continue;
        // Karte liegt jetzt ~5 Karten ausserhalb → Wiedergabe zuruecksetzen.
        resetEntry(entry);
      }
    },
    { root: entry.root ?? null, rootMargin: `${margin}px 0px`, threshold: 0 },
  );
  io.observe(target);
  entry.farIO = io;
}

/** Bestes Video bestimmen und genau dieses laufen lassen. */
function reconcile() {
  frame = null;
  let best: Entry | null = null;
  const invisible: Entry[] = [];
  for (const entry of registry.values()) {
    // Unsichtbare Videos werden immer pausiert – auch bei schnellem Scrollen.
    if (!entry.visible) {
      invisible.push(entry);
      if (entry.el !== active) pauseAuto(entry.el);
      continue;
    }
    if (entry.userPaused) continue;
    if (!best || entry.ratio > best.ratio) best = entry;
  }

  if (active && (!best || best.el !== active)) {
    pauseAuto(active);
    // Ressourcen sparen: ausgescrolltes Video puffert nicht weiter.
    if (active.preload !== "metadata") active.preload = "metadata";
    active = null;
  }
  if (best && best.el !== active) {
    playAuto(best.el);
    active = best.el;
  }

  // Kartenbasierter Abstand zwischen zwei Video-Beitraegen: sind wir schon
  // ~5 Karten weiter, wird das entfernte Video sofort zurueckgesetzt.
  if (best) {
    for (const entry of invisible) {
      if (Math.abs(entry.index - best.index) >= RESET_DISTANCE_CARDS) resetEntry(entry);
    }
  }
}

function schedule() {
  if (frame !== null) return;
  frame =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(reconcile)
      : (setTimeout(reconcile, 16) as unknown as number);
}

/** Tab/App im Hintergrund: kein Video darf weiterlaufen. */
function onDocumentHidden() {
  if (typeof document === "undefined" || !document.hidden) {
    schedule();
    return;
  }
  for (const entry of registry.values()) pauseAuto(entry.el);
  active = null;
}

/**
 * Ein Feed-Video anmelden. Rueckgabe raeumt Beobachter und Registry-Eintrag
 * vollstaendig ab (auch das laufende Video wird pausiert).
 */
export function registerViewportVideo(
  el: HTMLVideoElement,
  root: HTMLElement | null,
  options: { card?: HTMLElement | null; index?: number } = {},
): () => void {
  const entry: Entry = {
    el,
    card: options.card ?? null,
    index: options.index ?? 0,
    ratio: 0,
    visible: false,
    userPaused: false,
    farIO: null,
    farCardHeight: 0,
    root,
  };
  registry.set(el, entry);
  el.playsInline = true;
  // Kein aggressives Vorladen: erst das sichtbare Video puffert.
  if (el.preload !== "metadata") el.preload = "metadata";
  trackUserGesture();
  // Bestehende Ton-Praeferenz der Sitzung auf das neue Video anwenden.
  setMutedInternal(el, !isVideoSoundPreferred());

  const onPause = () => {
    if (suppressed.has(el) || el.ended) return;
    entry.userPaused = true;
    if (active === el) active = null;
  };
  const onPlay = () => {
    entry.userPaused = false;
    if (active && active !== el) pauseAuto(active);
    active = el;
  };
  const onEnded = () => {
    if (active === el) active = null;
  };
  /** Nutzer schaltet den Ton per Videosteuerung → Praeferenz fuer die Sitzung. */
  const onVolumeChange = () => {
    if (suppressed.has(el)) return;
    setVideoSoundPreferred(!el.muted);
  };

  el.addEventListener("pause", onPause);
  el.addEventListener("play", onPlay);
  el.addEventListener("ended", onEnded);
  el.addEventListener("volumechange", onVolumeChange);

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        entry.ratio = e.intersectionRatio;
        entry.visible = isAutoPlayVisible(e);
        if (e.isIntersecting) ensureFarObserver(entry);
      }
      schedule();
    },
    { root: root ?? null, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
  );
  io.observe(el);

  if (registry.size === 1 && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onDocumentHidden);
  }

  return () => {
    io.disconnect();
    entry.farIO?.disconnect();
    el.removeEventListener("pause", onPause);
    el.removeEventListener("play", onPlay);
    el.removeEventListener("ended", onEnded);
    el.removeEventListener("volumechange", onVolumeChange);
    pauseAuto(el);
    if (active === el) active = null;
    registry.delete(el);
    if (registry.size === 0 && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onDocumentHidden);
    }
  };
}

/**
 * React-Anbindung: Video-Element beim Viewport-Controller anmelden.
 * `enabled = false` (z. B. SlangShots) laesst das bestehende Verhalten
 * unangetastet.
 */
export function useViewportVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  {
    enabled,
    root,
    src,
    cardRef,
    index = 0,
  }: {
    enabled: boolean;
    root?: HTMLElement | null;
    src?: string | null;
    cardRef?: React.RefObject<HTMLElement | null>;
    index?: number;
  },
) {
  useEffect(() => {
    if (!enabled) return;
    const el = videoRef.current;
    if (!el) return;
    return registerViewportVideo(el, root ?? null, {
      card: cardRef?.current ?? null,
      index,
    });
    // `src` neu → das <video> wurde ersetzt und muss neu angemeldet werden.
  }, [enabled, root, src, index, videoRef, cardRef]);
}

/** Nur fuer Tests: Registry vollstaendig leeren. */
export function __resetViewportVideos() {
  for (const entry of [...registry.values()]) {
    entry.farIO?.disconnect();
    registry.delete(entry.el);
  }
  active = null;
  suppressed.clear();
  frame = null;
}
