/**
 * Y-Dude Mini-Games – zentrale Wort- und Leveldaten.
 *
 * Die Spiellogik entscheidet ausschliesslich ueber `isGreeting`, niemals ueber
 * den sichtbaren Text. Weitere Level werden durch einen zusaetzlichen Eintrag
 * in `LEVELS` ergaenzt – die Spielmechanik bleibt unveraendert.
 */

export type GameWord = {
  word: string;
  /** Sprache in Klartext (leer bei Nicht-Begruessungen). */
  language: string;
  /** BCP-47-Locale fuer die Sprachausgabe (leer bei Nicht-Begruessungen). */
  locale: string;
  /** Flaggen-Emoji fuer die Hoer-Liste. */
  flag: string;
  /** Bedeutung auf Deutsch. */
  meaning: string;
  isGreeting: boolean;
};

export type GameLevel = {
  id: number;
  title: string;
  category: string;
  words: GameWord[];
};

const GREETINGS: GameWord[] = [
  {
    word: "Hallo",
    language: "Deutsch",
    locale: "de-DE",
    flag: "🇩🇪",
    meaning: "Hallo",
    isGreeting: true,
  },
  {
    word: "Hello",
    language: "Englisch",
    locale: "en-GB",
    flag: "🇬🇧",
    meaning: "Hallo",
    isGreeting: true,
  },
  {
    word: "Hi",
    language: "Englisch",
    locale: "en-US",
    flag: "🇺🇸",
    meaning: "Hallo",
    isGreeting: true,
  },
  {
    word: "Hola",
    language: "Spanisch",
    locale: "es-ES",
    flag: "🇪🇸",
    meaning: "Hallo",
    isGreeting: true,
  },
  {
    word: "Bonjour",
    language: "Französisch",
    locale: "fr-FR",
    flag: "🇫🇷",
    meaning: "Guten Tag",
    isGreeting: true,
  },
  {
    word: "Salut",
    language: "Französisch",
    locale: "fr-FR",
    flag: "🇫🇷",
    meaning: "Hallo",
    isGreeting: true,
  },
  {
    word: "Ciao",
    language: "Italienisch",
    locale: "it-IT",
    flag: "🇮🇹",
    meaning: "Hallo",
    isGreeting: true,
  },
  {
    word: "Γεια σου",
    language: "Griechisch",
    locale: "el-GR",
    flag: "🇬🇷",
    meaning: "Hallo",
    isGreeting: true,
  },
  {
    word: "Hej",
    language: "Schwedisch",
    locale: "sv-SE",
    flag: "🇸🇪",
    meaning: "Hallo",
    isGreeting: true,
  },
  {
    word: "Ahoj",
    language: "Tschechisch",
    locale: "cs-CZ",
    flag: "🇨🇿",
    meaning: "Hallo",
    isGreeting: true,
  },
  {
    word: "Olá",
    language: "Portugiesisch",
    locale: "pt-PT",
    flag: "🇵🇹",
    meaning: "Hallo",
    isGreeting: true,
  },
  {
    word: "こんにちは",
    language: "Japanisch",
    locale: "ja-JP",
    flag: "🇯🇵",
    meaning: "Guten Tag",
    isGreeting: true,
  },
];

const DECOYS: GameWord[] = [
  "Pizza",
  "Danke",
  "Computer",
  "Wasser",
  "Haus",
  "Musik",
  "Freund",
  "Good night",
].map((word) => ({ word, language: "", locale: "", flag: "", meaning: "", isGreeting: false }));

export const LEVELS: Record<number, GameLevel> = {
  1: {
    id: 1,
    title: "Hello World",
    category: "greetings",
    words: [...GREETINGS, ...DECOYS],
  },
};

/** Alle echten Begruessungen eines Levels (Hoer-Liste, Lernhinweise). */
export function levelGreetings(level: GameLevel): GameWord[] {
  return level.words.filter((w) => w.isGreeting);
}
