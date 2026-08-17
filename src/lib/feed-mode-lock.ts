/**
 * Sperre fuer den automatischen Feed-Modus.
 *
 * Wenn ein SlangTag-Popup offen ist oder gerade aufgenommen wird, entstehen
 * durch Tastatur, Fokus und Layoutwechsel kleine Scrollbewegungen. Diese
 * duerfen den Werbefeed nicht andocken lassen ("Sprung zur Werbung").
 * Waehrend einer Sperre bleibt das Layout unveraendert.
 */

let locks = 0;
/** Nachlauf, damit das Layout nach dem Schliessen ruhig ausschwingen kann. */
let releasedAt = 0;

/** Sperrt den automatischen Feed-Modus; der Rueckgabewert hebt die Sperre auf. */
export function lockFeedMode(): () => void {
  locks += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    locks = Math.max(0, locks - 1);
    releasedAt = Date.now();
  };
}

/** True, solange der automatische Feed-Modus nicht ausgeloest werden darf. */
export function isFeedModeLocked(): boolean {
  if (locks > 0 || Date.now() - releasedAt < 600) return true;
  if (typeof document === "undefined") return false;

  // Sicherheitsnetz fuer den nativen Fokus-/Keyboard-Zyklus: Dieser kann vor
  // React-Effects einen Scroll-Event ausloesen. Ein offenes SlangTag-Popover
  // oder sein aktives Texteingabefeld darf niemals den Feed andocken lassen.
  if (document.querySelector("[data-slangtag-popover]")) return true;
  const active = document.activeElement;
  return active instanceof HTMLElement && Boolean(active.closest("[data-slangtag-input]"));
}
