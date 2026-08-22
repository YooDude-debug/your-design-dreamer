import { useRef } from "react";

/**
 * Horizontale Navigation zwischen Hauptfeed, SlangTag Arena und Slang Globe.
 *
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

/* ------------------------------------------------------------------ */
/* Gesten-Sperre (z. B. aktives SlangTag-Drag)                        */
/* ------------------------------------------------------------------ */

let navGestureLocks = 0;

/**
 * Blockiert die globale horizontale Navigations-Geste, solange eine lokale
 * Geste (SlangTag-Drag, Skalieren/Drehen) aktiv ist. Zaehlerbasiert, damit
 * mehrere Pointer sich nicht gegenseitig entsperren.
 */
export function lockNavGesture() {
  navGestureLocks += 1;
}

/** Sperre freigeben. */
export function unlockNavGesture() {
  navGestureLocks = Math.max(0, navGestureLocks - 1);
}

/** Alle Sperren zuruecksetzen (z. B. beim Unmount des Editors). */
export function resetNavGestureLock() {
  navGestureLocks = 0;
}

/** Ist die globale Navigations-Geste aktuell gesperrt? */
export function isNavGestureLocked() {
  return navGestureLocks > 0;
}


export type NavTarget = "/arena" | "/dev" | "/globe";

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
