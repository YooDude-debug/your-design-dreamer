/**
 * Zentrale Moderationsrichtlinie für Y-Dude (browser-sicher).
 *
 * Diese Datei ist die einzige Quelle für Kategorien, Schweregrade und
 * Nutzertexte. Text-, Bild- und Audioprüfung verwenden dieselbe Liste, damit
 * keine Kategorie in einem Kanal fehlt.
 */

/** Schweregrad einer Kategorie. */
export type PolicySeverity =
  /** Darf niemals veröffentlicht werden. */
  | "prohibited"
  /** Veröffentlichung möglich, wird aber für die manuelle Prüfung markiert. */
  | "flagged";

export type PolicyCategory = {
  id: string;
  /** Deutsche Beschriftung für das Admin-Cockpit. */
  label: string;
  severity: PolicySeverity;
  /** Beschreibung, die dem Prüfmodell mitgegeben wird. */
  guidance: string;
};

/**
 * Vollständiger Kategorienkatalog. Reihenfolge = Reihenfolge im Prompt.
 * `prohibited` führt zur Sperre, `flagged` nur zur Markierung.
 */
export const POLICY_CATEGORIES: PolicyCategory[] = [
  // ---------------------------------------------------------- Extremismus
  {
    id: "nazi_propaganda",
    label: "NS-Propaganda",
    severity: "prohibited",
    guidance:
      "Nationalsozialistische Propaganda, Adolf Hitler (Fotos, Gemälde, Zeichnungen, Karikaturen, KI-Bilder, Zitate), Hakenkreuz/Swastika, SS-Runen, Reichsadler mit Hakenkreuz, Wolfsangel, Totenkopf der SS, Hitlergruß, NSDAP-Symbole, Reichskriegsflagge, Nazi-Uniformen in verherrlichendem Kontext, Codes wie 88, 18, HH, Sieg Heil, Blood and Honour, Holocaust-Leugnung.",
  },
  {
    id: "extremism",
    label: "Extremismus",
    severity: "prohibited",
    guidance:
      "Extremistische Ideologien und Symbole jeder Richtung, Aufrufe zu Extremismus, Verherrlichung extremistischer Täter, Rekrutierung.",
  },
  {
    id: "terrorism",
    label: "Terrorismus",
    severity: "prohibited",
    guidance:
      "Terrororganisationen (z. B. IS/ISIS, Al-Qaida, Hamas, Hisbollah, Taliban, rechtsterroristische Netzwerke), deren Flaggen, Logos, Propaganda, Anschlagsvideos, Märtyrer-Verherrlichung.",
  },
  // ------------------------------------------------------------- Hassrede
  {
    id: "hate_speech",
    label: "Hassrede",
    severity: "prohibited",
    guidance:
      "Aufrufe zu Hass, Entmenschlichung, menschenverachtende Inhalte, Hasssymbole, Gewaltaufrufe gegen Personen oder Gruppen.",
  },
  {
    id: "racism",
    label: "Rassismus",
    severity: "prohibited",
    guidance:
      "Rassistische Aussagen, Slurs, rassistische Darstellungen, Blackfacing, Überlegenheitsideologien, Ku-Klux-Klan.",
  },
  {
    id: "antisemitism",
    label: "Antisemitismus",
    severity: "prohibited",
    guidance:
      "Antisemitische Aussagen, Symbole, Verschwörungserzählungen, Judenstern in diffamierendem Kontext, Holocaust-Verharmlosung.",
  },
  {
    id: "religious_hate",
    label: "Religionsfeindlichkeit",
    severity: "prohibited",
    guidance:
      "Islamfeindlichkeit, Christenfeindlichkeit und andere religionsbezogene Herabwürdigung oder Hetze.",
  },
  {
    id: "xenophobia",
    label: "Fremdenfeindlichkeit",
    severity: "prohibited",
    guidance:
      "Fremdenfeindliche Hetze, Abschiebefantasien, Hetze gegen Geflüchtete oder Migranten.",
  },
  {
    id: "discrimination",
    label: "Diskriminierung",
    severity: "prohibited",
    guidance:
      "Diskriminierung wegen Herkunft, Hautfarbe, Religion, Geschlecht, Behinderung, sexueller Orientierung oder Identität.",
  },
  // ---------------------------------------------------------------- Gewalt
  {
    id: "graphic_violence",
    label: "Extreme Gewaltdarstellung",
    severity: "prohibited",
    guidance:
      "Blutige oder grausame Gewalt, Verstümmelungen, Enthauptungen, Folter, Leichen, Morddarstellungen, schwere Verletzungen, Tierquälerei.",
  },
  {
    id: "violence_glorification",
    label: "Gewaltverherrlichung",
    severity: "prohibited",
    guidance:
      "Verherrlichung von Gewalt, Attentätern, Massenmördern oder Waffengewalt, gewaltverherrlichende Symbole.",
  },
  {
    id: "violence_threat",
    label: "Gewaltandrohung",
    severity: "prohibited",
    guidance: "Drohungen gegen Personen oder Gruppen, Ankündigung von Gewalttaten.",
  },
  {
    id: "crime_incitement",
    label: "Aufruf zu Straftaten",
    severity: "prohibited",
    guidance: "Aufforderung zu Straftaten, Anleitung zu Straftaten, Verherrlichung von Straftaten.",
  },
  // ------------------------------------------------- Selbstverletzung/Suizid
  {
    id: "self_harm",
    label: "Selbstverletzung",
    severity: "prohibited",
    guidance:
      "Darstellung, Förderung, Anleitung oder Verherrlichung von Selbstverletzung, frische Schnittwunden, Ritzen.",
  },
  {
    id: "suicide",
    label: "Suizid",
    severity: "prohibited",
    guidance:
      "Aufrufe zum Suizid, Suizidanleitungen, Verherrlichung von Suizid, Ankündigung eigener Suizidabsicht (akute Selbstgefährdung).",
  },
  // ------------------------------------------------------ Mobbing/Belästigung
  {
    id: "bullying",
    label: "Mobbing",
    severity: "prohibited",
    guidance:
      "Cybermobbing, Demütigung, gezielte Herabsetzung, Spott über erkennbare Personen, Bloßstellen.",
  },
  {
    id: "harassment",
    label: "Belästigung",
    severity: "prohibited",
    guidance:
      "Gezielte Belästigung, Einschüchterung, Stalking, koordinierte Angriffe, Diffamierung, persönliche Angriffe.",
  },
  {
    id: "doxxing",
    label: "Doxxing",
    severity: "prohibited",
    guidance:
      "Veröffentlichung persönlicher Daten Dritter: Adresse, Telefonnummer, Ausweis, Bankdaten, Kennzeichen, Screenshots privater Chats mit Klarnamen.",
  },
  // ------------------------------------------------------- Sexuelle Inhalte
  {
    id: "sexual_content",
    label: "Sexuelle Inhalte",
    severity: "prohibited",
    guidance:
      "Explizite Nacktheit, sexuelle Handlungen, Pornografie, sexualisierte Posen mit Fokus auf Genitalien/Gesäß/Brüste, Fetisch-Inhalte.",
  },
  {
    id: "non_consensual_sexual",
    label: "Nicht einvernehmliche sexuelle Inhalte",
    severity: "prohibited",
    guidance:
      "Rachepornos, heimliche Aufnahmen, sexuelle Ausbeutung, Darstellung sexualisierter Gewalt.",
  },
  {
    id: "minor_safety",
    label: "Gefährdung Minderjähriger",
    severity: "prohibited",
    guidance:
      "Jede sexualisierte Darstellung Minderjähriger, Grooming, Kontaktaufnahme mit sexueller Absicht, Gefährdung von Kindern und Jugendlichen. Höchste Priorität – im Zweifel immer melden.",
  },
  // ------------------------------------------------------ Illegale Inhalte
  {
    id: "drug_trade",
    label: "Drogenhandel",
    severity: "prohibited",
    guidance: "Verkauf, Bewerbung oder Beschaffung illegaler Drogen, Preislisten, Kontaktangebote.",
  },
  {
    id: "weapon_trade",
    label: "Waffenhandel",
    severity: "prohibited",
    guidance: "Verkauf oder Bewerbung von Waffen, Munition, Sprengstoff, verbotenen Messern.",
  },
  {
    id: "fraud",
    label: "Betrug",
    severity: "prohibited",
    guidance:
      "Betrug, Scam, Fake-Gewinnspiele, Krypto-Verdopplung, Vorkasse-Tricks, Geldwäsche, gefälschte Waren, kriminelle Organisationen, illegale Dienstleistungen.",
  },
  {
    id: "phishing",
    label: "Phishing",
    severity: "prohibited",
    guidance:
      "Abfrage von Zugangsdaten, gefälschte Login-Seiten, betrügerische Links, Identitätsdiebstahl, Fake-Profile.",
  },
  // ------------------------------------------------------ Gefährliche Inhalte
  {
    id: "dangerous_instructions",
    label: "Gefährliche Anleitungen",
    severity: "prohibited",
    guidance:
      "Bombenbau, Herstellung gefährlicher Stoffe, Waffenbau, Terroranleitungen, Anleitungen zu schwerer Gewalt, gefährliche Challenges.",
  },
  // ----------------------------------------------------------------- Spam
  {
    id: "spam",
    label: "Spam",
    severity: "prohibited",
    guidance:
      "Massenwerbung, automatisierte Spam-Inhalte, sinnfreie Wiederholungen, aggressive Linkwerbung.",
  },
  // ------------------------------------------------------- Nur Markierung
  {
    id: "copyright_suspected",
    label: "Urheberrecht (Verdacht)",
    severity: "flagged",
    guidance:
      "Offensichtlich geschützte Inhalte: fremde Marken-/Firmenlogos, Filmszenen, Serien, TV-Material, Sportübertragungen, Albumcover, bekannte Comicfiguren. Nur markieren, nicht selbst entscheiden.",
  },
  {
    id: "shocking_content",
    label: "Schockierender Inhalt",
    severity: "flagged",
    guidance:
      "Verstörende, ekelerregende oder grenzwertige Inhalte ohne klaren Verstoß, Unfallbilder ohne Blut, Waffen ohne Handel.",
  },
];

