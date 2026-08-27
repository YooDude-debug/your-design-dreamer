/**
 * Y-Dude Market – zentrale Such-/Matching-Schicht (Phase 3).
 *
 * Diese Datei ist bewusst frei von Abhängigkeiten (kein Supabase, kein React):
 * Browser und Server benutzen exakt dieselben Regeln.
 *
 * Aufbau:
 *   Text  →  parseMarketQuery()  →  strukturierte Query  →  Postgres-Suche  →  scoreItem()
 *
 * Das Parsen ist regelbasiert (Regex, Normalisierung, Synonyme, Einheiten) und
 * benötigt keine KI. Ein späterer KI-Parser kann dieselbe `ParsedMarketQuery`
 * liefern; Suche und Ranking bleiben dann unverändert.
 */

/* --------------------------------- Typen ------------------------------------ */

export type MarketDeliveryFilter = "pickup" | "shipping";
export type MarketConditionFilter = "new" | "like_new" | "good" | "used";

/** Ein erkannter Filter – in der Suchleiste als entfernbarer Chip sichtbar. */
export type ParsedChipKind =
  | "priceMin"
  | "priceMax"
  | "inch"
  | "cm"
  | "kg"
  | "storage"
  | "size"
  | "color"
  | "condition"
  | "delivery"
  | "place"
  | "postalCode"
  | "radius";

export type ParsedChip = { kind: ParsedChipKind; label: string };

export type ParsedMarketQuery = {
  /** Ursprüngliche Eingabe (unverändert). */
  raw: string;
  /** Freitext für die Volltextsuche (Produkt + nicht erkannte Wörter). */
  text: string;
  /** Einzelne Suchwörter des Freitexts. */
  terms: string[];
  /** Zusätzliche Suchwörter aus der Synonymtabelle (schwächeres Signal). */
  synonyms: string[];
  priceMinCents: number | null;
  priceMaxCents: number | null;
  inch: number | null;
  cm: number | null;
  kg: number | null;
  /** Speichergröße in GB (TB wird umgerechnet). */
  storageGb: number | null;
  /** Konfektions-/Schuhgröße (z. B. "44", "XL"). */
  size: string | null;
  color: string | null;
  condition: MarketConditionFilter | null;
  delivery: MarketDeliveryFilter | null;
  place: string | null;
  postalCode: string | null;
  radiusKm: number | null;
  /** Sichtbare, entfernbare Filter. */
  chips: ParsedChip[];
};

/** Leere Query – Ausgangspunkt und Fallback, falls nichts erkannt wird. */
export function emptyMarketQuery(raw = ""): ParsedMarketQuery {
  return {
    raw,
    text: raw.trim(),
    terms: [],
    synonyms: [],
    priceMinCents: null,
    priceMaxCents: null,
    inch: null,
    cm: null,
    kg: null,
    storageGb: null,
    size: null,
    color: null,
    condition: null,
    delivery: null,
    place: null,
    postalCode: null,
    radiusKm: null,
    chips: [],
  };
}

/* ------------------------------- Synonyme ------------------------------------ */

/**
 * Zentrale Synonymstruktur (de/en/el). Jede Gruppe wird beidseitig aufgelöst:
 * ein Wort der Gruppe zieht die übrigen Wörter als schwächeres Suchsignal nach.
 * Bewusst kompakt gehalten – erweiterbar an genau dieser Stelle.
 */
export const MARKET_SYNONYMS: string[][] = [
  ["handy", "smartphone", "mobiltelefon", "phone", "κινητό"],
  ["fahrrad", "bike", "mtb", "mountainbike", "rad", "ποδήλατο"],
  ["playstation", "ps", "ps4", "ps5", "konsole", "console"],
  ["laptop", "notebook", "macbook", "ultrabook"],
  ["fernseher", "tv", "smart-tv", "television", "τηλεόραση"],
  ["sofa", "couch", "kanapee", "καναπές"],
  ["auto", "pkw", "wagen", "car", "αυτοκίνητο"],
  ["schuhe", "sneaker", "turnschuhe", "shoes", "παπούτσια"],
  ["kühlschrank", "kuehlschrank", "fridge", "ψυγείο"],
  ["waschmaschine", "washer", "πλυντήριο"],
  ["kinderwagen", "buggy", "stroller"],
  ["schrank", "kommode", "regal", "wardrobe"],
  ["kopfhörer", "kopfhoerer", "headphones", "airpods", "ακουστικά"],
  ["tablet", "ipad"],
  ["kamera", "camera", "dslr", "spiegelreflex"],
  ["gitarre", "guitar", "κιθάρα"],
];

