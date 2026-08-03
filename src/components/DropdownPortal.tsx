import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

type Align = "left" | "right" | "center";

/**
 * Rendert ein Dropdown/Popover per Portal direkt am `body`.
 * Dadurch kann es nie von einem Eltern-Container mit `overflow: hidden`
 * abgeschnitten werden und liegt immer über allen Seitenelementen.
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
        align === "left" ? r.left : align === "center" ? r.left + r.width / 2 - width / 2 : r.right - width;
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
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if ((target as HTMLElement)?.closest?.("[data-dropdown-portal]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-dropdown-portal=""
      style={{ top: pos.top, left: pos.left, width }}
      className={`fixed z-[120] max-h-[70svh] overflow-y-auto rounded-xl border border-border bg-background/95 p-1.5 shadow-glow backdrop-blur ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
