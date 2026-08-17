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

  // Der Composer ist der Besitzer seines eigenen Scrollkontexts. Solange er
  // geoeffnet/aktiv ist, darf keine seiner Layout- oder Tastaturbewegungen den
  // Feed-Modus einrasten lassen. Die Sperre gilt ab dem Oeffnen – nicht erst,
  // wenn das SlangTag-Fenster gemountet wird.
  if (document.querySelector("[data-composer-active='true']")) return true;

  // Sicherheitsnetz fuer den nativen Fokus-/Keyboard-Zyklus: Dieser kann vor
  // React-Effects einen Scroll-Event ausloesen. Fokus im Composer, ein offenes
  // SlangTag-Popover oder sein Texteingabefeld darf nie andocken lassen.
  if (document.querySelector("[data-slangtag-popover]")) return true;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return Boolean(active.closest("[data-slangtag-input]") || active.closest("[data-composer-root]"));
}

