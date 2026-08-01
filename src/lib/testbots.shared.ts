/** Browser-safe types & Datenpool für das Testbot-System (nur Entwicklungsmodus). */

export type TestBotSettings = {
  enabled: boolean;
  running: boolean;
  botCount: number;
  updatedAt: string;
};

export type TestBotRow = {
  id: string;
  userId: string;
  username: string;
  email: string;
  country: string;
  region: string;
  language: string;
  interests: string[];
  active: boolean;
  intervalMinutes: number;
  actions: string[];
  lastActivityAt: string | null;
  posts: number;
  comments: number;
  likes: number;
  slangTags: number;
};

export type TestBotActivitySummary = {
  posts: number;
  comments: number;
  likes: number;
  shares: number;
  slangTags: number;
  visits: number;
  follows: number;
};

export const TEST_BOT_ACTIONS = [
  "post",
  "slangtag",
  "like",
  "comment",
  "share",
  "visit",
] as const;

export type TestBotAction = (typeof TEST_BOT_ACTIONS)[number];

export const TEST_BOT_ACTION_LABELS: Record<TestBotAction, string> = {
  post: "Beiträge",
  slangtag: "SlangTags",
  like: "Likes",
  comment: "Kommentare",
  share: "Teilen",
  visit: "Profilbesuche",
};

/** Präfix für alle Bot-Benutzernamen – macht Verwechslung mit echten Nutzern unmöglich. */
export const TEST_BOT_PREFIX = "bot_";

export const TEST_BOT_POOL = [
  { name: "lina", country: "Deutschland", region: "Hamburg, DE", language: "Deutsch", interests: ["Musik", "Streetfood"] },
  { name: "deniz", country: "Deutschland", region: "Berlin, DE", language: "Deutsch", interests: ["Fußball", "Rap"] },
  { name: "mia", country: "Deutschland", region: "Köln, DE", language: "Deutsch", interests: ["Karneval", "Mode"] },
  { name: "jonas", country: "Deutschland", region: "München, DE", language: "Deutsch", interests: ["Berge", "Tech"] },
  { name: "svenja", country: "Deutschland", region: "Leipzig, DE", language: "Deutsch", interests: ["Kunst", "Techno"] },
  { name: "yannis", country: "Griechenland", region: "Athen, GR", language: "Ελληνικά", interests: ["Meer", "Kaffee"] },
  { name: "eleni", country: "Griechenland", region: "Thessaloniki, GR", language: "Ελληνικά", interests: ["Kochen", "Reisen"] },
  { name: "sam", country: "Großbritannien", region: "London, UK", language: "English", interests: ["Grime", "Sneaker"] },
  { name: "chloe", country: "Großbritannien", region: "Manchester, UK", language: "English", interests: ["Football", "Pubs"] },
  { name: "louis", country: "Frankreich", region: "Paris, FR", language: "Français", interests: ["Mode", "Bäckerei"] },
  { name: "amelie", country: "Frankreich", region: "Marseille, FR", language: "Français", interests: ["Strand", "Musik"] },
  { name: "marco", country: "Italien", region: "Rom, IT", language: "Italiano", interests: ["Pizza", "Vespa"] },
  { name: "giulia", country: "Italien", region: "Mailand, IT", language: "Italiano", interests: ["Design", "Kaffee"] },
  { name: "pablo", country: "Spanien", region: "Barcelona, ES", language: "Español", interests: ["Skate", "Tapas"] },
  { name: "lucia", country: "Spanien", region: "Sevilla, ES", language: "Español", interests: ["Flamenco", "Reisen"] },
  { name: "emre", country: "Türkei", region: "Istanbul, TR", language: "Türkçe", interests: ["Streetfood", "Musik"] },
  { name: "zeynep", country: "Türkei", region: "Izmir, TR", language: "Türkçe", interests: ["Meer", "Fotografie"] },
  { name: "noah", country: "Niederlande", region: "Amsterdam, NL", language: "Nederlands", interests: ["Fahrrad", "House"] },
  { name: "anna", country: "Österreich", region: "Wien, AT", language: "Deutsch", interests: ["Kaffeehaus", "Theater"] },
  { name: "luka", country: "Schweiz", region: "Zürich, CH", language: "Deutsch", interests: ["Snowboard", "Tech"] },
];

export const TEST_BOT_POST_TITLES = [
  "Typisch bei uns",
  "So klingt meine Stadt",
  "Kleiner Alltagsmoment",
  "Das sagt hier jeder",
  "Frisch aufgenommen",
  "Slang aus der Nachbarschaft",
  "Heute unterwegs",
  "Feierabend-Sound",
];

export const TEST_BOT_POST_TEXTS = [
  "Kurzer Testbeitrag aus meiner Region – nur zum Ausprobieren des Feeds.",
  "Diesen Ausdruck hört man hier jeden Tag.",
  "Testdaten: So würde ein echter Beitrag aussehen.",
  "Kleiner Gruß aus meiner Stadt an alle Dudes.",
  "Simulierter Beitrag mit lokalem Slang.",
];

export const TEST_BOT_COMMENTS = [
  "Stark! 🔥",
  "Das ist echt lokal 😄",
  "Krass, kannte ich noch nicht.",
  "Mega SlangTag!",
  "Bei uns sagt man das auch.",
  "Sound geht ab 🎧",
  "Direkt gespeichert.",
];

export const TEST_BOT_SLANG_WORDS = [
  "moin",
  "diggi",
  "aloha",
  "servus",
  "yalla",
  "grüezi",
  "digga",
  "eyy",
  "hallihallo",
  "boah",
];

export const TEST_BOT_HASHTAGS = ["#test", "#slang", "#lokal", "#sound", "#region"];