const SYNONYM_INDEX: Map<string, string[]> = (() => {
  const index = new Map<string, string[]>();
  for (const group of MARKET_SYNONYMS) {
    for (const word of group) {
      index.set(
        word,
        group.filter((w) => w !== word),
      );
    }
  }
  return index;
})();

/** Synonyme zu bereits normalisierten Suchwörtern (max. 6 zusätzliche Wörter). */
export function synonymsFor(terms: string[]): string[] {
  const out = new Set<string>();
  for (const term of terms) {
    for (const syn of SYNONYM_INDEX.get(term) ?? []) out.add(syn);
    if (out.size >= 6) break;
  }
  for (const term of terms) out.delete(term);
  return Array.from(out).slice(0, 6);
}

/* -------------------------------- Wortlisten --------------------------------- */

const STOP_WORDS = new Set([
  "ich",
  "suche",
  "gesucht",
  "suchen",
  "brauche",
  "kaufe",
  "kaufen",
  "hätte",
  "hatte",
  "gerne",
  "bitte",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "und",
  "oder",
  "mit",
  "ohne",
  "für",
  "fuer",
  "von",
  "vom",
  "zum",
  "zur",
  "im",
  "in",
  "am",
  "an",
  "auf",
  "bis",
  "max",
  "maximal",
  "unter",
  "über",
  "ueber",
  "ab",
  "circa",
  "ca",
  "etwa",
  "umkreis",
  "umgebung",
  "nähe",
  "naehe",
  "near",
  "around",
  "looking",
  "for",
  "want",
  "buy",
  "the",
  "and",
  "with",
  "under",
  "max",
  "up",
  "to",
  "cheap",
  "günstig",
  "guenstig",
  "ψάχνω",
  "αγοράσω",
  "ζητώ",
  "για",
  "ένα",
  "μια",
  "έως",
  "κοντά",
  "με",
]);

const COLORS: Record<string, string> = {
  schwarz: "schwarz",
  black: "schwarz",
  μαύρο: "schwarz",
  weiß: "weiß",
  weiss: "weiß",
  white: "weiß",
  λευκό: "weiß",
  rot: "rot",
  red: "rot",
  κόκκινο: "rot",
  blau: "blau",
  blue: "blau",
  μπλε: "blau",
  grün: "grün",
  gruen: "grün",
  green: "grün",
  πράσινο: "grün",
  gelb: "gelb",
  yellow: "gelb",
  grau: "grau",
  gray: "grau",
  grey: "grau",
  silber: "silber",
  silver: "silber",
  gold: "gold",
  rosa: "rosa",
  pink: "rosa",
  braun: "braun",
  brown: "braun",
  beige: "beige",
};

const CONDITIONS: { value: MarketConditionFilter; words: string[] }[] = [
  { value: "new", words: ["neu", "neuwertig ovp", "new", "brandneu", "ungeöffnet", "καινούριο"] },
  { value: "like_new", words: ["wie neu", "neuwertig", "like new", "σαν καινούριο"] },
  { value: "good", words: ["guter zustand", "gut erhalten", "good condition"] },
  { value: "used", words: ["gebraucht", "used", "second hand", "μεταχειρισμένο"] },
];

const PICKUP_WORDS = ["abholung", "abzuholen", "selbstabholung", "pickup", "παραλαβή"];
const SHIPPING_WORDS = ["versand", "verschicken", "shipping", "post", "αποστολή"];

const SIZE_WORDS = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl"];

