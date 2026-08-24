import type { Lang } from "@/lib/i18n-dict";

/**
 * Texte für den Bereich „Y-Dude Market“ (Home, Kategorien, Artikel erstellen,
 * Artikel-Detailseite, Suche, Filter, Status).
 *
 * Regel wie im Channel-Bereich: jeder sichtbare Text existiert in de/en/el,
 * kein stiller Fallback auf Deutsch. Nutzerinhalte (Titel, Beschreibungen)
 * werden hier nicht übersetzt.
 */

const de = {
  marketTitle: "Market",
  claim: "Buy. Sell. Speak Local.",
  back: "Zurück",
  loading: "Wird geladen…",
  searchPlaceholder: "Artikel suchen…",
  allCategories: "Alle Kategorien",
  categories: "Kategorien",
  newest: "Neueste",
  results: "Ergebnisse",
  noResults: "Keine Artikel gefunden.",
  loadMore: "Mehr laden",
  loadFailed: "Market konnte nicht geladen werden.",
  notFound: "Artikel nicht gefunden.",

  // Erstellen
  createItem: "Artikel einstellen",
  createHeading: "Neuer Artikel",
  titleLabel: "Titel",
  titlePlaceholder: "Was verkaufst du?",
  descriptionLabel: "Beschreibung",
  descriptionPlaceholder: "Zustand, Details, Abholung…",
  priceLabel: "Preis (€)",
  negotiable: "Preis verhandelbar",
  freeLabel: "Zu verschenken",
  categoryLabel: "Kategorie",
  conditionLabel: "Zustand",
  deliveryLabel: "Übergabe",
  locationLabel: "Standort",
  locationPlaceholder: "Ort oder PLZ suchen…",
  useMyLocation: "Aktueller Standort",
  imagesLabel: "Bilder",
  addImages: "Bilder hinzufügen",
  imagesHint: "Bis zu 8 Bilder. Das erste Bild ist das Titelbild.",
  publish: "Veröffentlichen",
  publishing: "Wird veröffentlicht…",
  cancel: "Abbrechen",
  needTitle: "Bitte gib einen Titel ein.",
  needCategory: "Bitte wähle eine Kategorie.",
  createFailed: "Artikel konnte nicht gespeichert werden.",
  created: "Artikel ist online.",

  // Detail
  contactSeller: "Verkäufer schreiben",
  seller: "Verkäufer",
  viewsSuffix: "Aufrufe",
  favorite: "Merken",
  favorited: "Gemerkt",
  markSold: "Als verkauft markieren",
  markActive: "Wieder aktiv setzen",
  markReserved: "Als reserviert markieren",
  deleteItem: "Artikel löschen",
  deleteConfirm: "Diesen Artikel wirklich löschen?",
  deleted: "Artikel gelöscht.",
  updateFailed: "Änderung konnte nicht gespeichert werden.",
  report: "Melden",
  chatIntro: "Hi! Ich interessiere mich für",

  // Status
  statusActive: "Aktiv",
  statusReserved: "Reserviert",
  statusSold: "Verkauft",
  statusDisabled: "Deaktiviert",

  // Zustand
  condNew: "Neu",
  condLikeNew: "Wie neu",
  condGood: "Gut",
  condUsed: "Gebraucht",

  // Übergabe
  delPickup: "Abholung",
  delShipping: "Versand",
  delBoth: "Abholung & Versand",

  // Filter
  filters: "Filter",
  priceFrom: "Preis von",
  priceTo: "Preis bis",
  onlyWithImages: "Nur mit Bild",
  resetFilters: "Filter zurücksetzen",
  myItems: "Meine Artikel",
};

type MarketDict = typeof de;

const en: MarketDict = {
  marketTitle: "Market",
  claim: "Buy. Sell. Speak Local.",
  back: "Back",
  loading: "Loading…",
  searchPlaceholder: "Search items…",
  allCategories: "All categories",
  categories: "Categories",
  newest: "Newest",
  results: "Results",
  noResults: "No items found.",
  loadMore: "Load more",
  loadFailed: "Market could not be loaded.",
  notFound: "Item not found.",

  createItem: "List an item",
  createHeading: "New item",
  titleLabel: "Title",
  titlePlaceholder: "What are you selling?",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Condition, details, pickup…",
  priceLabel: "Price (€)",
  negotiable: "Price negotiable",
  freeLabel: "Free",
  categoryLabel: "Category",
  conditionLabel: "Condition",
  deliveryLabel: "Handover",
  locationLabel: "Location",
  locationPlaceholder: "Search city or postcode…",
  useMyLocation: "Current location",
  imagesLabel: "Photos",
  addImages: "Add photos",
  imagesHint: "Up to 8 photos. The first one is the cover.",
  publish: "Publish",
  publishing: "Publishing…",
  cancel: "Cancel",
  needTitle: "Please enter a title.",
  needCategory: "Please pick a category.",
  createFailed: "Item could not be saved.",
  created: "Your item is live.",

  contactSeller: "Message seller",
  seller: "Seller",
  viewsSuffix: "views",
  favorite: "Save",
  favorited: "Saved",
  markSold: "Mark as sold",
  markActive: "Set active again",
  markReserved: "Mark as reserved",
  deleteItem: "Delete item",
  deleteConfirm: "Really delete this item?",
  deleted: "Item deleted.",
  updateFailed: "Change could not be saved.",
  report: "Report",
  chatIntro: "Hi! I'm interested in",

  statusActive: "Active",
  statusReserved: "Reserved",
  statusSold: "Sold",
  statusDisabled: "Disabled",

  condNew: "New",
  condLikeNew: "Like new",
  condGood: "Good",
  condUsed: "Used",

  delPickup: "Pickup",
  delShipping: "Shipping",
  delBoth: "Pickup & shipping",

  filters: "Filters",
  priceFrom: "Price from",
  priceTo: "Price to",
  onlyWithImages: "With photo only",
  resetFilters: "Reset filters",
  myItems: "My items",
};

