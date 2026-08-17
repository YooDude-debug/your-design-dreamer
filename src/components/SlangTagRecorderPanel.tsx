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
import { GripHorizontal, X } from "lucide-react";
import { closeKeyboard, isTouchDevice, noKeyboardProps } from "@/lib/mobile-keyboard";
import { topDock } from "@/lib/screen-dock";


type Props = {
  /** Nur fuer die einmalige Startposition (Eingabezeile). */
  anchor: HTMLElement | null;
  /** Themenklassen ($ gruen / $$ blau) – Farben bleiben unveraendert. */
  className?: string;
  /** Schliesst ausschliesslich diesen Aufnahme-Container. */
  onClose?: () => void;
  children: ReactNode;
};


type Pos = { left: number; top: number; width: number };

/**
 * Startposition: immer am oberen sichtbaren Bildschirmbereich, direkt unter
 * einem eventuell geoeffneten Vorschlagsfenster (kein Ueberlappen). Gilt fuer
 * Touch und Maus/Desktop gleich.
 */
function initialPos(): Pos {
  const popover = document.querySelector<HTMLElement>(
    "[data-slangtag-popover]:not([data-slangtag-recorder])",
  );
  const offset = popover ? Math.round(popover.getBoundingClientRect().height) + 8 : 0;
  const d = topDock(offset);
  return { left: d.left, top: d.top, width: d.width };
}


/** Vom Nutzer gewaehlte Position bleibt waehrend der Sitzung erhalten. */
let userPos: Pos | null = null;

export function SlangTagRecorderPanel({ anchor, className = "", onClose, children }: Props) {
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
      {/* Kopfzeile des Containers: Griff mittig, Schliessen rechts – beide
          liegen im Fluss dieses Containers (keine eigene Positionierung). */}
      <div className="mb-1.5 grid grid-cols-[1.5rem_minmax(0,1fr)_1.5rem] items-center">
        <span aria-hidden />
        <div
          {...noKeyboardProps}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label="Aufnahme-Container verschieben"
          className="flex cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
        >
          <GripHorizontal className="h-4 w-4" />
        </div>
        {onClose ? (
          <button
            type="button"
            {...noKeyboardProps}
            onClick={(e) => {
              e.stopPropagation();
              // Tastatur darf zugehen – die Scrollposition bleibt unberuehrt.
              closeKeyboard();
              onClose();
            }}
            aria-label="Aufnahme schließen"
            className="grid h-6 w-6 place-items-center justify-self-end rounded-full text-muted-foreground transition-colors hover:text-brand"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span aria-hidden />
        )}
      </div>

      {children}
    </div>,
    document.body,
  );
}
