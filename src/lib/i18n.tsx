import { createContext, useContext, useState, type ReactNode } from "react";

export type Lang = "de" | "en" | "el";

type Dict = {
  tagline_speak: string;
  tagline_local: string;
  tagline_connect: string;
  tagline_global: string;
  discover: string;
  feel: string;
  enter: string;
  hearTag: string;
  trending: string;
  feed: string;
  local: string;
  globalTab: string;
  trendingTab: string;
  following: string;
  cardsUi: string;
  slangTag: string;
  topRegion: string;
  progressAccents: string;
  loading: string;
  premium: string;
  stayTitle: string;
  stayDesc: string;
  emailPh: string;
  join: string;
  rights: string;
  langLabel: string;
    communitySlangTag: string;
    partnerSlangTag: string;
    communityDesc: string;
    partnerDesc: string;
    communityLabel: string;
    partnerLabel: string;
    features: { title: string; a: string; b: string }[];
};

const translations: Record<Lang, Dict> = {
  de: {
    tagline_speak: "Sprich",
    tagline_local: "Lokal.",
    tagline_connect: "Verbinde dich",
    tagline_global: "Global.",
    discover: "Entdecke Slang.",
    feel: "Fühl den Vibe.",
    enter: "Rein in den Vibe",
    hearTag: "Klick, um den SlangTag zu hören",
    trending: "Trending SlangTags",
    feed: "FEED",
    local: "Lokal",
    globalTab: "Global",
    trendingTab: "Trending",
    following: "Folge ich",
    cardsUi: "KARTEN / UI ELEMENTE",
    slangTag: "SlangTag",
    topRegion: "Top Region",
    progressAccents: "FORTSCHRITTSBALKEN / AKZENTE",
    loading: "SlangTag wird geladen...",
    premium: "Werbe SlangTag (Premium)",
    stayTitle: "Bleib im Vibe",
    stayDesc: "Erhalte Updates und werde Teil der Community.",
    emailPh: "Deine E-Mail",
    join: "Mitmachen",
    rights: "Alle Rechte vorbehalten.",
    langLabel: "Sprache",
    communitySlangTag: "COMMUNITY SLANGTAG",
    partnerSlangTag: "PARTNER SLANGTAG",
    communityDesc: "Grün = von der Community",
    partnerDesc: "Türkis = von offiziellen Partnern",
    features: [
      { title: "Lokale Stimmen", a: "Echte Menschen.", b: "Echter Slang." },
      { title: "SlangTags", a: "Kurze Sounds.", b: "Große Bedeutung." },
      { title: "Global Connect", a: "Andere Orte.", b: "Ein Vibe." },
      { title: "Bewerten & Lernen", a: "Aussprache bewerten.", b: "Wie ein Local lernen." },
    ],
  },
  en: {
    tagline_speak: "Speak",
    tagline_local: "Local.",
    tagline_connect: "Connect",
    tagline_global: "Global.",
    discover: "Discover Slang.",
    feel: "Feel the Vibe.",
    enter: "Enter the Vibe",
    hearTag: "Click to hear the SlangTag",
    trending: "Trending SlangTags",
    feed: "FEED",
    local: "Local",
    globalTab: "Global",
    trendingTab: "Trending",
    following: "Following",
    cardsUi: "CARDS / UI ELEMENTS",
    slangTag: "SlangTag",
    topRegion: "Top Region",
    progressAccents: "PROGRESS BARS / ACCENTS",
    loading: "Loading SlangTag...",
    premium: "Sponsored SlangTag (Premium)",
    stayTitle: "Stay in the Vibe",
    stayDesc: "Get updates and be part of the community.",
    emailPh: "Your email",
    join: "Join",
    rights: "All rights reserved.",
    langLabel: "Language",
    communitySlangTag: "COMMUNITY SLANGTAG",
    partnerSlangTag: "PARTNER SLANGTAG",
    communityDesc: "Green = from the community",
    partnerDesc: "Cyan = from official partners",
    features: [
      { title: "Local Voices", a: "Real people.", b: "Real slang." },
      { title: "SlangTags", a: "Short sounds.", b: "Big meaning." },
      { title: "Global Connect", a: "Different places.", b: "One vibe." },
      { title: "Rate & Learn", a: "Rate pronunciation.", b: "Learn like a local." },
    ],
  },
  el: {
    tagline_speak: "Μίλα",
    tagline_local: "Τοπικά.",
    tagline_connect: "Σύνδεσε",
    tagline_global: "Παγκόσμια.",
    discover: "Ανακάλυψε αργκό.",
    feel: "Νιώσε το vibe.",
    enter: "Μπες στο Vibe",
    hearTag: "Πάτα για να ακούσεις το SlangTag",
    trending: "Δημοφιλή SlangTags",
    feed: "ΡΟΗ",
    local: "Τοπικά",
    globalTab: "Παγκόσμια",
    trendingTab: "Δημοφιλή",
    following: "Ακολουθώ",
    cardsUi: "ΚΑΡΤΕΣ / ΣΤΟΙΧΕΙΑ UI",
    slangTag: "SlangTag",
    topRegion: "Κορυφαία Περιοχή",
    progressAccents: "ΜΠΑΡΕΣ ΠΡΟΟΔΟΥ / ΤΟΝΟΙ",
    loading: "Φόρτωση SlangTag...",
    premium: "Χορηγούμενο SlangTag (Premium)",
    stayTitle: "Μείνε στο Vibe",
    stayDesc: "Πάρε ενημερώσεις και γίνε μέλος της κοινότητας.",
    emailPh: "Το email σου",
    join: "Συμμετοχή",
    rights: "Όλα τα δικαιώματα κατοχυρωμένα.",
    langLabel: "Γλώσσα",
    communitySlangTag: "COMMUNITY SLANGTAG",
    partnerSlangTag: "PARTNER SLANGTAG",
    communityDesc: "Πράσινο = από την κοινότητα",
    partnerDesc: "Γαλάζιο = από επίσημους συνεργάτες",
    features: [
      { title: "Τοπικές Φωνές", a: "Αληθινοί άνθρωποι.", b: "Αληθινή αργκό." },
      { title: "SlangTags", a: "Σύντομοι ήχοι.", b: "Μεγάλο νόημα." },
      { title: "Global Connect", a: "Διαφορετικά μέρη.", b: "Ένα vibe." },
      { title: "Βαθμολόγησε & Μάθε", a: "Βαθμολόγησε προφορά.", b: "Μάθε σαν ντόπιος." },
    ],
  },
};

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict }>({
  lang: "de",
  setLang: () => {},
  t: translations.de,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("de");
  return <Ctx.Provider value={{ lang, setLang, t: translations[lang] }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "el", label: "Ελληνικά", flag: "🇬🇷" },
];