/** Diakritika entfernen und Kleinschreibung – Basis für alle Regeln. */
export function normalizeMarketText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function num(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

/* --------------------------------- Parser ------------------------------------ */

/**
 * Regelbasiertes Verstehen einer Sucheingabe.
 *
 * Fehlertolerant: Jede Regel ist optional. Was nicht erkannt wird, bleibt im
 * Freitext – eine Suche schlägt niemals fehl, nur weil ein Satzteil unbekannt
 * ist.
 */
export function parseMarketQuery(input: string): ParsedMarketQuery {
  const out = emptyMarketQuery(input);
  const raw = input ?? "";
  if (!raw.trim()) return out;

  // Arbeitskopie: erkannte Bestandteile werden hier entfernt.
  let rest = ` ${normalizeMarketText(raw)} `;
  const chips: ParsedChip[] = [];
  const take = (re: RegExp, handler: (match: RegExpMatchArray) => boolean) => {
    const match = rest.match(re);
    if (!match) return;
    if (handler(match)) rest = rest.replace(match[0], " ");
  };

  const money = "(?:e|eur|euro|€)";

  // Preisspanne: "von 100 bis 300 euro" / "100 - 300 €"
  take(
    new RegExp(
      `(?:von\\s*)?(\\d[\\d.,]*)\\s*(?:${money})?\\s*(?:-|bis|to|έως)\\s*(\\d[\\d.,]*)\\s*${money}`,
    ),
    (m) => {
      const a = num(m[1]!);
      const b = num(m[2]!);
      if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return false;
      out.priceMinCents = Math.round(a * 100);
      out.priceMaxCents = Math.round(b * 100);
      chips.push({ kind: "priceMin", label: `≥ ${a} €` });
      chips.push({ kind: "priceMax", label: `≤ ${b} €` });
      return true;
    },
  );

  // Preisobergrenze: "bis 300 €", "unter 600 euro", "maximal 400 €", "max 300"
  if (out.priceMaxCents === null) {
    take(
      new RegExp(
        `(?:bis|unter|max\\.?|maximal|under|up\\s*to|εως|έως|μεχρι|μέχρι)\\s*(\\d[\\d.,]*)\\s*${money}?`,
      ),
      (m) => {
        const v = num(m[1]!);
        if (!Number.isFinite(v) || v <= 0) return false;
        out.priceMaxCents = Math.round(v * 100);
        chips.push({ kind: "priceMax", label: `≤ ${v} €` });
        return true;
      },
    );
  }

  // Preisuntergrenze: "ab 100 €"
  take(new RegExp(`(?:ab|from|απο|από)\\s*(\\d[\\d.,]*)\\s*${money}`), (m) => {
    const v = num(m[1]!);
    if (!Number.isFinite(v)) return false;
    out.priceMinCents = Math.round(v * 100);
    chips.push({ kind: "priceMin", label: `≥ ${v} €` });
    return true;
  });

  // Nackter Preis mit Währung ohne Vergleichswort: "300 euro" → Obergrenze.
  if (out.priceMaxCents === null && out.priceMinCents === null) {
    take(new RegExp(`(\\d[\\d.,]*)\\s*${money}\\b`), (m) => {
      const v = num(m[1]!);
      if (!Number.isFinite(v) || v <= 0) return false;
      out.priceMaxCents = Math.round(v * 100);
      chips.push({ kind: "priceMax", label: `≤ ${v} €` });
      return true;
    });
  }

  // Radius: "im umkreis von 20 km", "20 km", "innerhalb 5km"
  take(/(\d{1,3})\s*(?:km|kilometer|χλμ)\b/, (m) => {
    const v = Number(m[1]);
    if (!Number.isFinite(v) || v <= 0) return false;
    out.radiusKm = Math.min(500, v);
    chips.push({ kind: "radius", label: `${out.radiusKm} km` });
    return true;
  });

  // Zoll: "29 zoll", '16"', "27 inch"
  take(/(\d{1,3}(?:[.,]\d)?)\s*(?:zoll|inch|")/, (m) => {
    const v = num(m[1]!);
    if (!Number.isFinite(v)) return false;
    out.inch = v;
    chips.push({ kind: "inch", label: `${v} Zoll` });
    return true;
  });

  // Speicher: "256 gb", "1 tb"
  take(/(\d{1,4})\s*(gb|tb)\b/, (m) => {
    const v = Number(m[1]);
    if (!Number.isFinite(v)) return false;
    out.storageGb = m[2] === "tb" ? v * 1024 : v;
    chips.push({ kind: "storage", label: `${v} ${m[2]!.toUpperCase()}` });
    return true;
  });

  // Maße / Gewicht
  take(/(\d{1,4}(?:[.,]\d+)?)\s*cm\b/, (m) => {
    const v = num(m[1]!);
    if (!Number.isFinite(v)) return false;
    out.cm = v;
    chips.push({ kind: "cm", label: `${v} cm` });
    return true;
  });
  take(/(\d{1,4}(?:[.,]\d+)?)\s*kg\b/, (m) => {
    const v = num(m[1]!);
    if (!Number.isFinite(v)) return false;
    out.kg = v;
    chips.push({ kind: "kg", label: `${v} kg` });
    return true;
  });

  // Größe: "größe 44", "size xl"
  take(/(?:grosse|groesse|size|νουμερο|νούμερο)\s*([a-z]{1,4}|\d{1,3})/, (m) => {
    const v = m[1]!;
    if (!/^\d{1,3}$/.test(v) && !SIZE_WORDS.includes(v)) return false;
    out.size = v.toUpperCase();
    chips.push({ kind: "size", label: `Gr. ${out.size}` });
    return true;
  });

  // PLZ (deutsch, 5-stellig) – nur wenn eigenständiges Wort.
  take(/\b(\d{5})\b/, (m) => {
    out.postalCode = m[1]!;
    chips.push({ kind: "postalCode", label: m[1]! });
    return true;
  });

  // Ort: "in Berlin", "aus Köln", "σε Αθήνα"
  take(/\b(?:in|aus|bei|near|σε)\s+([a-zäöüß][\wäöüß-]{2,30})\b/, (m) => {
    const word = m[1]!;
    if (STOP_WORDS.has(word)) return false;
    // Der Ort wird aus dem Originaltext übernommen (Groß-/Kleinschreibung).
    const original = raw.match(new RegExp(`\\b${word}\\b`, "i"));
    out.place = (original?.[0] ?? word).replace(/^\w/, (c) => c.toUpperCase());
    chips.push({ kind: "place", label: out.place });
    return true;
  });

  // Zustand
  for (const entry of CONDITIONS) {
    const hit = entry.words.find((w) => rest.includes(` ${normalizeMarketText(w)}`));
    if (hit) {
      out.condition = entry.value;
      chips.push({ kind: "condition", label: hit });
      rest = rest.replace(normalizeMarketText(hit), " ");
      break;
    }
  }

  // Übergabe
  if (PICKUP_WORDS.some((w) => rest.includes(normalizeMarketText(w)))) {
    out.delivery = "pickup";
    chips.push({ kind: "delivery", label: "Abholung" });
    for (const w of PICKUP_WORDS) rest = rest.replace(normalizeMarketText(w), " ");
  } else if (SHIPPING_WORDS.some((w) => rest.includes(normalizeMarketText(w)))) {
    out.delivery = "shipping";
    chips.push({ kind: "delivery", label: "Versand" });
    for (const w of SHIPPING_WORDS) rest = rest.replace(normalizeMarketText(w), " ");
  }

  // Restwörter → Freitext (Stoppwörter fliegen raus, Farbe wird notiert).
  const words = rest
    .replace(/[^\p{L}\p{N}\s+]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const terms: string[] = [];
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    const color = COLORS[word];
    if (color && !out.color) {
      out.color = color;
      chips.push({ kind: "color", label: color });
      continue;
    }
    if (word.length < 2) continue;
    if (terms.includes(word)) continue;
    terms.push(word);
    if (terms.length >= 8) break;
  }

  out.terms = terms;
  out.synonyms = synonymsFor(terms);
  out.text = terms.join(" ");
  out.chips = chips;
  return out;
}

/** Filter-Chip wieder entfernen (Suche bleibt verständlich und korrigierbar). */
export function removeChip(query: ParsedMarketQuery, kind: ParsedChipKind): ParsedMarketQuery {
  const next: ParsedMarketQuery = { ...query, chips: query.chips.filter((c) => c.kind !== kind) };
  switch (kind) {
    case "priceMin":
      next.priceMinCents = null;
      break;
    case "priceMax":
      next.priceMaxCents = null;
      break;
    case "inch":
      next.inch = null;
      break;
    case "cm":
      next.cm = null;
      break;
    case "kg":
      next.kg = null;
      break;
    case "storage":
      next.storageGb = null;
      break;
    case "size":
      next.size = null;
      break;
    case "color":
      next.color = null;
      break;
    case "condition":
      next.condition = null;
      break;
    case "delivery":
      next.delivery = null;
      break;
    case "place":
      next.place = null;
      break;
    case "postalCode":
      next.postalCode = null;
      break;
    case "radius":
      next.radiusKm = null;
      break;
  }
  return next;
}

/** Kurzbeschreibung einer Suche (Label für gespeicherte Suchen). */
export function describeMarketQuery(query: ParsedMarketQuery): string {
  const parts = [query.text.trim() || query.raw.trim()];
  for (const chip of query.chips) parts.push(chip.label);
  return parts.filter(Boolean).join(" · ").slice(0, 120) || "Suche";
}

/* --------------------------------- Geo --------------------------------------- */

const EARTH_RADIUS_KM = 6371;

/** Entfernung zweier Punkte in Kilometern. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Grobes Rechteck um einen Punkt – als Datenbank-Vorfilter, damit Haversine
 * nur noch für die Kandidaten läuft (nie über die gesamte Tabelle).
 */
export function boundingBox(lat: number, lon: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const cos = Math.max(0.05, Math.cos((lat * Math.PI) / 180));
  const dLon = radiusKm / (111.32 * cos);
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  };
}

