/**
 * Kurzzeitiger Schutz fuer das offene SlangTag-Popup.
 *
 * Beim Antippen eines Vorschlags verliert das Textfeld zuerst den Fokus
 * (Tastatur schliesst). Das `blur` darf die Vorschlagsliste in diesem Moment
 * nicht ausblenden, sonst kommt der Klick nie an und der SlangTag wird nicht
 * uebernommen.
 */

let heldUntil = 0;

/** Haelt das Popup fuer kurze Zeit offen (Pointer/Touch im Popup). */
export function holdPicker(ms = 800): void {
  heldUntil = Date.now() + ms;
}

/** True, solange das Popup wegen einer laufenden Auswahl offen bleiben muss. */
export function isPickerHeld(): boolean {
  return Date.now() < heldUntil;
}

/** Nach erfolgter Auswahl kann der Schutz sofort entfallen. */
export function releasePicker(): void {
  heldUntil = 0;
}
