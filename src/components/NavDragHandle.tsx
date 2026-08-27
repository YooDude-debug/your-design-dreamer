import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { NavTarget } from "@/lib/use-swipe-nav-gesture";
import { setSlideDirection } from "@/lib/use-swipe-nav-gesture";

/**
 * Seitliches Zieh-Handle als echtes horizontales Page-Swipe.
 *
 * Beim Ziehen wird die komplette aktuelle Seite (`[data-page-root]`)
 * 1:1 mit dem Finger verschoben; gleichzeitig gleitet die Zielseite
 * (Feed-Karte) von der Gegenseite herein. Beim Loslassen entscheidet
 * Distanz bzw. Geschwindigkeit über Navigation oder weiches Zurückfedern.
 *
 * Das Handle bleibt bewusst Teil des Seiten-Containers (`[data-page-root]`):
 * Da dieser beim Swipe transformiert wird, wandert das Handle 1:1 mit der
 * Seite aus dem Viewport und kommt gemeinsam mit ihr zurück. Nur die
 * einlaufende Feed-Karte wird per Portal am Viewport verankert.
 *
 * Während der Geste werden ausschließlich DOM-Styles gesetzt (kein
 * React-State), damit pro Fingerbewegung kein Re-Render entsteht.
 * Ein einziger Pointer-Pfad (mit Pointer-Capture) bedient Maus, Stift
 * und Touch; `touchmove` dient nur dem Unterdrücken des Scrollens.
 */

/** Anteil der Viewport-Breite, ab dem die Navigation ausgelöst wird. */
const COMMIT_RATIO = 0.3;
/** Geschwindigkeit (px/ms), ab der auch kurze Swipes auslösen. */
const COMMIT_VELOCITY = 0.45;
/** Ab dieser Strecke gilt die Geste als Ziehen (kein Tap mehr). */
const DRAG_MIN = 6;
/** Weiche Auslauf-Animation. */
const EASE = "transform 300ms cubic-bezier(0.22,1,0.36,1)";

export function NavDragHandle({
  to,
  side,
  label = "Zurück zum Feed",
}: {
  to: NavTarget;
  side: "left" | "right";
  label?: string;
}) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const incomingRef = useRef<HTMLDivElement | null>(null);

  // Navigation stabil halten, ohne die Listener neu zu registrieren.
  const goRef = useRef(() => {});
  goRef.current = () => {
    setSlideDirection(side === "left" ? "from-left" : "from-right");
    void navigate({ to });
  };

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;
    // Ziehrichtung zur Mitte: linkes Handle nach rechts, rechtes nach links.
    const sign = side === "left" ? 1 : -1;
    const incoming = incomingRef.current;
    let page: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let offset = 0;
    let active = false;
    let moved = false;

    /** Alle drei Ebenen (Seite, einlaufende Karte, Handle) gemeinsam setzen. */
    const paint = (px: number, animate: boolean) => {
      const transition = animate ? EASE : "none";
      const width = window.innerWidth || 1;
      const progress = Math.min(1, px / width);
      if (page) {
        page.style.transition = transition;
        page.style.transform = px === 0 ? "" : `translate3d(${px * sign}px,0,0)`;
      }
      if (incoming) {
        incoming.style.opacity = px > 0 ? "1" : "0";
        incoming.style.transition = transition;
        incoming.style.transform = `translate3d(${(1 - progress) * 100 * -sign}%,0,0)`;
      }
    };

    /** Inline-Styles der Seite nach dem Auslaufen der Animation aufräumen. */
    const resetPageStyles = () => {
      const p = page;
      if (!p) return;
      window.setTimeout(() => {
        p.style.transition = "";
        p.style.transform = "";
        p.style.willChange = "";
      }, 320);
    };

    const begin = (x: number, y: number, t: number) => {
      active = true;
      moved = false;
      offset = 0;
      startX = x;
      startY = y;
      lastX = x;
      lastT = t;
      velocity = 0;
      page = document.querySelector<HTMLElement>("[data-page-root]");
      if (page) page.style.willChange = "transform";
    };

    const move = (x: number, y: number, t: number) => {
      if (!active) return;
      if (Math.abs(x - startX) > DRAG_MIN || Math.abs(y - startY) > DRAG_MIN) moved = true;
      const dt = Math.max(1, t - lastT);
      velocity = ((x - lastX) * sign) / dt;
      lastX = x;
      lastT = t;
      offset = Math.max(0, Math.min((x - startX) * sign, window.innerWidth));
      paint(offset, false);
    };

    const end = () => {
      if (!active) return;
      active = false;
      if (!moved) {
        paint(0, true);
        resetPageStyles();
        goRef.current();
        return;
      }
      const commit =
        offset >= window.innerWidth * COMMIT_RATIO || (offset > 24 && velocity >= COMMIT_VELOCITY);
      if (commit) {
        paint(window.innerWidth, true);
        window.setTimeout(() => {
          resetPageStyles();
          goRef.current();
        }, 180);
      } else {
        paint(0, true);
        resetPageStyles();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      e.stopPropagation();
      begin(e.clientX, e.clientY, e.timeStamp);
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        /* Pointer-Capture ist optional */
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!active) return;
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      move(e.clientX, e.clientY, e.timeStamp);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!active) return;
      e.stopPropagation();
      end();
    };
    // Nur Scroll-Unterdrückung während einer aktiven Geste.
    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("lostpointercapture", onPointerUp);
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("lostpointercapture", onPointerUp);
      el.removeEventListener("touchmove", onTouchMove);
      if (page) {
        page.style.transition = "";
        page.style.transform = "";
        page.style.willChange = "";
      }
    };
    // `mounted` ist Teil der Deps: das Handle existiert erst nach dem Portal-Mount.
  }, [side, mounted]);

  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  if (!mounted) return null;

  return (
    <>
      {createPortal(
        <div
          ref={incomingRef}
          aria-hidden
          data-nav-incoming
          className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-background opacity-0"
          style={{
            transform: `translate3d(${side === "left" ? 100 : -100}%,0,0)`,
            willChange: "transform",
          }}
        >
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Feed
          </span>
        </div>,
        document.body,
      )}
      {/* Bewusst KEIN Portal: bleibt Teil des Seiten-Containers und wandert beim
          Swipe mit (fixed nutzt den transformierten Vorfahren als Bezug),
          bleibt beim normalen Scrollen aber am Viewport verankert. */}
      <div
        aria-hidden={false}
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[100svh]"
      >
        <button
          ref={handleRef}
          type="button"
          aria-label={label}
          title={label}
          className={`control-bar control-chip pointer-events-auto absolute top-1/2 flex h-[132px] w-9 items-center justify-center active:text-brand ${
            side === "left" ? "left-0 rounded-r-2xl" : "right-0 rounded-l-2xl"
          }`}
          style={{
            touchAction: "none",
            transform: "translate3d(0,-50%,0)",
            willChange: "transform",
          }}
        >
          {/* Unsichtbare, größere Trefferfläche – ändert Optik/Position nicht. */}
          <span
            aria-hidden
            className={`absolute -inset-y-4 ${side === "left" ? "-right-4 left-0" : "-left-4 right-0"}`}
          />
          <Icon className="pointer-events-none relative h-7 w-7" />
        </button>
      </div>
    </>
  );
}
