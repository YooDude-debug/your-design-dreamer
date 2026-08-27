import { useEffect, useRef, useState, type ReactNode } from "react";
import { FEATURES, LOCALES, translations } from "./i18n-dict";
import { LangCtx } from "./lang-context";
import { guessLangFromBrowser, langFromCountry } from "./lang-geo";
import type { Lang } from "./i18n-dict";

export type { Lang, Dict } from "./i18n-dict";

const STORAGE_KEY = "ydude.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");
  /** True, sobald eine gespeicherte oder manuelle Wahl vorliegt (hat Vorrang). */
  const explicitRef = useRef(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    let active = true;

    // Priorität 1: gespeicherte manuelle Wahl. Sonst sofortige Browser-Schätzung
    // (ohne Netzwerk) und danach Feinabstimmung über das erkannte Land.
    if (stored === "de" || stored === "en" || stored === "el") {
      explicitRef.current = true;
    } else {
      setLangState(guessLangFromBrowser());
      void (async () => {
        try {
          const { getVisitorCountry } = await import("./geo-lang.functions");
          const res = await getVisitorCountry();
          const byCountry = langFromCountry(res.country);
          if (active && byCountry && !explicitRef.current) setLangState(byCountry);
        } catch {
          /* Länderkennung nicht verfügbar – Browser-Schätzung bleibt */
        }
      })();
    }

    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: auth } = await supabase.auth.getSession();
        const uid = auth.session?.user.id;
        if (!uid || !active) return;
        const { data } = await supabase
          .from("profiles")
          .select("ui_language,language")
          .eq("id", uid)
          .maybeSingle();
        const saved = (data?.ui_language ?? "") as string;
        if (saved === "de" || saved === "en" || saved === "el") {
          // Konto-Sprache gewinnt: sie steuert auch Push-Benachrichtigungen.
          if (active && saved !== stored) {
            setLangState(saved);
            try {
              window.localStorage.setItem(STORAGE_KEY, saved);
            } catch {
              /* Speicher nicht verfügbar */
            }
          }
          return;
        }
        // Noch nichts im Konto gespeichert: lokale Auswahl bzw. Profilangabe
        // dauerhaft im Konto ablegen, damit der Server sie kennt.
        const pref = (data?.language ?? "").slice(0, 2).toLowerCase();
        const next =
          stored === "de" || stored === "en" || stored === "el"
            ? stored
            : pref === "de" || pref === "en" || pref === "el"
              ? pref
              : "de";
        if (!active) return;
        setLangState(next);
        await supabase.from("profiles").update({ ui_language: next }).eq("id", uid);
      } catch {
        /* Profilsprache nicht verfügbar – Standard bleibt */
      }
    })();
    if (stored === "de" || stored === "en" || stored === "el") setLangState(stored);
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
    // Konto-Sprache mitschreiben – Push-Benachrichtigungen richten sich danach.
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: auth } = await supabase.auth.getSession();
        const uid = auth.session?.user.id;
        if (!uid) return;
        const { error } = await supabase.from("profiles").update({ ui_language: l }).eq("id", uid);
        if (error) console.error("[i18n] ui_language_save_error", error.code ?? "", error.message);
      } catch {
        /* offline – lokale Auswahl bleibt bestehen */
      }
    })();
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
