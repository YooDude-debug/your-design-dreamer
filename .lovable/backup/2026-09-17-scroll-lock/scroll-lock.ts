/**
 * Zentrale, zaehlerbasierte Scroll-Sperre – EINZIGE Besitzerin der globalen
 * Scroll-Styles an `html`/`body`.
 *
 * Vorher setzte jede Ebene (Feed-Modus, Beitragsdetail, SlangTag-Viewer,
 * Video-Freeze) `document.body.style.overflow` selbst und schrieb beim
 * Schliessen einen zuvor gemerkten Wert zurueck. Oeffnete ein Overlay
 * WAEHREND der Feed angedockt war, merkte es sich `hidden` und schrieb es
 * spaeter zurueck, obwohl der Feed-Modus schon beendet war -> die Seite blieb
 * gesperrt (Feed-Freeze, nur per Reload behebbar).
 *
 * Hier gibt es deshalb keine Momentaufnahmen fremder Werte mehr, sondern nur
 * Zaehler: solange mindestens ein Anforderer die Sperre haelt, bleibt sie
 * aktiv. Erst der letzte `release()` entfernt die Styles vollstaendig.
 * Reihenfolge und Mehrfach-Aufrufe sind dabei beliebig; ein doppeltes
 * `release()` desselben Tokens wird ignoriert und der Zaehler wird nie negativ.
 */

export type ScrollLockOptions = {
  /**
   * Zusaetzlich Touch-Gesten am `body` unterbinden (`touch-action: none`).
   * Wird von der Vollbild-Videowerbung gebraucht.
   */
  touch?: boolean;
};

let scrollLocks = 0;
let touchLocks = 0;

function apply() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;

  if (scrollLocks > 0) {
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehaviorY = "none";
  } else {
    // Vollstaendig zuruecksetzen – niemals auf einen gemerkten Fremdwert.
    root.style.overflow = "";
    body.style.overflow = "";
    body.style.overscrollBehaviorY = "";
  }

  body.style.touchAction = touchLocks > 0 ? "none" : "";
}

/**
 * Sperrt das Dokument-Scrollen. Der Rueckgabewert gibt genau diese eine
 * Anforderung wieder frei (mehrfacher Aufruf ist wirkungslos).
 */
export function lockScroll(options: ScrollLockOptions = {}): () => void {
  const withTouch = options.touch === true;
  scrollLocks += 1;
  if (withTouch) touchLocks += 1;
  apply();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (withTouch) touchLocks = Math.max(0, touchLocks - 1);
    apply();
  };
}

/** True, solange mindestens eine Anforderung die Sperre haelt. */
export function isScrollLocked(): boolean {
  return scrollLocks > 0;
}

/** Anzahl offener Anforderungen – nur fuer Tests/Diagnose. */
export function scrollLockCount(): number {
  return scrollLocks;
}

/** Nur fuer Tests: Zaehler und Styles zuruecksetzen. */
export function resetScrollLockForTests(): void {
  scrollLocks = 0;
  touchLocks = 0;
  apply();
}
