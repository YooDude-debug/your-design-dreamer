import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { NavTarget } from "@/lib/use-swipe-nav-gesture";
import { setSlideDirection } from "@/lib/use-swipe-nav-gesture";

/**
 * Dezentes seitliches Zieh-Handle mit Zurück-Symbol.
 *
 * Das Handle wird mit dem Finger zur Bildschirmmitte gezogen; ab
 * `COMMIT` Pixeln öffnet es die Zielseite. Ein einfacher Tap navigiert
 * ebenfalls. Alle Listener hängen ausschließlich am Handle, damit
 * Globe-Rotation, Zoom und Seiten-Scrolling unberührt bleiben.
 */

/** Ziehstrecke, ab der die Navigation ausgelöst wird. */
const COMMIT = 60;
/** Maximale sichtbare Auslenkung. */
const MAX_PULL = 120;
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
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);

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
    let active = false;
    let moved = false;

    const begin = (x: number, y: number) => {
      active = true;
      moved = false;
      startX = x;
      startY = y;
      setDragging(true);
    };

    const move = (x: number, y: number) => {
      if (!active) return;
      const dx = (x - startX) * sign;
      const dy = Math.abs(y - startY);
      if (Math.abs(x - startX) > DRAG_MIN || dy > DRAG_MIN) moved = true;
      setOffset(Math.max(0, Math.min(dx * 0.8, MAX_PULL)));
    };

    const end = () => {
      if (!active) return;
      const committed = offsetRef.current >= COMMIT;
      active = false;
      setDragging(false);
      setOffset(0);
      if (committed || !moved) go();
    };

    const onTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      const t = e.touches[0];
      if (!t) return;
      begin(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      move(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.stopPropagation();
      end();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      e.stopPropagation();
      begin(e.clientX, e.clientY);
      el.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !active) return;
      move(e.clientX, e.clientY);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      end();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [side, go]);

  // Aktuellen Offset für den Touch-Handler ohne Neuregistrierung bereitstellen.
  const offsetRef = useRef(0);
  offsetRef.current = offset;

  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  const translate = side === "left" ? offset : -offset;

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`fixed top-1/2 z-30 flex h-[72px] w-5 items-center justify-center border border-border/60 bg-surface/60 text-muted-foreground backdrop-blur-md transition-colors hover:text-brand active:text-brand ${
        side === "left" ? "left-0 rounded-r-2xl" : "right-0 rounded-l-2xl"
      }`}
      style={{
        touchAction: "none",
        transform: `translate3d(${translate}px,-50%,0)`,
        transition: dragging ? "none" : "transform 260ms cubic-bezier(0.22,1,0.36,1)",
        willChange: "transform",
      }}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
