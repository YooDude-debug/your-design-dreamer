/**
 * Texte der Sprachsteuerung im Chat (DE/EN/EL).
 *
 * Bewusst als eigenes Wörterbuch, damit der Messenger unabhängig vom großen
 * Hauptwörterbuch erweitert werden kann. Keine harten Texte in Komponenten.
 */

import type { TranslationLang } from "@/lib/lang-detect";

export type ChatLangDict = {
  myLanguage: string;
  partner: string;
  auto: string;
  autoShort: string;
  settingsTitle: string;
  settingsHint: string;
  openSettings: string;
  close: string;
  noTranslation: string;
  liveTranslation: string;
  on: string;
  off: string;
  liveHint: string;
};

export const CHAT_LANG_COPY: Record<TranslationLang, ChatLangDict> = {
  de: {
    myLanguage: "Meine Sprache",
    partner: "Chatpartner",
    auto: "Automatisch erkennen",
    autoShort: "Automatisch",
    settingsTitle: "Übersetzung",
    settingsHint:
      "Nachrichten werden automatisch in deine Sprache übersetzt. Das Original bleibt erhalten.",
    openSettings: "Spracheinstellungen öffnen",
    close: "Schließen",
    noTranslation: "Gleiche Sprache – keine Übersetzung",
    liveTranslation: "Live-Übersetzung",
    on: "ON",
    off: "OFF",
    liveHint: "Nur sichtbare Nachrichten werden übersetzt.",
  },
  en: {
    myLanguage: "My language",
    partner: "Chat partner",
    auto: "Detect automatically",
    autoShort: "Automatic",
    settingsTitle: "Translation",
    settingsHint:
      "Messages are translated into your language automatically. The original is always kept.",
    openSettings: "Open language settings",
    close: "Close",
    noTranslation: "Same language – no translation",
    liveTranslation: "Live translation",
    on: "ON",
    off: "OFF",
    liveHint: "Only messages currently in view are translated.",
  },
  el: {
    myLanguage: "Η γλώσσα μου",
    partner: "Συνομιλητής",
    auto: "Αυτόματη αναγνώριση",
    autoShort: "Αυτόματα",
    settingsTitle: "Μετάφραση",
    settingsHint: "Τα μηνύματα μεταφράζονται αυτόματα στη γλώσσα σου. Το αρχικό διατηρείται πάντα.",
    openSettings: "Άνοιγμα ρυθμίσεων γλώσσας",
    close: "Κλείσιμο",
    noTranslation: "Ίδια γλώσσα – χωρίς μετάφραση",
    liveTranslation: "Ζωντανή μετάφραση",
    on: "ON",
    off: "OFF",
    liveHint: "Μεταφράζονται μόνο τα ορατά μηνύματα.",
  },
};

/** Flagge + Eigenname je Sprache (kompakt für Header und Auswahl). */
export const LANG_LABEL: Record<TranslationLang, { flag: string; name: string }> = {
  de: { flag: "🇩🇪", name: "Deutsch" },
  en: { flag: "🇬🇧", name: "English" },
  el: { flag: "🇬🇷", name: "Ελληνικά" },
};

export function chatLangCopy(lang: string): ChatLangDict {
  return CHAT_LANG_COPY[
    (lang as TranslationLang) in CHAT_LANG_COPY ? (lang as TranslationLang) : "de"
  ];
}
