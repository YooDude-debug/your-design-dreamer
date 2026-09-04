import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type Align = "left" | "right" | "center";

/**
 * Rendert ein Dropdown/Popover per Portal direkt am `body`.
 * Dadurch kann es nie von einem Eltern-Container mit `overflow: hidden`
 * abgeschnitten werden und liegt immer über allen Seitenelementen.
 *
 * Ein Klick/Tap außerhalb des Menüs schließt es. Damit der Klick nicht
 * gleichzeitig ein Element im Hintergrund auslöst (z. B. Feed-Posts), wird das
 * Event in der Capture-Phase abgefangen und gestoppt. Der Anker-Button selbst
 * bleibt erreichbar, damit er als Toggle fungieren kann.
 *
 * Solange das Menü offen ist, liegt eine unsichtbare Sperrfläche darunter: Der
 * Hintergrund scrollt dann nicht mehr weg, wodurch das Menü nicht aus dem
 * sichtbaren Bereich wandern und die Seite nicht in einen anderen Layoutzustand
 * (z. B. die andockende Feed-Leiste) springen kann. Zusätzlich wird die
 * berechnete Position immer in den sichtbaren Bereich eingepasst.
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
  const menuRef = useRef<HTMLDivElement | null>(null);

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
      const vh = window.innerHeight;
      const h = menuRef.current?.offsetHeight ?? 0;
      let top = r.bottom + gap;
      // Passt es unterhalb des Ankers nicht mehr, oberhalb ausklappen …
      if (h > 0 && top + h > vh - margin && r.top - gap - h >= margin) top = r.top - gap - h;
      // … und in jedem Fall im sichtbaren Bereich halten. Ohne diese Klammer
      // folgt das Menü einem aus dem Viewport gescrollten Anker nach oben hinaus.
      const maxTop = Math.max(margin, vh - (h || 0) - margin);
      top = Math.min(Math.max(margin, top), maxTop);
      setPos({ top, left: Math.min(Math.max(margin, raw), maxLeft) });
    };
    place();
    // Zweiter Durchgang, sobald die tatsächliche Menühöhe gemessen werden kann.
    const raf = requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, align, width, gap, anchorRef]);

  // Scrollsperre nur fuer die Dauer des geoeffneten Menues und nur ueber
  // Ereignisse (keine globalen Style-Aenderungen an body/html): So bleibt die
  // Scroll-Logik des Feeds unangetastet, der Hintergrund bewegt sich aber nicht
  // unter dem Menue weg.
  useEffect(() => {
    if (!open) return;
    const block = (e: Event) => {
      const target = e.target as Node | null;
      // Im Menue selbst bleibt Scrollen erlaubt (lange Menuelisten).
      if (target && menuRef.current?.contains(target)) return;
      if (e.cancelable) e.preventDefault();
    };
    const opts = { passive: false, capture: true } as const;
    document.addEventListener("wheel", block, opts);
    document.addEventListener("touchmove", block, opts);
    return () => {
      document.removeEventListener("wheel", block, opts);
      document.removeEventListener("touchmove", block, opts);
    };
  }, [open]);

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

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", closeOnOutside, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, { capture: true });
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Unsichtbare Sperrflaeche: faengt Zeigereingaben im Hintergrund ab.
          Das Schliessen uebernimmt weiterhin der Capture-Handler oben. */}
      <div data-dropdown-backdrop="" className="fixed inset-0 z-[119] touch-none" />
      <div
        ref={menuRef}
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
