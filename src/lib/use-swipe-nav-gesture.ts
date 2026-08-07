import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Zweistufige Wisch-Geste zum Wechseln zwischen Hauptfeed und SlangTag Arena.
 *
 * Ablauf (direction = "left-then-right"):
 *   1. Finger startet innerhalb des Inhalts (nicht am Bildschirmrand)
 *   2. leichte Bewegung nach links (PRE_MIN … PRE_MAX px)
 *   3. ohne Absetzen deutlich nach rechts (MAIN_MIN px)
 *
 * "right-then-left" ist die spiegelverkehrte Rückgeste.
 *
 * Alle Listener sind passiv – Scrollen und native Zurück-Gesten bleiben unberührt.
 */

/** Randzone, in der die Geste nicht startet (native Zurück-Gesten). */
const EDGE = 32;
/** Vorbewegung: minimale und maximale Strecke. */
const PRE_MIN = 20;
const PRE_MAX = 40;
/** Hauptbewegung in Gegenrichtung. */
const MAIN_MIN = 90;
/** Maximale vertikale Abweichung, damit Scrollen Vorrang hat. */
const MAX_DY = 60;
/** Zeitfenster der gesamten Geste. */
const MAX_MS = 1200;

/** Richtung der Übergangsanimation für die Zielseite. */
let pendingSlide: "from-right" | "from-left" | null = null;

/** Einmalig die Slide-Richtung der letzten Geste abholen. */
export function consumeSlideDirection() {
  const dir = pendingSlide;
  pendingSlide = null;
  return dir;
}

/** Interaktive Elemente, bei denen die Geste nicht ausgelöst wird. */
function isBlockedTarget(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  if (el.closest("input, textarea, select, video, audio, form, [role='dialog'], [role='menu']"))
    return true;
  // Horizontal scrollbare Container respektieren.
  let node: Element | null = el;
  while (node && node !== document.body) {
    if (node.scrollWidth > node.clientWidth + 8) {
      const overflow = getComputedStyle(node).overflowX;
      if (overflow === "auto" || overflow === "scroll") return true;
    }
    node = node.parentElement;
  }
  return false;
}

export type NavTarget = "/arena" | "/dev" | "/globe";

export function useSwipeNavGesture(
  direction: "left-then-right" | "right-then-left",
  to: NavTarget,
) {
  const navigate = useNavigate();
  const enabled = useRef({ direction, to });
  enabled.current = { direction, to };

  useEffect(() => {
    const sign = direction === "left-then-right" ? -1 : 1; // Vorzeichen der Vorbewegung
    let active = false;
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let preDone = false;
    let extreme = 0; // stärkste Auslenkung der Vorbewegung

    const reset = () => {
      active = false;
      preDone = false;
      extreme = 0;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return reset();
      const t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return reset();
      if (isBlockedTarget(e.target)) return reset();
      if (document.querySelector("[role='dialog'], [aria-modal='true']")) return reset();
      active = true;
      preDone = false;
      extreme = 0;
      startX = t.clientX;
      startY = t.clientY;
      startT = e.timeStamp;
    };

    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      if (!t) return reset();
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dy) > MAX_DY || e.timeStamp - startT > MAX_MS) return reset();

      if (!preDone) {
        // Bewegung in Vorrichtung verfolgen
        if (dx * sign > 0) extreme = Math.max(extreme, Math.abs(dx));
        if (dx * sign < 0 && extreme < PRE_MIN) return reset(); // falsche Richtung zuerst
        if (extreme >= PRE_MIN && extreme <= PRE_MAX && dx * sign < extreme - 8) preDone = true;
        if (extreme > PRE_MAX) return reset();
        return;
      }

      // Hauptbewegung in Gegenrichtung
      if (-dx * sign >= MAIN_MIN) {
        reset();
        pendingSlide = direction === "left-then-right" ? "from-right" : "from-left";
        void navigate({ to: enabled.current.to });
      }
    };

    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("touchstart", onStart, opts);
    window.addEventListener("touchmove", onMove, opts);
    window.addEventListener("touchend", reset, opts);
    window.addEventListener("touchcancel", reset, opts);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", reset);
      window.removeEventListener("touchcancel", reset);
    };
  }, [direction, navigate]);
}

/** Slide-Klasse für die Zielseite, falls sie per Geste geöffnet wurde. */
export function useSlideInClass(): string {
  const ref = useRef<string | null>(null);
  if (ref.current === null) {
    const dir = typeof window === "undefined" ? null : consumeSlideDirection();
    ref.current =
      dir === "from-right"
        ? "animate-[slide-nav-right_300ms_cubic-bezier(0.22,1,0.36,1)]"
        : dir === "from-left"
          ? "animate-[slide-nav-left_300ms_cubic-bezier(0.22,1,0.36,1)]"
          : "";
  }
  return ref.current;
}