export const PROHIBITED_IDS = POLICY_CATEGORIES.filter((c) => c.severity === "prohibited").map(
  (c) => c.id,
);
export const FLAGGED_IDS = POLICY_CATEGORIES.filter((c) => c.severity === "flagged").map(
  (c) => c.id,
);
export const POLICY_IDS = POLICY_CATEGORIES.map((c) => c.id);

export function severityOf(id: string): PolicySeverity | null {
  return POLICY_CATEGORIES.find((c) => c.id === id)?.severity ?? null;
}

/** Deutsche Beschriftungen für alle Richtlinien-Kategorien. */
export const POLICY_LABELS: Record<string, string> = Object.fromEntries(
  POLICY_CATEGORIES.map((c) => [c.id, c.label]),
);

/** Kategorienliste als Prompt-Abschnitt (identisch für Text, Bild und Audio). */
export function policyPromptBlock(): string {
  return POLICY_CATEGORIES.map(
    (c) => `- ${c.id} (${c.severity === "prohibited" ? "VERBOTEN" : "markieren"}): ${c.guidance}`,
  ).join("\n");
}


/**
 * Toleranzregeln der offenen Beta.
 *
 * Zweck: Fehlalarme senken, ohne eine Kategorie zu entfernen. Das Modell soll
 * zwischen "eindeutig problematisch" und "unsicher" unterscheiden und im
 * Zweifel `uncertain=true` setzen statt einen Treffer zu erfinden.
 */
