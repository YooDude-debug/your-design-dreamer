/**
 * Eigenstaendiger Aufnahme-Container fuer den SlangTag-Ersteller.
 *
 * Kernidee: die Position wird EINMAL beim Erscheinen aus dem Anker abgeleitet
 * und danach ausschliesslich durch bewusstes Ziehen des Nutzers veraendert.
 * Tastatur, Fokus, Blur, VAD, Vorschlagsliste oder Re-Render bewegen den
 * Container nicht – es gibt bewusst keine Listener auf `resize`, `scroll`
 * oder `visualViewport`.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal } from "lucide-react";
import { noKeyboardProps } from "@/lib/mobile-keyboard";

type Props = {
  /** Nur fuer die einmalige Startposition (Eingabezeile). */
  anchor: HTMLElement | null;
  /** Themenklassen ($ gruen / $$ blau) – Farben bleiben unveraendert. */
  className?: string;
  children: ReactNode;
};

type Pos = { left: number; top: number; width: number };

/** Startposition: unter dem Anker, im Layout-Viewport gehalten. */
function initialPos(anchor: HTMLElement): Pos {
  const r = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  // Layout-Viewport (`innerHeight`) ist tastaturunabhaengig.
  const vh = window.innerHeight;
  const width = Math.round(Math.min(Math.max(r.width, 260), vw - 16));
  let left = Math.round(r.left);
  if (left + width > vw - 8) left = vw - 8 - width;
  if (left < 8) left = 8;
  let top = Math.round(r.bottom + 8);
  const maxTop = vh - 200;
  if (top > maxTop) top = Math.max(8, maxTop);
  return { left, top, width };
}

/** Vom Nutzer gewaehlte Position bleibt waehrend der Sitzung erhalten. */
let userPos: Pos | null = null;

export function SlangTagRecorderPanel({ anchor, className = "", children }: Props) {
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Genau einmal messen – spaetere Anker-Bewegungen bleiben ohne Wirkung.
  useEffect(() => {
    if (pos || !anchor || typeof window === "undefined") return;
    setPos(userPos ?? initialPos(anchor));
  }, [anchor, pos]);


  const onPointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    e.preventDefault();
    drag.current = { dx: e.clientX - pos.left, dy: e.clientY - pos.top };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !pos) return;
    const h = boxRef.current?.offsetHeight ?? 200;
    const left = Math.min(
      Math.max(8, e.clientX - d.dx),
      Math.max(8, window.innerWidth - pos.width - 8),
    );
    const top = Math.min(Math.max(8, e.clientY - d.dy), Math.max(8, window.innerHeight - h - 8));
    const next = { ...pos, left: Math.round(left), top: Math.round(top) };
    userPos = next;
    setPos(next);
  };

  const endDrag = () => {
    drag.current = null;
  };

  if (typeof document === "undefined" || !pos) return null;

  return createPortal(
    <div
      ref={boxRef}
      data-slangtag-recorder=""
      data-slangtag-popover=""
      style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 10000 }}
      className={`rounded-xl border bg-surface/95 p-2.5 backdrop-blur-xl ${className}`}
    >
      <div
        {...noKeyboardProps}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label="Aufnahme-Container verschieben"
        className="mb-1.5 flex cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
      >
        <GripHorizontal className="h-4 w-4" />
      </div>
      {children}
    </div>,
    document.body,
  );
}