/** Datenschutz: Entfernung nur ungefähr anzeigen. */
export function roughDistanceKm(km: number): number {
  if (km < 1) return Math.round(km * 10) / 10;
  if (km < 10) return Math.round(km * 10) / 10;
  return Math.round(km);
}

/* -------------------------------- Ranking ------------------------------------ */

/**
 * Zentrale Gewichtung. Relevanz zuerst: Text und Kategorie wiegen deutlich
 * schwerer als Entfernung, Preisnähe oder Frische. Alle Bereiche (Suche,
 * ähnliche Artikel, Channel-Matching, gespeicherte Suchen) verwenden genau
 * diese Zahlen.
 */
export const MARKET_WEIGHTS = {
  titleTerm: 12,
  descriptionTerm: 4,
  synonymTerm: 3,
  category: 14,
  attribute: 6,
  slangTag: 5,
  price: 6,
  distance: 8,
  freshness: 4,
  /**
   * Hervorhebung (bezahlte Promotion). Bewusst kleiner als Text- und
   * Kategorietreffer: ein hervorgehobener Artikel steigt innerhalb passender
   * Ergebnisse auf, verdrängt aber nie einen klar relevanteren Treffer.
   */
  promoted: 10,
} as const;

export type ScoreItemInput = {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  priceCents: number;
  createdAt: number;
  distanceKm?: number | null;
  /** Normalisierte SlangTag-Namen des Artikels. */
  slangTags?: string[];
  /** Aktive Hervorhebung (Zeitstempel in ms) – null, wenn nicht hervorgehoben. */
  promotedUntil?: number | null;
};

