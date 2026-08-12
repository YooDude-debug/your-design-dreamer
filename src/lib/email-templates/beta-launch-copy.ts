/** Sprachtexte der Open-Beta-Startmail (DE/EN/EL). */
export type Lang = "de" | "en" | "el";

export const BETA_LAUNCH_COPY: Record<Lang, Record<string, string>> = {
  de: {
    preview: "Die Y-Dude Open Beta ist gestartet — jetzt Account erstellen",
    heading: "Die Open Beta ist gestartet",
    intro:
      "Du hast dich benachrichtigen lassen, sobald Y-Dude startet. Die offene Beta-Phase läuft jetzt und die Registrierung ist offiziell geöffnet.",
    concept:
      "Y-Dude ist das soziale Netzwerk für echte Sprache: SlangTags sind kurze Audioaufnahmen, die du direkt auf Bildern platzierst — hörbarer Slang statt stiller Hashtags.",
    cta: "Jetzt Y-Dude Account erstellen",
    fallback: "Falls der Button nicht funktioniert, öffne diesen Link:",
    note: "Du erhältst diese E-Mail einmalig, weil du dich für die Startbenachrichtigung angemeldet hast.",
  },
  en: {
    preview: "The Y-Dude open beta is live — create your account",
    heading: "The open beta is live",
    intro:
      "You asked to be notified when Y-Dude launches. The open beta phase has started and registration is now officially open.",
    concept:
      "Y-Dude is the social network for real language: SlangTags are short audio clips you place right on images — audible slang instead of silent hashtags.",
    cta: "Create your Y-Dude account",
    fallback: "If the button doesn't work, open this link:",
    note: "You are receiving this one-time email because you signed up for the launch notification.",
  },
  el: {
    preview: "Η open beta του Y-Dude ξεκίνησε — δημιούργησε λογαριασμό",
    heading: "Η open beta ξεκίνησε",
    intro:
      "Ζήτησες να ενημερωθείς όταν ξεκινήσει το Y-Dude. Η φάση open beta ξεκίνησε και οι εγγραφές είναι πλέον ανοιχτές.",
    concept:
      "Το Y-Dude είναι το κοινωνικό δίκτυο της αληθινής γλώσσας: τα SlangTags είναι σύντομα ηχητικά κλιπ που τοποθετείς πάνω σε εικόνες — slang που ακούγεται.",
    cta: "Δημιούργησε λογαριασμό Y-Dude",
    fallback: "Αν το κουμπί δεν λειτουργεί, άνοιξε αυτόν τον σύνδεσμο:",
    note: "Λαμβάνεις αυτό το email μία φορά, επειδή ζήτησες ενημέρωση για την έναρξη.",
  },
};
