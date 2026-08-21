import type { Lang } from "@/lib/i18n-dict";

/**
 * Texte für die SlangTag-Reihenfolge (Playlist-Zone, Schloss, Play All).
 * Eigenes Wörterbuch, damit die bestehenden Wörterbücher unverändert bleiben.
 */
const de = {
  order: "Reihenfolge",
  hint: "Ziehen zum Sortieren",
  playAll: "Alle abspielen",
  stop: "Stopp",
  lockedTitle: "Reihenfolge festgelegt",
  unlockedTitle: "Reihenfolge frei",
  lockedHint: "Nur du bestimmst die Abspielreihenfolge.",
  unlockedHint: "Andere dürfen für sich neu sortieren.",
  viewerLocked: "Reihenfolge vom Ersteller festgelegt",
  reset: "Ursprüngliche Reihenfolge",
};

type OrderDict = typeof de;

const en: OrderDict = {
  order: "Order",
  hint: "Drag to sort",
  playAll: "Play all",
  stop: "Stop",
  lockedTitle: "Order locked",
  unlockedTitle: "Order open",
  lockedHint: "Only you decide the playback order.",
  unlockedHint: "Others may re-sort it for themselves.",
  viewerLocked: "Order set by the creator",
  reset: "Original order",
};

const el: OrderDict = {
  order: "Σειρά",
  hint: "Σύρε για ταξινόμηση",
  playAll: "Αναπαραγωγή όλων",
  stop: "Στοπ",
  lockedTitle: "Κλειδωμένη σειρά",
  unlockedTitle: "Ανοιχτή σειρά",
  lockedHint: "Μόνο εσύ ορίζεις τη σειρά αναπαραγωγής.",
  unlockedHint: "Άλλοι μπορούν να την αλλάξουν για τους ίδιους.",
  viewerLocked: "Η σειρά ορίστηκε από τον δημιουργό",
  reset: "Αρχική σειρά",
};

export const slangTagOrderTexts: Record<Lang, OrderDict> = { de, en, el };