export type ScoreContext = {
  query: ParsedMarketQuery;
  /** Optional erwartete Kategorie (z. B. bei „ähnliche Artikel“). */
  categoryId?: string | null;
  /** Suchradius: bestimmt, wie stark Entfernung überhaupt wirken darf. */
  radiusKm?: number | null;
  /** Referenzpreis für Preisähnlichkeit (ähnliche Artikel). */
  referencePriceCents?: number | null;
  now?: number;
};

/**
 * Relevanzwert eines Artikels. Reine Funktion – identisch verwendbar für
 * Suche, ähnliche Artikel und Channel-Matching.
 */
export function scoreItem(item: ScoreItemInput, ctx: ScoreContext): number {
  const q = ctx.query;
  const title = normalizeMarketText(item.title);
  const description = normalizeMarketText(item.description ?? "");
  let score = 0;

  for (const term of q.terms) {
    if (title.includes(term)) score += MARKET_WEIGHTS.titleTerm;
    else if (description.includes(term)) score += MARKET_WEIGHTS.descriptionTerm;
  }
  for (const syn of q.synonyms) {
    if (title.includes(syn) || description.includes(syn)) score += MARKET_WEIGHTS.synonymTerm;
  }

  if (ctx.categoryId && item.categoryId && ctx.categoryId === item.categoryId) {
    score += MARKET_WEIGHTS.category;
  }

  // Attribute (Zoll, Speicher, Größe, Farbe) zählen als Zusatzsignal.
  const haystack = `${title} ${description}`;
  const attributes: string[] = [];
  if (q.inch !== null) attributes.push(String(q.inch));
  if (q.storageGb !== null)
    attributes.push(String(q.storageGb >= 1024 ? q.storageGb / 1024 : q.storageGb));
  if (q.size) attributes.push(q.size.toLowerCase());
  if (q.color) attributes.push(normalizeMarketText(q.color));
  for (const attr of attributes) {
    if (haystack.includes(attr)) score += MARKET_WEIGHTS.attribute;
  }

  // SlangTags: zusätzliches Signal, nie alleiniger Grund für einen Treffer.
  if (item.slangTags?.length) {
    const hit = item.slangTags.some((tag) =>
      q.terms.some((term) => tag.includes(term) || term.includes(tag)),
    );
    if (hit && score > 0) score += MARKET_WEIGHTS.slangTag;
  }

  // Preis: Nähe zur Obergrenze bzw. zum Referenzpreis.
  const reference = ctx.referencePriceCents ?? null;
  if (reference !== null && reference > 0) {
    const ratio = Math.abs(item.priceCents - reference) / reference;
    if (ratio <= 0.5) score += MARKET_WEIGHTS.price * (1 - ratio / 0.5);
  } else if (q.priceMaxCents !== null && q.priceMaxCents > 0) {
    if (item.priceCents <= q.priceMaxCents) {
      score +=
        MARKET_WEIGHTS.price * (item.priceCents / q.priceMaxCents) * 0.5 +
        MARKET_WEIGHTS.price * 0.5;
    }
  }

  // Entfernung: mittleres Gewicht, wirkt nur bei bekanntem Abstand.
  if (item.distanceKm !== null && item.distanceKm !== undefined) {
    const radius = ctx.radiusKm && ctx.radiusKm > 0 ? ctx.radiusKm : 50;
    const near = Math.max(0, 1 - item.distanceKm / radius);
    score += MARKET_WEIGHTS.distance * near;
  }

  // Frische: geringes Gewicht, 14 Tage Halbwertszeit.
  const now = ctx.now ?? Date.now();
  const ageDays = Math.max(0, (now - item.createdAt) / 86_400_000);
  score += MARKET_WEIGHTS.freshness * Math.exp(-ageDays / 14);

  score += promotionBoost(score, item.promotedUntil ?? null, q.terms.length > 0, now);

  return score;
}

