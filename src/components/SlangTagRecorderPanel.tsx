/**
 * Eigenstaendiger Aufnahme-Container fuer den SlangTag-Ersteller.
 *
 * Kernidee: die Position wird EINMAL beim Erscheinen aus dem Anker abgeleitet
 * und danach ausschliesslich durch bewusstes Ziehen des Nutzers veraendert.
 * Tastatur, Fokus, Blur, VAD, Vorschlagsliste oder Re-Render bewegen den
 * Container nicht – es gibt bewusst keine Listener auf `resize`, `scroll`
 * oder `visualViewport`.
 */
import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal } from "lucide-react";
import { closeKeyboard, noKeyboardProps } from "@/lib/mobile-keyboard";
import { clampToVisible, topDock, useVisibleViewport } from "@/lib/screen-dock";

type Props = {
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
  const h = popover ? Math.round(popover.getBoundingClientRect().height) : 0;
  const offset = h > 0 ? h + 8 : 0;
  const d = topDock(offset);
  return { left: d.left, top: d.top, width: d.width };
}

/** Vom Nutzer gewaehlte Position bleibt waehrend der Sitzung erhalten. */
let userPos: Pos | null = null;

export function SlangTagRecorderPanel({ className = "", onClose, children }: Props) {
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  // Tastatur auf/zu, Pinch-Zoom, Rotation: sichtbarer Viewport ändert sich.
  const vpTick = useVisibleViewport();

  // Genau einmal messen – spaetere Anker-Bewegungen bleiben ohne Wirkung.
  useEffect(() => {
    if (pos || typeof window === "undefined") return;
    setPos(userPos ?? initialPos());
  }, [pos]);

  /**
   * Solange der Nutzer den Container nicht selbst verschoben hat, gilt die
   * Andockposition am oberen sichtbaren Rand als *berechnet* – sie wird daher
   * bei jeder Änderung des sichtbaren Viewports (Tastatur auf/zu, Zoom,
   * Rotation) neu aus `visualViewport` abgeleitet. Grund für den Restbug:
   * beim ersten Öffnen ist die Tastatur meist schon offen, also enthält die
   * Startposition den damaligen `offsetTop`; nach dem Schliessen der Tastatur
   * blieb dieser Versatz stehen und der Container rutschte nach unten.
   *
   * Hat der Nutzer gezogen (`userPos`), bleibt seine Position erhalten und
   * wird nur so weit korrigiert, dass sie vollständig sichtbar bleibt.
   */
  useEffect(() => {
    if (!pos) return;
    const h = boxRef.current?.offsetHeight ?? 200;
    const next = userPos ? { ...pos, ...clampToVisible(pos, h) } : { ...pos, ...initialPos() };
    if (next.left === pos.left && next.top === pos.top && next.width === pos.width) return;
    if (userPos) userPos = next;
    setPos(next);
  }, [pos, vpTick]);

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
          liegen im Fluss dieses Containers (keine eigene Positionierung).
          Die rechte Spalte ist 2.5rem breit, damit der 36px-Schliessen-Button
          vollstaendig innerhalb des Panels mit ausreichend Luft zum Rand sitzt. */}
      <div className="mb-1.5 grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1">
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
          <CloseButton
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // Tastatur darf zugehen – die Scrollposition bleibt unberuehrt.
              closeKeyboard();
              onClose();
            }}
            label="Aufnahme schließen"
          />
        ) : (
          <span aria-hidden />
        )}
      </div>

      {children}
    </div>,
    document.body,
  );
}
