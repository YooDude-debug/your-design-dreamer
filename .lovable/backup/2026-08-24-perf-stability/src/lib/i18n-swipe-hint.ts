import type { Lang } from "@/lib/i18n-dict";

/**
 * Texte für den Erstnutzer-Hinweis zur Wisch-Navigation
 * (Feed → Globe / Feed → Slang Arena). Eigenes Wörterbuch, damit die
 * bestehenden Wörterbücher unverändert bleiben.
 */
const de = {
  title: "Swipe dich durch y-Dude",
  rightSwipe: "Von der Mitte nach rechts wischen",
  rightTarget: "Entdecke den Globus",
  leftSwipe: "Von der Mitte nach links wischen",
  leftTarget: "Entdecke die Slang Arena",
  skip: "Überspringen",
  never: "Nicht mehr anzeigen",
};

type SwipeHintDict = typeof de;

const en: SwipeHintDict = {
  title: "Swipe your way through y-Dude",
  rightSwipe: "Swipe from the centre to the right",
  rightTarget: "Explore the Globe",
  leftSwipe: "Swipe from the centre to the left",
  leftTarget: "Explore the Slang Arena",
  skip: "Skip",
  never: "Don't show again",
};

const el: SwipeHintDict = {
  title: "Κάνε swipe μέσα στο y-Dude",
  rightSwipe: "Σύρε από το κέντρο προς τα δεξιά",
  rightTarget: "Ανακάλυψε την Υδρόγειο",
  leftSwipe: "Σύρε από το κέντρο προς τα αριστερά",
  leftTarget: "Ανακάλυψε τη Slang Arena",
  skip: "Παράλειψη",
  never: "Να μην εμφανιστεί ξανά",
};

export const swipeHintTexts: Record<Lang, SwipeHintDict> = { de, en, el };