export function tolerancePromptBlock(channel: ModerationChannel = "text"): string {
  const common = [
    "Entscheidungsgrundsatz (offene Beta):",
    "- Eindeutig unproblematisch \u2192 kein Treffer.",
    "- Wahrscheinlich unproblematisch \u2192 kein Treffer.",
    "- Unsicher oder nicht eindeutig \u2192 KEINEN Treffer erfinden, stattdessen uncertain=true setzen.",
    "- Nur eindeutige, klar erkennbare Verst\u00f6\u00dfe melden \u2013 dann mit hoher Konfidenz (>= 0.8).",
    "- Vergib Konfidenzen ehrlich: unter 0.5 bedeutet 'nur ein Verdacht', nicht 'Verstoss'.",
    "- Kontext z\u00e4hlt mehr als einzelne W\u00f6rter, Symbole oder Bildausschnitte.",
  ];
  const perChannel: Record<ModerationChannel, string[]> = {
    text: [
      "Erlaubt: Slang, Dialekt, Umgangssprache, Fl\u00fcche, vulg\u00e4re Sprache, Satire und Humor",
      "ohne erkennbares Ziel und ohne Bedrohung.",
    ],
    audio: [
      "Y-Dude ist eine Plattform f\u00fcr regionale Sprache. Ausdr\u00fccklich ERLAUBT und niemals",
      "melden: Schimpfw\u00f6rter ohne sch\u00e4dlichen Kontext, regionaler Slang, Dialekte,",
      "Umgangssprache, vulg\u00e4re Sprache ohne eindeutige Bedrohung, satirische oder",
      "humorvolle Aussagen, einzelne problematisch klingende W\u00f6rter ohne eindeutigen Kontext.",
      "Melde nur, wenn das Gesagte eindeutig einen schweren Verstoss darstellt.",
    ],
    image: [
      "Ausdr\u00fccklich erlaubt: Alltagssituationen, Memes, Humor, Partybilder, Sport,",
      "Strand-, Sommer- und Badebilder, Feiern, Tanzen, Tattoos, Mode, Strassenkunst.",
      "Badekleidung oder Ausschnitt allein ist kein sexueller Inhalt.",
      "Grenzf\u00e4lle nicht melden, sondern uncertain=true setzen.",
    ],
    video: [
      "Ausdr\u00fccklich erlaubt: Alltagsszenen, Humor, Sport, Party, Musik, Tanzen, Slang.",
      "Kurze, schnelle oder unscharfe Szenen nicht als Verstoss auslegen.",
      "Grenzf\u00e4lle nicht melden, sondern uncertain=true setzen.",
    ],
  };
  return [...common, "", ...perChannel[channel]].join("\n");
}

