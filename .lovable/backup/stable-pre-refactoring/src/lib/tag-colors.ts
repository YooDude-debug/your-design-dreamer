/**
 * Zentrales Tag-Farbsystem (plattformweit).
 *
 * Hashtags sind immer rot. SlangTag-Farben werden **dynamisch** aus dem
 * SlangTag-Typ (Backend-Feld `kind`) abgeleitet: pro Typ existiert ein
 * Design-Token `--slangtag-<kind>` in `src/styles.css`.
 * Kommt später ein neuer Typ dazu (z. B. `verified`, `partner`, `event`),
 * genügt ein neues Token – am Frontend-Code muss nichts geändert werden.
 */

/** CSS-Variable für Hashtags (#) – immer rot. */
export const HASHTAG_COLOR = "var(--hashtag)";

/** Erlaubte Token-Namen: nur Buchstaben, Zahlen, Bindestrich. */
const SAFE_KIND = /^[a-z0-9-]+$/i;

/**
 * Liefert die CSS-Farbe für einen SlangTag-Typ.
 * Unbekannte Typen fallen automatisch auf `--slangtag-default` zurück.
 */
export function slangTagColor(kind: string | null | undefined): string {
  const key = (kind ?? "").trim().toLowerCase();
  if (!key || !SAFE_KIND.test(key)) return "var(--slangtag-default)";
  return `var(--slangtag-${key}, var(--slangtag-default))`;
}
