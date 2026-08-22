import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Minimale Dialog-Zugänglichkeit für bestehende Overlays:
 * - Fokus beim Öffnen in den Dialog setzen
 * - Tab/Shift+Tab innerhalb des Dialogs halten (Fokusfalle)
 * - Escape schliesst (kann per `escapeEnabled` unterdrückt werden, wenn ein
 *   inneres Element Escape selbst braucht)
 * - Fokus beim Schliessen an das auslösende Element zurückgeben
 *
 * Rein additiv – es werden keine Styles und kein Verhalten der Inhalte verändert.
 */
export function useDialogA11y({
  open,
  onClose,
  escapeEnabled = true,
}: {
  open: boolean;
  onClose: () => void;
  escapeEnabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const escRef = useRef(escapeEnabled);
  escRef.current = escapeEnabled;

  // Auslösendes Element merken und Fokus in den Dialog setzen.
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : null;

    const id = window.setTimeout(() => {
      const root = containerRef.current;
      if (!root || root.contains(document.activeElement)) return;
      const first = root.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? root).focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(id);
      const opener = openerRef.current;
      openerRef.current = null;
      // Fokus nur zurückgeben, wenn das Element noch im Dokument hängt.
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]);

  // Tastatur: Escape schliesst, Tab bleibt im Dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (e.key === "Escape") {
        if (!escRef.current) return;
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      if (!current || !root.contains(current)) {
        e.preventDefault();
        first.focus({ preventScroll: true });
        return;
      }
      if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  return containerRef;
}
