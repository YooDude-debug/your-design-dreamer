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
  /** Kurzbeschreibung fuer die Levelauswahl. */
  focus: string;
  words: GameWord[];
  /** Startgeschwindigkeit in px/s. */
  baseSpeed: number;
  /** Maximale Geschwindigkeit in px/s. */
  maxSpeed: number;
  /** Basisabstand zwischen zwei Sammelobjekten in Sekunden. */
  spawnGap: number;
  /** Anteil hoch platzierter Objekte (0..1). */
  highRatio: number;
  /** Wahrscheinlichkeit fuer ein Extra-Leben pro Spawn (0..1). */
  lifeChance: number;
  /** Anzahl richtiger Woerter fuer den Levelabschluss. */
  goal: number;
};

type Seed = {
  word: string;
  language: string;
  locale: string;
  flag: string;
  meaning: string;
};

const greeting = (s: Seed): GameWord => ({ ...s, isGreeting: true });

const decoys = (words: string[]): GameWord[] =>
  words.map((word) => ({
    word,
    language: "",
    locale: "",
    flag: "",
    meaning: "",
    isGreeting: false,
  }));

const G = {
  hallo: greeting({
    word: "Hallo",
    language: "Deutsch",
    locale: "de-DE",
    flag: "🇩🇪",
    meaning: "Hallo",
  }),
  hello: greeting({
    word: "Hello",
    language: "Englisch",
    locale: "en-GB",
    flag: "🇬🇧",
    meaning: "Hallo",
  }),
  hi: greeting({ word: "Hi", language: "Englisch", locale: "en-US", flag: "🇺🇸", meaning: "Hallo" }),
  hola: greeting({
    word: "Hola",
    language: "Spanisch",
    locale: "es-ES",
    flag: "🇪🇸",
    meaning: "Hallo",
  }),
  buenos: greeting({
    word: "Buenos días",
    language: "Spanisch",
    locale: "es-ES",
    flag: "🇪🇸",
    meaning: "Guten Morgen",
  }),
  bonjour: greeting({
    word: "Bonjour",
    language: "Französisch",
    locale: "fr-FR",
    flag: "🇫🇷",
    meaning: "Guten Tag",
  }),
  salut: greeting({
    word: "Salut",
    language: "Französisch",
    locale: "fr-FR",
    flag: "🇫🇷",
    meaning: "Hallo",
  }),
  coucou: greeting({
    word: "Coucou",
    language: "Französisch",
    locale: "fr-FR",
    flag: "🇫🇷",
    meaning: "Hallöchen",
  }),
  ciao: greeting({
    word: "Ciao",
    language: "Italienisch",
    locale: "it-IT",
    flag: "🇮🇹",
    meaning: "Hallo",
  }),
  salve: greeting({
    word: "Salve",
    language: "Italienisch",
    locale: "it-IT",
    flag: "🇮🇹",
    meaning: "Hallo",
  }),
  ola: greeting({
    word: "Olá",
    language: "Portugiesisch",
    locale: "pt-PT",
    flag: "🇵🇹",
    meaning: "Hallo",
  }),
  boaTarde: greeting({
    word: "Boa tarde",
    language: "Portugiesisch",
    locale: "pt-PT",
    flag: "🇵🇹",
    meaning: "Guten Tag",
  }),
  geia: greeting({
    word: "Γεια σου",
    language: "Griechisch",
    locale: "el-GR",
    flag: "🇬🇷",
    meaning: "Hallo",
  }),
  kalimera: greeting({
    word: "Καλημέρα",
    language: "Griechisch",
    locale: "el-GR",
    flag: "🇬🇷",
    meaning: "Guten Morgen",
  }),
  yiasas: greeting({
    word: "Γεια σας",
    language: "Griechisch",
    locale: "el-GR",
    flag: "🇬🇷",
    meaning: "Hallo (höflich)",
  }),
  hej: greeting({
    word: "Hej",
    language: "Schwedisch",
    locale: "sv-SE",
    flag: "🇸🇪",
    meaning: "Hallo",
  }),
  hei: greeting({
    word: "Hei",
    language: "Norwegisch",
    locale: "nb-NO",
    flag: "🇳🇴",
    meaning: "Hallo",
  }),
  moi: greeting({
    word: "Moi",
    language: "Finnisch",
    locale: "fi-FI",
    flag: "🇫🇮",
    meaning: "Hallo",
  }),
  ahoj: greeting({
    word: "Ahoj",
    language: "Tschechisch",
    locale: "cs-CZ",
    flag: "🇨🇿",
    meaning: "Hallo",
  }),
  konnichiwa: greeting({
    word: "こんにちは",
    language: "Japanisch",
    locale: "ja-JP",
    flag: "🇯🇵",
    meaning: "Guten Tag",
  }),
  annyeong: greeting({
    word: "안녕하세요",
    language: "Koreanisch",
    locale: "ko-KR",
    flag: "🇰🇷",
    meaning: "Hallo",
  }),
  merhaba: greeting({
    word: "Merhaba",
    language: "Türkisch",
    locale: "tr-TR",
    flag: "🇹🇷",
    meaning: "Hallo",
  }),
  privet: greeting({
    word: "Привет",
    language: "Russisch",
    locale: "ru-RU",
    flag: "🇷🇺",
    meaning: "Hallo",
  }),
  salam: greeting({
    word: "مرحبا",
    language: "Arabisch",
    locale: "ar-SA",
    flag: "🇸🇦",
    meaning: "Hallo",
  }),
  nihao: greeting({
    word: "你好",
    language: "Chinesisch",
    locale: "zh-CN",
    flag: "🇨🇳",
    meaning: "Hallo",
  }),
};