const el: MarketDict = {
  marketTitle: "Market",
  claim: "Buy. Sell. Speak Local.",
  back: "Πίσω",
  loading: "Φορτώνει…",
  searchPlaceholder: "Αναζήτηση αγγελιών…",
  allCategories: "Όλες οι κατηγορίες",
  categories: "Κατηγορίες",
  newest: "Νεότερα",
  results: "Αποτελέσματα",
  noResults: "Δεν βρέθηκαν αγγελίες.",
  loadMore: "Φόρτωση περισσότερων",
  loadFailed: "Το Market δεν φορτώθηκε.",
  notFound: "Η αγγελία δεν βρέθηκε.",

  createItem: "Νέα αγγελία",
  createHeading: "Νέα αγγελία",
  titleLabel: "Τίτλος",
  titlePlaceholder: "Τι πουλάς;",
  descriptionLabel: "Περιγραφή",
  descriptionPlaceholder: "Κατάσταση, λεπτομέρειες, παραλαβή…",
  priceLabel: "Τιμή (€)",
  negotiable: "Συζητήσιμη τιμή",
  freeLabel: "Δωρεάν",
  categoryLabel: "Κατηγορία",
  conditionLabel: "Κατάσταση",
  deliveryLabel: "Παράδοση",
  locationLabel: "Τοποθεσία",
  locationPlaceholder: "Πόλη ή ΤΚ…",
  useMyLocation: "Τρέχουσα τοποθεσία",
  imagesLabel: "Φωτογραφίες",
  addImages: "Προσθήκη φωτογραφιών",
  imagesHint: "Έως 8 φωτογραφίες. Η πρώτη είναι η κύρια.",
  publish: "Δημοσίευση",
  publishing: "Δημοσιεύεται…",
  cancel: "Άκυρο",
  needTitle: "Συμπλήρωσε τίτλο.",
  needCategory: "Διάλεξε κατηγορία.",
  createFailed: "Η αγγελία δεν αποθηκεύτηκε.",
  created: "Η αγγελία είναι online.",

  contactSeller: "Μήνυμα στον πωλητή",
  seller: "Πωλητής",
  viewsSuffix: "προβολές",
  favorite: "Αποθήκευση",
  favorited: "Αποθηκεύτηκε",
  markSold: "Σήμανση ως πουλημένο",
  markActive: "Ενεργό ξανά",
  markReserved: "Σήμανση ως δεσμευμένο",
  deleteItem: "Διαγραφή αγγελίας",
  deleteConfirm: "Να διαγραφεί η αγγελία;",
  deleted: "Η αγγελία διαγράφηκε.",
  updateFailed: "Η αλλαγή δεν αποθηκεύτηκε.",
  report: "Αναφορά",
  chatIntro: "Γεια! Ενδιαφέρομαι για",

  statusActive: "Ενεργό",
  statusReserved: "Δεσμευμένο",
  statusSold: "Πουλήθηκε",
  statusDisabled: "Ανενεργό",

  condNew: "Καινούριο",
  condLikeNew: "Σαν καινούριο",
  condGood: "Καλό",
  condUsed: "Χρησιμοποιημένο",

  delPickup: "Παραλαβή",
  delShipping: "Αποστολή",
  delBoth: "Παραλαβή & αποστολή",

  filters: "Φίλτρα",
  priceFrom: "Τιμή από",
  priceTo: "Τιμή έως",
  onlyWithImages: "Μόνο με φωτογραφία",
  resetFilters: "Καθαρισμός φίλτρων",
  myItems: "Οι αγγελίες μου",
};

export const marketTexts: Record<Lang, MarketDict> = { de, en, el };

/** Kategoriename in der aktiven Sprache (Slug bleibt sprachunabhängig). */
export function marketCategoryLabel(
  cat: { name: string; nameEn: string | null; nameEl: string | null },
  lang: Lang,
) {
  if (lang === "en") return cat.nameEn || cat.name;
  if (lang === "el") return cat.nameEl || cat.name;
  return cat.name;
}

/** Preis in der aktiven Sprache – 0 Cent gilt als „Zu verschenken“. */
export function formatMarketPrice(cents: number, lang: Lang) {
  if (cents <= 0) return marketTexts[lang].freeLabel;
  const locale = lang === "de" ? "de-DE" : lang === "el" ? "el-GR" : "en-GB";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
