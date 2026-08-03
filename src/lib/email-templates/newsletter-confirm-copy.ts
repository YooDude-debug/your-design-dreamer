/** Sprachtexte der Double-Opt-in-Mail. */
export type Lang = "de" | "en" | "el";

export const COPY: Record<Lang, Record<string, string>> = {
  de: {
    preview: "Bitte bestätige deine E-Mail-Adresse für Y-Dude",
    heading: "Fast fertig!",
    intro:
      "Du möchtest benachrichtigt werden, wenn Y-Dude startet. Bestätige dazu bitte deine E-Mail-Adresse.",
    cta: "E-Mail bestätigen",
    ttl: "Der Link ist 24 Stunden gültig. Danach kannst du die Bestätigung erneut anfordern.",
    ignore:
      "Falls du dich nicht angemeldet hast, ignoriere diese E-Mail einfach — es wird nichts gespeichert.",
    fallback: "Falls der Button nicht funktioniert, öffne diesen Link:",
  },
  en: {
    preview: "Please confirm your email address for Y-Dude",
    heading: "Almost there!",
    intro:
      "You asked to be notified when Y-Dude launches. Please confirm your email address to finish.",
    cta: "Confirm email",
    ttl: "The link is valid for 24 hours. After that you can request a new confirmation.",
    ignore: "If you didn't sign up, simply ignore this email — nothing will be stored.",
    fallback: "If the button doesn't work, open this link:",
  },
  el: {
    preview: "Επιβεβαίωσε τη διεύθυνση email σου για το Y-Dude",
    heading: "Σχεδόν έτοιμο!",
    intro: "Ζήτησες να ενημερωθείς όταν ξεκινήσει το Y-Dude. Επιβεβαίωσε τη διεύθυνση email σου.",
    cta: "Επιβεβαίωση email",
    ttl: "Ο σύνδεσμος ισχύει για 24 ώρες. Μετά μπορείς να ζητήσεις νέα επιβεβαίωση.",
    ignore: "Αν δεν έκανες εγγραφή, αγνόησε αυτό το email — δεν αποθηκεύεται τίποτα.",
    fallback: "Αν το κουμπί δεν λειτουργεί, άνοιξε αυτόν τον σύνδεσμο:",
  },
};