const D_BASIC = decoys([
  "Pizza",
  "Danke",
  "Computer",
  "Wasser",
  "Haus",
  "Musik",
  "Freund",
  "Sommer",
]);
const D_ROMANCE = decoys([
  "Gracias",
  "Merci",
  "Grazie",
  "Playa",
  "Fromage",
  "Gelato",
  "Ventana",
  "Sol",
]);
const D_WORLD = decoys([
  "Sushi",
  "Kimchi",
  "Καφές",
  "Teşekkür",
  "Sayonara",
  "Спасибо",
  "Bibliothek",
  "Fußball",
]);
const D_NORDIC = decoys([
  "Tack",
  "Takk",
  "Kiitos",
  "Fjord",
  "Lampe",
  "Winter",
  "Bahnhof",
  "Zucker",
]);

export const LEVELS: Record<number, GameLevel> = {
  1: {
    id: 1,
    title: "Hello World",
    category: "greetings",
    focus: "Deutsch · Englisch · Spanisch",
    words: [G.hallo, G.hello, G.hi, G.hola, G.buenos, G.ciao, ...D_BASIC],
    baseSpeed: 190,
    maxSpeed: 320,
    spawnGap: 1.25,
    highRatio: 0.4,
    lifeChance: 0.05,
    goal: 15,
  },
  2: {
    id: 2,
    title: "¡Hola!",
    category: "greetings",
    focus: "Spanisch · Portugiesisch · Italienisch",
    words: [G.hola, G.buenos, G.ola, G.boaTarde, G.ciao, G.salve, G.hello, ...D_ROMANCE],
    baseSpeed: 205,
    maxSpeed: 340,
    spawnGap: 1.15,
    highRatio: 0.45,
    lifeChance: 0.045,
    goal: 18,
  },
  3: {
    id: 3,
    title: "Bonjour!",
    category: "greetings",
    focus: "Französisch · Italienisch · Englisch",
    words: [G.bonjour, G.salut, G.coucou, G.ciao, G.salve, G.hello, G.hallo, ...D_ROMANCE],
    baseSpeed: 220,
    maxSpeed: 360,
    spawnGap: 1.08,
    highRatio: 0.5,
    lifeChance: 0.04,
    goal: 20,
  },
  4: {
    id: 4,
    title: "Γεια σου!",
    category: "greetings",
    focus: "Griechisch · Japanisch · Koreanisch",
    words: [G.geia, G.kalimera, G.yiasas, G.konnichiwa, G.annyeong, G.merhaba, ...D_WORLD],
    baseSpeed: 235,
    maxSpeed: 380,
    spawnGap: 1.0,
    highRatio: 0.55,
    lifeChance: 0.04,
    goal: 22,
  },
  5: {
    id: 5,
    title: "World Mix",
    category: "greetings",
    focus: "Internationaler Mix",
    words: [
      G.hallo,
      G.hello,
      G.hola,
      G.bonjour,
      G.ciao,
      G.ola,
      G.geia,
      G.hej,
      G.hei,
      G.moi,
      G.ahoj,
      G.konnichiwa,
      G.annyeong,
      G.privet,
      G.salam,
      G.nihao,
      ...D_NORDIC,
      ...D_WORLD,
    ],
    baseSpeed: 250,
    maxSpeed: 400,
    spawnGap: 0.95,
    highRatio: 0.55,
    lifeChance: 0.035,
    goal: 25,
  },
};

export const LEVEL_IDS = Object.keys(LEVELS)
  .map(Number)
  .sort((a, b) => a - b);

/** Alle echten Begruessungen eines Levels (Hoer-Liste, Lernhinweise). */
export function levelGreetings(level: GameLevel): GameWord[] {
  return level.words.filter((w) => w.isGreeting);
}
