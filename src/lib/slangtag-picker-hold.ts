/**
 * Kurzzeitiger Schutz fuer das offene SlangTag-Popup.
 *
 * Beim Antippen eines Vorschlags verliert das Textfeld zuerst den Fokus
 * (Tastatur schliesst). Das `blur` darf die Vorschlagsliste in diesem Moment
 * nicht ausblenden, sonst kommt der Klick nie an und der SlangTag wird nicht
 * uebernommen.
 *
 * Zusaetzlich gibt es eine dauerhafte Sperre (`latchPicker`): sobald der
 * Nutzer im Popup einen Aufnahme-/Upload-Vorgang startet, darf sich das
 * Fenster nicht mehr von selbst schliessen – Tastaturwechsel, Fokusverlust
 * und Aufnahmedauer sind auf Smartphones beliebig lang. Die Sperre endet nur
 * bewusst: Speichern, Abbrechen (Klick ausserhalb) oder Schliessen.
 */

let heldUntil = 0;
let latched = false;

/** Haelt das Popup fuer kurze Zeit offen (Pointer/Touch im Popup). */
export function holdPicker(ms = 800): void {
  heldUntil = Date.now() + ms;
}

/** Haelt das Popup dauerhaft offen (laufende Aufnahme / Upload-Auswahl). */
export function latchPicker(): void {
  latched = true;
}

/** Loest die dauerhafte Sperre (Speichern, Abbruch, Schliessen). */
export function unlatchPicker(): void {
  latched = false;
  heldUntil = 0;
}

/** True, solange das Popup wegen einer laufenden Auswahl offen bleiben muss. */
export function isPickerHeld(): boolean {
  return latched || Date.now() < heldUntil;
}

/** True, solange die dauerhafte Sperre aktiv ist. */
export function isPickerLatched(): boolean {
  return latched;
}

/** Nach erfolgter Auswahl kann der Schutz sofort entfallen. */
export function releasePicker(): void {
  heldUntil = 0;
  latched = false;
}
