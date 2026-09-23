/**
 * ORB Core – Informationsbereich (Domain) für Frage-Intent und Topic-Recall.
 *
 * Diese Datei enthält KEINE Gedächtnisformeln: sie ändert weder Wichtigkeit,
 * Konfidenz, Verfall, Relevanzberechnung noch die Speicherschwelle (0.35).
 * Sie liefert ausschliesslich eine kleine, deterministische Zuordnung
 * „Text → Informationsbereich“, damit ein bereits vorhandener Knoten auch bei
 * natürlicher Sprache als Recall-Kandidat gefunden werden kann.
 *
 * Bewusst klein gehalten: keine Ontologie, keine KI, keine Netzabfrage.
 */

/** Reihenfolge = Priorität für `infoDomainOf` (erster Treffer gewinnt). */
const DOMAIN_PATTERNS: [string, RegExp][] = [
  [
    "hardware",
    /\b(grafikkarte|grafikkarten|gpu|gpus|rtx|gtx|geforce|radeon|nvidia|vram|prozessor|cpu|ryzen|mainboard|arbeitsspeicher|netzteil|grafikchip)\b/i,
  ],
  ["projekte", /\b(projekt|projekte|projekts|projekten|softwareprojekt|y-?dude)\b/i],
  // P20: „Was arbeite ich?“ und die Berufsbezeichnung „Koch“ sind belegte
  // Wortlücken (P18/P19) – keine allgemeine Synonymliste.
  [
    "beruf",
    /\b(beruf|beruflich|berufliche[nrms]?|job|arbeite|arbeitest|arbeitet|arbeite(?:t|n)?\s+als|tätig\s+als|taetig\s+als|arbeitgeber|koch|köchin|koechin)\b/i,
  ],
  [
    "essen",
    /\b(esse|essen|isst|esst|lieblingsessen|ernährung|ernaehrung|gericht|gerichte|schnitzel|brokkoli|pizza|pasta|sushi|burger|koche|kochen)\b/i,
  ],
  // Nachweislich fehlende Bereiche (P14): „Wie alt bin ich?“ und „Wo wohne ich?“
  // fanden ihre gespeicherte Erinnerung nicht, weil hier kein Bereich griff.
  ["alter", /\b(alt|alter|jahre|jahren|jahr|geburtstag|geboren|jahrgang|lebensjahr)\b/i],
  [
    "wohnort",
    /\b(wohne|wohnt|wohnst|wohnen|wohnort|lebe|lebt|lebst|leben|stadt|heimatstadt|adresse|umgezogen|zuhause)\b/i,
  ],
  // P20: belegte Wortlücke – „Name“ und „heiße/heißt“ galten als verschiedene
  // Informationen, obwohl sie denselben Bereich beschreiben.
  ["name", /\b(name|namen|heiße|heisse|heißt|heisst|heißen|heissen)\b/i],
];

/**
 * Feste Leitwörter je Informationsbereich – ausschliesslich Wörter, die bereits
 * in `DOMAIN_PATTERNS` stehen. Sie dienen nur der Kandidatensuche im Inhalt
 * (begrenzte Abfrage), nicht der Bewertung. Keine Synonymdatenbank.
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  hardware: ["grafikkarte", "gpu", "rtx", "geforce", "radeon", "prozessor", "cpu"],
  projekte: ["projekt", "softwareprojekt", "dude"],
  beruf: ["beruf", "job", "arbeite", "arbeitgeber", "koch"],
  essen: ["esse", "isst", "lieblingsessen", "gericht", "koche", "ernährung"],
  alter: ["alt", "jahre", "jahr", "geburtstag", "geboren", "jahrgang"],
  wohnort: ["wohn", "lebe", "lebt", "stadt", "adresse", "umgezogen"],
  name: ["name", "heiße", "heisse", "heißt", "heisst"],
};

/**
 * Leitwörter eines Informationsbereichs (leer, wenn der Bereich unbekannt ist).
 * Reine Nachschlageliste, damit der Abrufpfad keine eigenen Wörter erfindet.
 */
export function domainKeywords(domain: string | null): string[] {
  if (!domain) return [];
  return DOMAIN_KEYWORDS[domain] ?? [];
}

/**
 * Informationsbereich eines Textes oder `null`, wenn keiner eindeutig erkennbar
 * ist. Gilt für Fragen wie für gespeicherte Inhalte – dieselbe Zuordnung auf
 * beiden Seiten, damit der Vergleich nachvollziehbar bleibt.
 */
export function infoDomainOf(text: string): string | null {
  const t = (text ?? "").toLowerCase();
  if (t.trim().length === 0) return null;
  for (const [domain, re] of DOMAIN_PATTERNS) {
    if (re.test(t)) return domain;
  }
  return null;
}

/**
 * ALLE erkennbaren Informationsbereiche eines Textes (P20).
 *
 * Eine Erinnerung kann mehrere Tatsachen enthalten („Brokkoli … Schuhgröße 42
 * … RTX 5070“). Der frühere Abbruch beim ersten Treffer machte sie nur unter
 * einem Bereich auffindbar. Es wird kein Bereich erfunden: ohne Treffer bleibt
 * die Liste leer.
 */
export function infoDomainsOf(text: string): string[] {
  const t = (text ?? "").toLowerCase();
  if (t.trim().length === 0) return [];
  const out: string[] = [];
  for (const [domain, re] of DOMAIN_PATTERNS) {
    if (re.test(t)) out.push(domain);
  }
  return out;
}

/** Fragewörter, die auf eine Wissensabfrage hindeuten. */
const QUESTION_RE =
  /(\?|\bwelche[rnms]?\b|\bwas\b|\bwie\b|\bwo\b|\bwann\b|\bwoher\b|\bwomit\b|\bwer\b|\bwhich\b|\bwhat\b)/i;

/**
 * Informationsbereich einer Benutzerfrage. Nur wenn der Text tatsächlich nach
 * etwas fragt, wird ein Bereich zurückgegeben – eine reine Aussage löst keinen
 * zusätzlichen Recall-Kandidaten aus.
 */
export function questionIntentOf(text: string): string | null {
  if (!QUESTION_RE.test(text ?? "")) return null;
  return infoDomainOf(text);
}

/**
 * Untergrenze der Ähnlichkeit, wenn Frage und Erinnerung denselben eindeutig
 * erkannten Informationsbereich haben. Liegt bewusst unter typischen echten
 * Wortüberschneidungen: wörtliche Treffer ranken weiterhin höher.
 */
export const TOPIC_AFFINITY_FLOOR = 0.12;

/**
 * Themenbasierte Affinität zwischen Frage und Erinnerung (0 oder Untergrenze).
 * Ersetzt keine Relevanzlogik – sie verhindert nur, dass ein thematisch
 * passender Knoten ohne gemeinsame Wörter komplett verworfen wird.
 */
export function topicAffinity(questionText: string, memoryContent: string): number {
  const intent = questionIntentOf(questionText);
  if (!intent) return 0;
  // P20: die Erinnerung darf mehrere Bereiche tragen. Untergrenze und
  // Relevanzformel bleiben unverändert – nur die Zuordnung ist nicht mehr
  // auf den ersten Treffer beschränkt.
  return infoDomainsOf(memoryContent).includes(intent) ? TOPIC_AFFINITY_FLOOR : 0;
}
