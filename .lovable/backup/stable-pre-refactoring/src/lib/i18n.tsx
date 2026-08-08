import { useEffect, useState, type ReactNode } from "react";
import { FEATURES, LOCALES, translations } from "./i18n-dict";
import { LangCtx } from "./lang-context";
import type { Lang } from "./i18n-dict";

export type { Lang, Dict } from "./i18n-dict";

const STORAGE_KEY = "ydude.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "de" || stored === "en" || stored === "el") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* Speicher nicht verfügbar */
    }
  };

  return (
    <LangCtx.Provider
      value={{
        lang,
        setLang,
        t: translations[lang],
        locale: LOCALES[lang],
        features: FEATURES[lang],
      }}
    >
      {children}
    </LangCtx.Provider>
  );
}
