/**
 * Leichtgewichtige Sprachvorprüfung (client- und serverseitig nutzbar).
 *
 * Zweck ist ausschliesslich Kostenkontrolle: wenn die Ausgangssprache
 * offensichtlich der Zielsprache entspricht, wird gar kein KI-Aufruf gestartet.
 * Alles Uneindeutige wird bewusst als `null` gemeldet und dann von der
 * KI-Spracherkennung entschieden.
 */

/** Aktuell unterstuetzte Zielsprachen – erweiterbar ohne Codeaenderung. */
export const TRANSLATION_LANGS = ["de", "en", "el"] as const;
export type TranslationLang = (typeof TRANSLATION_LANGS)[number];

export function isTranslationLang(value: unknown): value is TranslationLang {
  return typeof value === "string" && (TRANSLATION_LANGS as readonly string[]).includes(value);
}

/** Anzeigename einer Sprache in der Sprache der Oberflaeche. */
export function languageName(lang: string, locale: string): string {
  try {
    const dn = new Intl.DisplayNames([locale], { type: "language" });
    return dn.of(lang) ?? lang.toUpperCase();
  } catch {
    return lang.toUpperCase();
  }
}

const GREEK = /[\u0370-\u03ff\u1f00-\u1fff]/;

/** Haeufige Funktionswoerter – nur zur grobem Vorabunterscheidung de/en. */
const HINTS: Record<"de" | "en", RegExp> = {
  de: /\b(ich|du|nicht|und|ist|das|wie|geht|dir|heute|kannst|morgen|die|der|den|wir|ihr|bitte|danke|was|mit|auch|aber|schon|noch|mal|gut|sehr)\b/gi,
  en: /\b(i|you|not|and|is|the|how|are|today|can|tomorrow|we|they|please|thanks|what|with|also|but|already|still|good|very|do|does)\b/gi,
};

function count(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

/**
 * Erkennt nur klare Faelle. Griechische Schrift ist eindeutig; bei de/en muss
 * eine Seite deutlich ueberwiegen, sonst wird `null` geliefert.
 */
export function guessLanguage(text: string): TranslationLang | null {
  const value = text.trim();
  if (value.length < 3) return null;
  if (GREEK.test(value)) return "el";
  const de = count(value, HINTS.de);
  const en = count(value, HINTS.en);
  if (de >= 2 && de > en) return "de";
  if (en >= 2 && en > de) return "en";
  return null;
}

/**
 * True, wenn sicher keine Uebersetzung noetig ist (gleiche Sprache erkannt).
 * Bei Unsicherheit bewusst false: dann entscheidet die serverseitige Erkennung.
 */
export function certainlySameLanguage(text: string, target: string): boolean {
  const guess = guessLanguage(text);
  return guess !== null && guess === target;
}
