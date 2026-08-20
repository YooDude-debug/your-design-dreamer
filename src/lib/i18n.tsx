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
    if (stored === "de" || stored === "en" || stored === "el") {
      setLangState(stored);
      return;
    }
    // Ohne eigene Auswahl gilt die im Profil gespeicherte Sprachpräferenz.
    let active = true;
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: auth } = await supabase.auth.getSession();
        const uid = auth.session?.user.id;
        if (!uid || !active) return;
        const { data } = await supabase.from("profiles").select("language").eq("id", uid).maybeSingle();
        const pref = (data?.language ?? "").slice(0, 2).toLowerCase();
        if (active && (pref === "de" || pref === "en" || pref === "el")) setLangState(pref);
      } catch {
        /* Profilsprache nicht verfügbar – Standard bleibt */
      }
    })();
    return () => {
      active = false;
    };
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
