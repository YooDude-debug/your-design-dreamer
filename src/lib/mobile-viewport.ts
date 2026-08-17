/**
 * Einheitliches Keyboard-/Viewport-Handling fuer mobile Eingabebereiche.
 *
 * Ursache des alten Verrutschens: die Position des SlangTag-Aufnahmefensters
 * wurde aus dem Rechteck des Eingabefeldes berechnet (`getBoundingClientRect`)
 * und zusaetzlich per `window.scrollBy` gegen die Scroll-Wiederherstellung des
 * Browsers ausgeglichen. Beim Oeffnen/Schliessen der Tastatur aendert der
 * Browser jedoch sowohl Scroll-Position als auch `visualViewport` – die
 * Nachrechnung und die Scroll-Korrektur summierten sich zu einer sichtbaren,
 * kumulativen Verschiebung.
 *
 * Loesung: auf Touch-Geraeten wird der Bereich nicht mehr am Feld, sondern am
 * sichtbaren Viewport verankert. Dieser Hook liefert dafuer die Hoehe der
 * eingeblendeten Tastatur ("Keyboard-Inset"). Es wird nichts gescrollt und
 * keine Layout-Groesse veraendert.
 */
import { useEffect, useState } from "react";

/** Aktuelle Tastaturhoehe in CSS-Pixeln (0 = Tastatur geschlossen). */
export function readKeyboardInset(): number {
  if (typeof window === "undefined") return 0;
  const vv = window.visualViewport;
  if (!vv) return 0;
  const inset = window.innerHeight - (vv.height + vv.offsetTop);
  // Kleine Rundungsdifferenzen der Browser ignorieren.
  return inset > 24 ? Math.round(inset) : 0;
}

/**
 * Beobachtet die Tastaturhoehe. Aktualisierungen laufen ueber
 * `requestAnimationFrame`, damit waehrend der Tastatur-Animation keine
 * Re-Render-Kette entsteht.
 */
export function useKeyboardInset(active = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    let raf: number | null = null;
    const apply = () => {
      raf = null;
      setInset((current) => {
        const next = readKeyboardInset();
        return Math.abs(next - current) > 2 ? next : current;
      });
    };
    const schedule = () => {
      if (raf === null) raf = window.requestAnimationFrame(apply);
    };
    apply();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [active]);

  return inset;
}
