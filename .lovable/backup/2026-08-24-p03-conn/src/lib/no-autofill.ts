/**
 * Schutz gegen Browser-Autofill und Passwortmanager in SlangTag-Feldern.
 *
 * Hintergrund: Passwortmanager füllen beliebige Textfelder einer Seite –
 * auch solche, die gerade keinen Fokus haben. Dadurch konnte das
 * SlangTag-Overlay außerhalb des SlangTag-Workflows aufpoppen
 * (z. B. während Profil-, Konto- oder Sicherheitsformulare genutzt wurden).
 */

/** Attribute, die Autofill/Passwortmanager in SlangTag-Feldern unterbinden. */
export const noAutofillProps = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "none",
  spellCheck: false,
  // Neutraler Name: Passwortmanager erkennen kein Login-/Profilfeld.
  name: "ydude-slangtag-input",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;

/**
 * true, wenn die Änderung eindeutig von echter Nutzereingabe im Feld stammt.
 * Autofill feuert ohne Fokus (und teils ohne vertrauenswürdiges Event).
 */
export function isUserEdit(e: { target: EventTarget | null; nativeEvent: Event }): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  if (!e.nativeEvent?.isTrusted) return false;
  if (typeof document !== "undefined" && document.activeElement !== el) return false;
  return true;
}

/** Werte, die typisch für Zugangsdaten/E-Mails sind – nie ein SlangTag. */
export function looksLikeCredential(value: string): boolean {
  return value.includes("@") || value.length > 40;
}
