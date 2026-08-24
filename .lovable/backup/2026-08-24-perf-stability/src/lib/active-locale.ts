/**
 * Aktive UI-Sprache für reine Formatier-Helfer (ohne React-Kontext).
 * Quelle ist derselbe localStorage-Schlüssel, den `LanguageProvider` pflegt.
 */
export type ActiveLang = "de" | "en" | "el";

const STORAGE_KEY = "ydude.lang";

const LOCALE: Record<ActiveLang, string> = {
  de: "de-DE",
  en: "en-GB",
  el: "el-GR",
};

/** Gewählte Sprache; im Server-Rendering bleibt Deutsch der Standard. */
export function activeLang(): ActiveLang {
  if (typeof window === "undefined") return "de";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "el" || v === "de" ? v : "de";
  } catch {
    return "de";
  }
}

/** BCP-47-Locale zur gewählten Sprache (für `toLocaleDateString` etc.). */
export function activeLocale(): string {
  return LOCALE[activeLang()];
}
