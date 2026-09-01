/**
 * Viewport-basierte Wiedergabe der Feed-Videos (Video-Beitraege mit Tonspur).
 *
 * Grundsatz: es laeuft immer nur EIN automatisch gestartetes Video – naemlich
 * das am stärksten sichtbare. Verlaesst ein Video den sichtbaren Feedbereich,
 * wird es sofort pausiert. Manuelle Bedienung hat immer Vorrang:
 *
 *   sichtbar (Regel aus `isAutoPlayVisible`) → stummer Autostart
 *   weniger sichtbar / ausgescrollt         → pausiert
 *   Nutzer pausiert selbst                  → kein erneuter Autostart
 *   Nutzer startet selbst                   → laufendes Auto-Video pausiert
 *
 * Es gibt bewusst keine Timer und keine Scroll-Listener: die Sichtbarkeit
 * kommt ausschliesslich aus einem IntersectionObserver pro Video, das
 * Umschalten wird pro Frame gebuendelt.
 *
 * Die SlangShot-Wiedergabe (Video + SlangTag-Audio) bleibt unveraendert und
 * nutzt weiterhin `useShotSync` – dieser Controller ist nur fuer Videos mit
 * eigener Tonspur zustaendig.
 */

import { useEffect } from "react";
import { isAutoPlayVisible } from "@/lib/autoplay";

type Entry = {
  el: HTMLVideoElement;
  /** Sichtbarkeitsanteil (0..1) – entscheidet, welches Video laufen darf. */
  ratio: number;
  /** Erfuellt die Sichtbarkeitsregel des AutoPlay-Systems. */
  visible: boolean;
  /** Nutzer hat bewusst pausiert – kein automatischer Neustart. */
  userPaused: boolean;
};

const registry = new Map<HTMLVideoElement, Entry>();
/** Aktuell automatisch gestartetes Video (maximal eines). */
let active: HTMLVideoElement | null = null;
/** Von uns ausgeloeste pause()/play()-Aufrufe nicht als Nutzeraktion werten. */
const suppressed = new Set<HTMLVideoElement>();
let frame: number | null = null;

function suppress(el: HTMLVideoElement, run: () => void) {
  suppressed.add(el);
  try {
    run();
  } finally {
    // Die Media-Events kommen asynchron – erst im naechsten Tick freigeben.
    setTimeout(() => suppressed.delete(el), 0);
  }
}

function pauseAuto(el: HTMLVideoElement) {
  if (el.paused) return;
  suppress(el, () => el.pause());
}

function playAuto(el: HTMLVideoElement) {
  // Autoplay ist nur stumm zuverlaessig erlaubt. Hat der Nutzer den Ton selbst
  // eingeschaltet, bleibt seine Einstellung erhalten (schlaegt play() dann
  // fehl, bleibt das Video einfach stehen).
  if (el.muted) el.playsInline = true;
  // Sichtbares Video darf puffern, ausgescrollte bleiben auf "metadata".
  if (el.preload !== "auto") el.preload = "auto";
  suppress(el, () => {
    const p = el.play() as Promise<void> | undefined;
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  });
}

/** Bestes Video bestimmen und genau dieses laufen lassen. */
function reconcile() {
  frame = null;
  let best: Entry | null = null;
  for (const entry of registry.values()) {
    // Unsichtbare Videos werden immer pausiert – auch bei schnellem Scrollen.
    if (!entry.visible) {
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
export function registerViewportVideo(el: HTMLVideoElement, root: HTMLElement | null): () => void {
  const entry: Entry = { el, ratio: 0, visible: false, userPaused: false };
  registry.set(el, entry);
  el.playsInline = true;
  // Kein aggressives Vorladen: erst das sichtbare Video puffert.
  if (el.preload !== "metadata") el.preload = "metadata";

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

  el.addEventListener("pause", onPause);
  el.addEventListener("play", onPlay);
  el.addEventListener("ended", onEnded);

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        entry.ratio = e.intersectionRatio;
        entry.visible = isAutoPlayVisible(e);
        // Beim vollstaendigen Verlassen zaehlt eine frühere Nutzerpause nicht
        // mehr: kommt das Video spaeter wieder in den Blick, darf es starten.
        if (!e.isIntersecting) entry.userPaused = false;
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
    el.removeEventListener("pause", onPause);
    el.removeEventListener("play", onPlay);
    el.removeEventListener("ended", onEnded);
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
  { enabled, root, src }: { enabled: boolean; root?: HTMLElement | null; src?: string | null },
) {
  useEffect(() => {
    if (!enabled) return;
    const el = videoRef.current;
    if (!el) return;
    return registerViewportVideo(el, root ?? null);
    // `src` neu → das <video> wurde ersetzt und muss neu angemeldet werden.
  }, [enabled, root, src, videoRef]);
}

/** Nur fuer Tests: Registry vollstaendig leeren. */
export function __resetViewportVideos() {
  for (const el of [...registry.keys()]) registry.delete(el);
  active = null;
  suppressed.clear();
  frame = null;
}
