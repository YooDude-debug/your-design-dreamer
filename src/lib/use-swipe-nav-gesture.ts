import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Horizontale Navigation zwischen Hauptfeed, SlangTag Arena und Slang Globe.
 *
 * - `useHorizontalNavSwipe`: Geste aus dem mittleren Content-Bereich (Feed).
 * - `setSlideDirection` / `useSlideInClass`: Übergangsanimation der Zielseite,
 *   auch von den seitlichen Zieh-Handles (`NavDragHandle`) genutzt.
 *
 * Alle Listener sind passiv – vertikales Scrollen und native Rand-Gesten
 * des Browsers bleiben unberührt.
 */


/** Richtung der Übergangsanimation für die Zielseite. */
let pendingSlide: "from-right" | "from-left" | null = null;

/** Slide-Richtung für den nächsten Seitenwechsel setzen. */
export function setSlideDirection(dir: "from-right" | "from-left") {
  pendingSlide = dir;
}

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

/* ------------------------------------------------------------------ */
/* Einfache horizontale Navigation aus dem mittleren Content-Bereich  */
/* ------------------------------------------------------------------ */

/** Anteil der Bildschirmbreite je Seite, der für System-Gesten frei bleibt. */
const CENTER_INSET_RATIO = 0.18;
const CENTER_INSET_MIN = 48;
/** Mindeststrecke der horizontalen Bewegung. */
const MIN_DX = 70;
/** Horizontale Bewegung muss klar größer sein als die vertikale. */
const DX_DY_RATIO = 1.6;
/** Maximale vertikale Abweichung. */
const SWIPE_MAX_DY = 60;
/** Zeitfenster der Geste. */
const SWIPE_MAX_MS = 900;

/**
 * Horizontaler Swipe aus dem mittleren Content-Bereich:
 * nach links öffnet `left`, nach rechts öffnet `right`.
 *
 * Die Randzonen bleiben bewusst frei, damit die nativen Zurück-Gesten
 * von Android und iOS/Safari unberührt bleiben. Alle Listener sind passiv,
 * vertikales Scrollen hat immer Vorrang.
 */
export function useHorizontalNavSwipe(targets: { left: NavTarget; right: NavTarget }) {
  const navigate = useNavigate();
  const ref = useRef(targets);
  ref.current = targets;

  useEffect(() => {
    let active = false;
    let startX = 0;
    let startY = 0;
    let startT = 0;

    const reset = () => {
      active = false;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return reset();
      const t = e.touches[0];
      if (!t) return reset();
      const inset = Math.max(CENTER_INSET_MIN, window.innerWidth * CENTER_INSET_RATIO);
      if (t.clientX < inset || t.clientX > window.innerWidth - inset) return reset();
      if (isBlockedTarget(e.target)) return reset();
      if (document.querySelector("[role='dialog'], [aria-modal='true']")) return reset();
      active = true;
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
      if (Math.abs(dy) > SWIPE_MAX_DY || e.timeStamp - startT > SWIPE_MAX_MS) return reset();
      if (Math.abs(dx) < MIN_DX) return;
      if (Math.abs(dx) < Math.abs(dy) * DX_DY_RATIO) return;
      reset();
      if (dx < 0) {
        pendingSlide = "from-right";
        void navigate({ to: ref.current.left });
      } else {
        pendingSlide = "from-left";
        void navigate({ to: ref.current.right });
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
  }, [navigate]);
}