/**
 * Entscheidungsschwellen der automatischen Prüfung (Standard = Text).
 *
 * Grundsatz der offenen Beta: nur EINDEUTIGE Verstöße werden automatisch
 * gesperrt. Unsichere oder grenzwertige Treffer landen in der manuellen
 * Prüfung, statt Nutzer fälschlich zu blockieren. Die Kategorien selbst und
 * ihre Schweregrade bleiben unverändert – gelockert wird nur, ab welcher
 * Konfidenz die Automatik sperrt.
 */
export const MODERATION_THRESHOLDS = {
  /** Ab hier wird sofort gesperrt (hohe Konfidenz = eindeutiger Verstoß). */
  block: 0.8,
  /** Ab hier geht der Inhalt in die manuelle Prüfung. */
  hold: 0.45,
  /** Kategorien mit höchster Priorität sperren früher. */
  zeroTolerance: 0.5,
} as const;

/** Prüfkanal eines Inhalts. */
export type ModerationChannel = "text" | "image" | "video" | "audio";

/**
 * Kanalabhängige Schwellen. Audio ist am tolerantesten: Slang, Dialekt,
 * Umgangssprache, Flüche und derbe Sprüche sind auf Y-Dude ausdrücklich Teil
 * der Plattform. Bild und Video sind ebenfalls tolerant, weil Alltag, Memes,
 * Party, Sport und Strandbilder regelmäßig Fehlalarme ausgelöst haben.
 */
export const CHANNEL_THRESHOLDS: Record<
  ModerationChannel,
  { block: number; hold: number; zeroTolerance: number }
> = {
  text: { block: 0.8, hold: 0.45, zeroTolerance: 0.5 },
  image: { block: 0.82, hold: 0.45, zeroTolerance: 0.5 },
  video: { block: 0.82, hold: 0.45, zeroTolerance: 0.5 },
  audio: { block: 0.9, hold: 0.55, zeroTolerance: 0.6 },
};

/** Schwellen für einen Kanal (Standard = Text). */
export function thresholdsFor(channel: ModerationChannel = "text") {
  return CHANNEL_THRESHOLDS[channel] ?? MODERATION_THRESHOLDS;
}

/**
 * Kategorien mit Nulltoleranz: hier genügt ein schwacher Treffer zum Sperren,
 * weil ein Fehlalarm deutlich weniger schadet als eine Veröffentlichung.
 */
export const ZERO_TOLERANCE_IDS = [
  "nazi_propaganda",
  "terrorism",
  "minor_safety",
  "non_consensual_sexual",
  "graphic_violence",
  "suicide",
];

/** Neutrale Nutzermeldungen – ohne Details zur Moderationsentscheidung. */
export const MODERATION_MESSAGES = {
  blocked:
    "Der Upload konnte nicht veröffentlicht werden, da der Inhalt gegen unsere Community-Richtlinien verstößt.",
  review:
    "Der Upload wird von unserer Moderation geprüft und ist noch nicht veröffentlicht. Du erhältst Bescheid, sobald die Prüfung abgeschlossen ist.",
  failed: "Die Prüfung des Uploads war nicht möglich. Bitte versuche es später erneut.",
} as const;

/** Hinweis für Inhalte mit Anzeichen akuter Selbstgefährdung. */
export const CRISIS_HINT =
  "Wenn es dir gerade nicht gut geht: Die Telefonseelsorge ist rund um die Uhr kostenlos unter 0800 111 0 111 und 0800 111 0 222 erreichbar.";

/** Gesamtentscheidung der Moderation. */
export type ModerationDecisionKind = "allow" | "review" | "block";

export type ContentModerationVerdict = {
  decision: ModerationDecisionKind;
  /** Alle erkannten Kategorien (verboten + markiert). */
  labels: string[];
  /** Nur markierte Kategorien, z. B. Urheberrechtsverdacht. */
  flags: string[];
  confidence: number;
  /** Interne Begründung – wird dem Nutzer nicht angezeigt. */
  reason: string;
  /** Anzeichen akuter Selbstgefährdung. */
  crisis: boolean;
  /** Neutrale Meldung für die Oberfläche. */
  message: string;
};
