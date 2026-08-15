/**
 * Bildschirmanker fuer Felder mit SlangTag-Popup.
 *
 * Mobile Browser stellen beim Schliessen der Bildschirmtastatur haeufig den
 * alten Seitenscroll wieder her. Genau in diesem Moment verschwindet das
 * Vorschlagsfenster (Auswahl eines SlangTags), wodurch der Eingabebereich
 * sichtbar verrutscht. Dieser Hook haelt die Eingabezeile an ihrer Position:
 * bewegt sich der Anker durch das Tastatur-Ereignis, wird die Differenz
 * ausgeglichen.
 *
 * Wichtig: der Hook lebt am Eingabefeld – nicht am Popup. Nur so wirkt der
 * Ausgleich auch dann, wenn das Popup mit der Auswahl sofort schliesst.
 */
import { useEffect, useState } from "react";
import { isTouchDevice } from "@/lib/mobile-keyboard";

/** Haelt `anchor` waehrend Tastatur-Wechsel auf derselben Bildschirmposition. */
export function keepAnchorStable(anchor: HTMLElement): () => void {
  if (typeof window === "undefined") return () => undefined;
  const vv = window.visualViewport;
  if (!vv) return () => undefined;

  const keyboardOpen = () => vv.height < window.innerHeight * 0.82;
  let wasOpen = keyboardOpen();
  let anchorY = anchor.getBoundingClientRect().top;

  const onViewportChange = () => {
    const open = keyboardOpen();
    if (wasOpen && !open) {
      const delta = anchor.getBoundingClientRect().top - anchorY;
      if (Math.abs(delta) > 1) window.scrollBy(0, delta);
    }
    wasOpen = open;
    anchorY = anchor.getBoundingClientRect().top;
  };

  vv.addEventListener("resize", onViewportChange);
  return () => vv.removeEventListener("resize", onViewportChange);
}

/**
 * Aktiv, solange das Popup offen ist – und bewusst noch kurz danach: das
 * Tastatur-Ereignis beim Auswaehlen trifft erst wenige hundert Millisekunden
 * nach dem Schliessen des Fensters ein.
 */
export function useKeyboardAnchor(
  anchor: HTMLElement | null,
  active: boolean,
  graceMs = 900,
): void {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (active) {
      setArmed(true);
      return;
    }
    const id = window.setTimeout(() => setArmed(false), graceMs);
    return () => window.clearTimeout(id);
  }, [active, graceMs]);

  useEffect(() => {
    if (!armed || !anchor || !isTouchDevice()) return;
    return keepAnchorStable(anchor);
  }, [armed, anchor]);
}
