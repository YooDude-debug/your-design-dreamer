import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
 * Das Handle wird per Portal an `document.body` gerendert, damit seine
 * `fixed`-Position nie von Content-Höhe, Scroll-Position oder
 * transformierten Vorfahren abhängt.
 */

/** Anteil der Viewport-Breite, ab dem die Navigation ausgelöst wird. */
const COMMIT_RATIO = 0.3;
/** Geschwindigkeit (px/ms), ab der auch kurze Swipes auslösen. */
const COMMIT_VELOCITY = 0.45;
/** Ab dieser Strecke gilt die Geste als Ziehen (kein Tap mehr). */
const DRAG_MIN = 6;

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
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  const offsetRef = useRef(0);
  offsetRef.current = offset;

  useEffect(() => setMounted(true), []);

  const go = useCallback(() => {
    setSlideDirection(side === "left" ? "from-left" : "from-right");
    void navigate({ to });
  }, [navigate, side, to]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Ziehrichtung zur Mitte: linkes Handle nach rechts, rechtes nach links.
    const sign = side === "left" ? 1 : -1;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let active = false;
    let moved = false;
    let page: HTMLElement | null = null;

    const setPage = (px: number, animate: boolean) => {
      if (!page) return;
      page.style.transition = animate
        ? "transform 300ms cubic-bezier(0.22,1,0.36,1)"
        : "none";
      page.style.transform = px === 0 ? "" : `translate3d(${px}px,0,0)`;
      page.style.willChange = "transform";
    };

    const clearPage = () => {
      if (!page) return;
      const p = page;
      window.setTimeout(() => {
        p.style.transition = "";
        p.style.transform = "";
        p.style.willChange = "";
      }, 320);
    };

    const begin = (x: number, y: number, t: number) => {
      active = true;
      moved = false;
      startX = x;
      startY = y;
      lastX = x;
      lastT = t;
      velocity = 0;
      page = document.querySelector<HTMLElement>("[data-page-root]");
      setDragging(true);
    };

    const move = (x: number, y: number, t: number) => {
      if (!active) return;
      const raw = (x - startX) * sign;
      if (Math.abs(x - startX) > DRAG_MIN || Math.abs(y - startY) > DRAG_MIN) moved = true;
      const dt = Math.max(1, t - lastT);
      velocity = ((x - lastX) * sign) / dt;
      lastX = x;
      lastT = t;
      const px = Math.max(0, Math.min(raw, window.innerWidth));
      setOffset(px);
      setPage(px * sign, false);
    };

    const end = () => {
      if (!active) return;
      active = false;
      const px = offsetRef.current;
      const commit =
        px >= window.innerWidth * COMMIT_RATIO ||
        (px > 24 && velocity >= COMMIT_VELOCITY);
      setDragging(false);
      if (!moved) {
        setOffset(0);
        setPage(0, true);
        clearPage();
        go();
        return;
      }
      if (commit) {
        setOffset(window.innerWidth);
        setPage(window.innerWidth * sign, true);
        window.setTimeout(() => {
          setOffset(0);
          clearPage();
          go();
        }, 180);
      } else {
        setOffset(0);
        setPage(0, true);
        clearPage();
      }
    };

    // Ein einziger Pointer-Pfad für Maus, Stift und Touch mit Pointer-Capture,
    // damit die Geste weiterläuft, wenn der Finger das Handle verlässt.
    const onPointerDown = (e: PointerEvent) => {
      e.stopPropagation();
      begin(e.clientX, e.clientY, e.timeStamp);
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
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
    // Fallback für Browser ohne zuverlässige Pointer-Events auf Touch:
    // verhindert nur das Scrollen während einer aktiven Geste.
    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY, e.timeStamp);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!active) return;
      e.stopPropagation();
      end();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("lostpointercapture", onPointerUp);
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("lostpointercapture", onPointerUp);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (page) {
        page.style.transition = "";
        page.style.transform = "";
        page.style.willChange = "";
      }
    };
    // `mounted` ist Teil der Deps: das Handle existiert erst nach dem Portal-Mount.
  }, [side, go, mounted]);


  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  const width = typeof window === "undefined" ? 0 : window.innerWidth;
  const progress = width > 0 ? Math.min(1, offset / width) : 0;
  // Einlaufende Feed-Karte von der Gegenseite (rechtes Handle → Karte von links).
  const incoming = side === "left" ? (1 - progress) * -100 : (1 - progress) * 100;

  const node = (
    <>
      {offset > 0 && (
        <div
          aria-hidden
          className="fixed inset-0 z-20 flex items-center justify-center bg-background"
          style={{
            transform: `translate3d(${incoming}%,0,0)`,
            transition: dragging ? "none" : "transform 300ms cubic-bezier(0.22,1,0.36,1)",
            willChange: "transform",
            pointerEvents: "none",
          }}
        >
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Feed
          </span>
        </div>
      )}
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={`fixed top-1/2 z-[60] flex h-[72px] w-5 items-center justify-center border border-border/60 bg-surface/60 text-muted-foreground backdrop-blur-md transition-colors hover:text-brand active:text-brand ${
          side === "left" ? "left-0 rounded-r-2xl" : "right-0 rounded-l-2xl"
        }`}
        style={{
          touchAction: "none",
          transform: `translate3d(${Math.min(offset, 120) * (side === "left" ? 1 : -1)}px,-50%,0)`,
          transition: dragging ? "none" : "transform 300ms cubic-bezier(0.22,1,0.36,1)",
          willChange: "transform",
        }}
      >
        {/* Unsichtbare, größere Trefferfläche – ändert die Optik/Position nicht. */}
        <span
          aria-hidden
          className={`absolute -inset-y-4 ${side === "left" ? "-right-3 left-0" : "-left-3 right-0"}`}
        />
        <Icon className="pointer-events-none relative h-4 w-4" />
      </button>

    </>
  );

  if (!mounted) return null;
  return createPortal(node, document.body);
}
