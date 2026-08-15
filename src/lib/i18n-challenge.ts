import type { Lang } from "@/lib/i18n-dict";

/**
 * Texte für den Slang-Challenge-Bereich (Landingpage) und den
 * Onboarding-Schritt nach der Registrierung. Eigenes Wörterbuch, damit
 * die bestehenden Wörterbücher unverändert bleiben.
 */
const de = {
  headline: "Welcher Slang ist typisch für DEINE Region?",
  sub: "Sprich ihn ein. Teile ihn. Lass andere darüber abstimmen.",
  emotion:
    "Jede Region hat ihre eigenen Wörter, Sprüche und Sounds. Zeig der Welt, wie deine Region wirklich spricht.",
  badge: "SLANG CHALLENGE",
  challengeTitle: "Erstelle deinen ersten SlangTag.",
  steps: [
    { icon: "mic", title: "Sprich deinen Slang ein" },
    { icon: "pin", title: "Zeig, woher er kommt" },
    { icon: "cup", title: "Sammle Plays & Votes" },
  ],
  cta: "JETZT MITMACHEN",
  ctaHint: "Deine Region wartet auf deinen Slang.",
  contestTitle: "Welche Region gewinnt?",
  contestExampleNote: "Beispiele – deine Region kann die erste echte sein.",
  contestLive: "Echte Einreichungen aus dem Slang Globe.",
  trendingTitle: "Gerade angesagt",
  trendingEmptyA: "Noch keiner aus deiner Region dabei?",
  trendingEmptyB: "Dann bist DU dran.",
  trendingCta: "MEINEN SLANG EINSPRECHEN",
  votes: "Votes",
  onboardTitle: "Deine erste Slang Challenge",
  onboardSub: "Welchen Slang kennt man nur bei dir?",
  onboardCta: "+ SlangTag erstellen",
  onboardSkip: "Später",
};

type ChallengeDict = typeof de;

const en: ChallengeDict = {
  headline: "Which slang is typical for YOUR region?",
  sub: "Record it. Share it. Let others vote on it.",
  emotion:
    "Every region has its own words, phrases and sounds. Show the world how your region really speaks.",
  badge: "SLANG CHALLENGE",
  challengeTitle: "Create your first SlangTag.",
  steps: [
    { icon: "mic", title: "Record your slang" },
    { icon: "pin", title: "Show where it's from" },
    { icon: "cup", title: "Collect plays & votes" },
  ],
  cta: "JOIN NOW",
  ctaHint: "Your region is waiting for your slang.",
  contestTitle: "Which region wins?",
  contestExampleNote: "Examples — your region could be the first real one.",
  contestLive: "Real submissions from the Slang Globe.",
  trendingTitle: "Trending right now",
  trendingEmptyA: "Nobody from your region yet?",
  trendingEmptyB: "Then it's YOUR turn.",
  trendingCta: "RECORD MY SLANG",
  votes: "votes",
  onboardTitle: "Your first Slang Challenge",
  onboardSub: "Which slang do only people from your area know?",
  onboardCta: "+ Create SlangTag",
  onboardSkip: "Later",
};

const el: ChallengeDict = {
  headline: "Ποια αργκό είναι τυπική για ΤΗ ΔΙΚΗ ΣΟΥ περιοχή;",
  sub: "Ηχογράφησέ την. Μοιράσου την. Άσε τους άλλους να ψηφίσουν.",
  emotion:
    "Κάθε περιοχή έχει τις δικές της λέξεις, φράσεις και ήχους. Δείξε στον κόσμο πώς μιλάει πραγματικά η περιοχή σου.",
  badge: "SLANG CHALLENGE",
  challengeTitle: "Δημιούργησε το πρώτο σου SlangTag.",
  steps: [
    { icon: "mic", title: "Ηχογράφησε την αργκό σου" },
    { icon: "pin", title: "Δείξε από πού είναι" },
    { icon: "cup", title: "Μάζεψε plays & ψήφους" },
  ],
  cta: "ΜΠΕΣ ΤΩΡΑ",
  ctaHint: "Η περιοχή σου περιμένει την αργκό σου.",
  contestTitle: "Ποια περιοχή κερδίζει;",
  contestExampleNote: "Παραδείγματα — η περιοχή σου μπορεί να είναι η πρώτη.",
  contestLive: "Πραγματικές συμμετοχές από το Slang Globe.",
  trendingTitle: "Τρέντ αυτή τη στιγμή",
  trendingEmptyA: "Κανείς από την περιοχή σου ακόμα;",
  trendingEmptyB: "Τότε είναι η σειρά ΣΟΥ.",
  trendingCta: "ΗΧΟΓΡΑΦΩ ΤΗΝ ΑΡΓΚΟ ΜΟΥ",
  votes: "ψήφοι",
  onboardTitle: "Η πρώτη σου Slang Challenge",
  onboardSub: "Ποια αργκό ξέρουν μόνο στη περιοχή σου;",
  onboardCta: "+ Δημιουργία SlangTag",
  onboardSkip: "Αργότερα",
};

export const challengeTexts: Record<Lang, ChallengeDict> = { de, en, el };

/** Beispielregionen – klar als Beispiele gekennzeichnet, keine Fake-Zahlen. */
export const EXAMPLE_REGIONS = [
  { flag: "🇩🇪", region: "Berlin" },
  { flag: "🇩🇪", region: "Hamburg" },
  { flag: "🇩🇪", region: "Köln" },
  { flag: "🇩🇪", region: "München" },
  { flag: "🇬🇷", region: "Griechenland" },
];
