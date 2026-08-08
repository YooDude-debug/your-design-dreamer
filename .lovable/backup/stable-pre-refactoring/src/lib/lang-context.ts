import { createContext, useContext } from "react";
import { FEATURES, translations, type Dict, type Lang } from "./i18n-dict";

export type LangState = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  locale: string;
  features: { title: string; a: string; b: string }[];
};

export const LangCtx = createContext<LangState>({
  lang: "de",
  setLang: () => {},
  t: translations.de,
  locale: "de-DE",
  features: FEATURES.de,
});

/** Zugriff auf Sprache, Wörterbuch und Feature-Texte. */
export const useLang = () => useContext(LangCtx);
