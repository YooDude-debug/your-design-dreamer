import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

type Align = "left" | "right" | "center";

/**
 * Rendert ein Dropdown/Popover per Portal direkt am `body`.
 * Dadurch kann es nie von einem Eltern-Container mit `overflow: hidden`
 * abgeschnitten werden und liegt immer über allen Seitenelementen.
 *
 * Ein transparenter Backdrop unter dem Menü fängt Klicks/Taps außerhalb ab,
 * schließt das Menü und verhindert, dass gleichzeitig Elemente im Hintergrund
 * ausgelöst werden (z. B. Feed-Posts). Der Backdrop liegt unterhalb des
 * Anker-Buttons und des Menüs, damit beide weiterhin normal bedient werden.
 */
export function DropdownPortal({
  anchorRef,
  open,
  onClose,
  align = "right",
  width = 224,
  gap = 8,
  className = "",
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  align?: Align;
  /** Breite in px – wird beim Positionieren berücksichtigt. */
  width?: number;
  /** Abstand zum Anker in px. */
  gap?: number;
  className?: string;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - width - margin);
      const raw =
        align === "left"
          ? r.left
          : align === "center"
            ? r.left + r.width / 2 - width / 2
            : r.right - width;
      setPos({ top: r.bottom + gap, left: Math.min(Math.max(margin, raw), maxLeft) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, align, width, gap, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Transparenter Backdrop: fängt Außerhalb-Klicks/Taps ab,
          schließt das Menü und verhindert Weiterleitung an den Seiteninhalt. */}
      <div
        aria-hidden="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-[55] bg-transparent"
      />
      <div
        data-dropdown-portal=""
        style={{ top: pos.top, left: pos.left, width }}
        /* Deckendes Schwarz aus dem globalen Theme: kein Blur/keine Transparenz,
           damit helle Flächen darunter (z. B. Cover-Glow) nicht durchgrauen. */
        className={`fixed z-[120] max-h-[70svh] overflow-y-auto rounded-xl border border-border/70 bg-background p-1.5 shadow-[var(--shadow-card)] ${className}`}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