/**
 * Kontrollierter Promotion-Boost.
 *
 * Regeln (bewusst konservativ):
 *  - wirkt nur bei aktiver, nicht abgeschalteter Hervorhebung,
 *  - bei einer Textsuche nur, wenn der Artikel ohnehin relevant ist
 *    (Score > 0) – sonst könnten hervorgehobene Artikel unpassende
 *    Ergebnisse dominieren,
 *  - der Zuschlag ist nach oben begrenzt (nie mehr als ein Kategorietreffer).
 */
export function promotionBoost(
  baseScore: number,
  promotedUntil: number | null,
  hasQueryTerms: boolean,
  now = Date.now(),
): number {
  if (!promotedUntil || promotedUntil <= now) return 0;
  if (hasQueryTerms && baseScore <= 0) return 0;
  return MARKET_WEIGHTS.promoted;
}

/** Doppelte Artikel-IDs zentral vermeiden (Ergebnisbereiche überschneiden sich nie). */
export function dedupeById<T extends { id: string }>(items: T[], seen: Set<string>): T[] {
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/** Ergebnisgrenzen (Performance): zentral, nicht über Komponenten verstreut. */
export const MARKET_LIMITS = {
  items: 20,
  channels: 5,
  slangTags: 10,
  similar: 6,
  /** Kandidaten, die vor dem Ranking aus der Datenbank geholt werden. */
  candidates: 120,
  /** Hoechstens so viele hervorgehobene Artikel je Ergebnisseite. */
  promotedPerPage: 3,
  /** Hervorgehobene Artikel auf der Market-Startseite. */
  featured: 8,
} as const;
