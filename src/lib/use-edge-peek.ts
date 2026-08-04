import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Edge Peek – zusätzliche Komfort-Navigation.
 *
 * Finger direkt am Bildschirmrand ansetzen und langsam zur Mitte ziehen:
 * die Zielseite folgt als Vorschau dem Finger. Beim Loslassen entscheidet
 * die Zugstrecke: < 35 % gleitet zurück, > 35 % öffnet die Seite vollständig.
 *
 * Rein additiv – die bestehende zweistufige Wisch-Navigation startet
 * bewusst außerhalb der Randzone (32 px) und bleibt unberührt.
 */

/** Randzone, in der Edge Peek startet. */
const EDGE = 24;
/** Ab dieser horizontalen Strecke gilt die Geste als Edge Peek. */
const ACTIVATE = 12;
/** Vertikale Toleranz, bevor Scrollen Vorrang erhält. */
const MAX_DY = 24;
/** Schwelle zum vollständigen Öffnen. */
const COMMIT = 0.35;

function isBlocked(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  if (
    el.closest(
      "input, textarea, select, video, audio, form, [role='dialog'], [role='menu'], [aria-modal='true']",
    )
  )
    return true;
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

export type EdgePeekState = {
  /** 0 = geschlossen, 1 = vollständig offen. */
  progress: number;
  dragging: boolean;
  /** true, solange die Geste noch nie aktiv war (Overlay nicht rendern). */
  idle: boolean;
};

export function useEdgePeek(edge: "right" | "left", to: "/arena" | "/dev"): EdgePeekState {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [idle, setIdle] = useState(true);
  const target = useRef(to);
  target.current = to;

  useEffect(() => {
    const sign = edge === "right" ? -1 : 1; // Ziehrichtung ins Bild
    let tracking = false;
    let activated = false;
    let startX = 0;
    let startY = 0;

    const finish = (p: number) => {
      if (p > COMMIT) {
        setProgress(1);
        window.setTimeout(() => {
          void navigate({ to: target.current });
          window.setTimeout(() => {
            setProgress(0);
            setIdle(true);
          }, 60);
        }, 260);
      } else {
        setProgress(0);
        window.setTimeout(() => setIdle(true), 300);
      }
    };

    const reset = () => {
      tracking = false;
      activated = false;
      setDragging(false);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return reset();
      const t = e.touches[0];
      if (!t) return reset();
      const nearEdge =
        edge === "right" ? t.clientX >= window.innerWidth - EDGE : t.clientX <= EDGE;
      if (!nearEdge) return reset();
      if (isBlocked(e.target)) return reset();
      if (document.querySelector("[role='dialog'], [aria-modal='true']")) return reset();
      tracking = true;
      activated = false;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return reset();
      const dx = (t.clientX - startX) * sign;
      const dy = t.clientY - startY;

      if (!activated) {
        if (Math.abs(dy) > MAX_DY || dx < -6) return reset();
        if (dx < ACTIVATE) return;
        activated = true;
        setIdle(false);
        setDragging(true);
      }

      if (e.cancelable) e.preventDefault();
      const p = Math.max(0, Math.min(1, dx / window.innerWidth));
      setProgress(p);
    };

    const onEnd = () => {
      if (!activated) return reset();
      const p = progressRef.current;
      reset();
      finish(p);
    };

    const progressRef = { current: 0 };
    const sync = (p: number) => (progressRef.current = p);
    const unsub = subscribe(sync);

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      unsub();
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edge, navigate]);

  // Fortschritt für den Listener spiegeln (ohne Effekt-Neuaufbau).
  useEffect(() => {
    notify(progress);
  }, [progress]);

  return { progress, dragging, idle };
}

/** Winziger Bus, damit der Touch-Listener den aktuellen Fortschritt kennt. */
const subscribers = new Set<(p: number) => void>();
function subscribe(fn: (p: number) => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
function notify(p: number) {
  subscribers.forEach((fn) => fn(p));
}
