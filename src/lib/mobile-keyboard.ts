/**
 * Mobile-Tastatur-Helfer.
 *
 * Auf Smartphones oeffnet sich die Bildschirmtastatur, sobald ein Text- oder
 * Textarea-Feld den Fokus bekommt. Aufnahme-, Kamera- und Upload-Buttons
 * duerfen den Fokus nie uebernehmen bzw. an ein Eingabefeld zurueckgeben.
 * Diese Helfer kapseln das Verhalten, ohne Design oder Logik zu aendern.
 */

/** True, wenn das Element ein Feld ist, das die Bildschirmtastatur oeffnet. */
function isTextEntry(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const node = el as HTMLElement;
  if (node.isContentEditable) return true;
  const tag = node.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const type = (node as HTMLInputElement).type;
  return !["button", "submit", "reset", "checkbox", "radio", "file", "range", "hidden"].includes(
    type,
  );
}

/** Entfernt den Fokus vom aktiven Eingabefeld und schliesst so die Tastatur. */
export function closeKeyboard(): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (isTextEntry(active)) active.blur();
}

/**
 * Schliesst die Bildschirmtastatur zuverlaessig, auch wenn der Fokus
 * zwischenzeitlich gewandert ist: das uebergebene Feld wird explizit
 * geblurrt, danach zusaetzlich das aktive Element.
 *
 * Android/iOS klappen die Tastatur nur beim echten `blur()` des Feldes ein –
 * das Ausblenden der Vorschlagsliste allein genuegt nicht.
 */
export function dismissKeyboard(el?: HTMLElement | null): void {
  if (typeof document === "undefined") return;
  el?.blur();
  closeKeyboard();
  // Nachlauf: manche Browser setzen den Fokus im selben Tick zurueck.
  window.setTimeout(() => {
    el?.blur();
    closeKeyboard();
  }, 0);
}

/** True auf Geraeten ohne praezisen Zeiger (Touch) – dort stoert die Tastatur. */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Props fuer Buttons/Labels, die Aufnahme-, Kamera-, Datei- oder Audiodialoge
 * oeffnen: kein Fokusklau, keine Tastatur.
 *
 * `onMouseDown`-preventDefault verhindert den Fokuswechsel, das anschliessende
 * `click` (und damit auch das versteckte `input[type=file]`) bleibt aktiv.
 */
export const noKeyboardProps = {
  onPointerDown: () => closeKeyboard(),
  onTouchStart: () => closeKeyboard(),
  onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault(),
};
