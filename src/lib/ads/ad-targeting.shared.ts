/**
 * Werbe-Targeting (geteilt zwischen Server und Client).
 *
 * Trennt bewusst drei Ebenen:
 *   1. Einstellung  – was der Nutzer (oder spaeter die Werbe-API) waehlt
 *   2. Filterung    – `filterAdEntries()` schraenkt den Werbepool ein
 *   3. Ausspielung  – der bestehende Werbealgorithmus arbeitet unveraendert
 *                     weiter, nur eben auf dem eingeschraenkten Pool.
 *
 * Regel: leerer Filter = keine Einschraenkung (voller Algorithmus).
 *        gesetzter Filter = ausschliesslich die erlaubten Werte.
 *
 * Die Struktur ist API-fertig: `allowed_categories: []` bzw.
 * `allowed_categories: ["travel", "gastronomy"]` lassen sich direkt
 * auf `AdTargeting.allowedCategories` abbilden. Weitere Dimensionen
 * (Region, Sprache, Zielgruppe, Werbetyp, Kampagnenstatus) sind bereits
 * vorgesehen und folgen derselben Regel.
 */

/** Ein Werbemittel aus Sicht des Targetings (Katalog & Demo-Ads erfuellen das). */
export type TargetableAd = {
  id: string;
  /** Kategorie-Slugs des Werbemittels. Leer = unkategorisiert/universell. */
  filters?: readonly string[];
  /** Land/Region ("*" = ueberall). */
  regionCode?: string;
  language?: string;
  audience?: string;
  kind?: string;
  campaignStatus?: string;
};

/** Erlaubte Auswahl. Jedes leere Feld bedeutet: keine Einschraenkung. */
export type AdTargeting = {
  allowedCategories: string[];
  allowedRegions: string[];
  allowedLanguages: string[];
  allowedAudiences: string[];
  allowedKinds: string[];
  allowedCampaignStatuses: string[];
};

/** Serialisierte Form, wie sie spaeter von der Werbe-API kommen kann. */
export type AdTargetingPayload = {
  allowed_categories?: string[] | null;
  allowed_regions?: string[] | null;
  allowed_languages?: string[] | null;
  allowed_audiences?: string[] | null;
  allowed_kinds?: string[] | null;
  allowed_campaign_statuses?: string[] | null;
};

export const EMPTY_AD_TARGETING: AdTargeting = {
  allowedCategories: [],
  allowedRegions: [],
  allowedLanguages: [],
  allowedAudiences: [],
  allowedKinds: [],
  allowedCampaignStatuses: [],
};

const norm = (values: readonly (string | null | undefined)[] | null | undefined) =>
  [
    ...new Set(
      (values ?? [])
        .map((v) => (v ?? "").trim().toLowerCase())
        .filter((v) => v.length > 0 && v !== "all" && v !== "*"),
    ),
  ];

/** API/DB-Payload → internes Targeting-Objekt. */
export function toAdTargeting(payload: AdTargetingPayload | null | undefined): AdTargeting {
  return {
    allowedCategories: norm(payload?.allowed_categories).flatMap(categorySlugs),
    allowedRegions: norm(payload?.allowed_regions),
    allowedLanguages: norm(payload?.allowed_languages),
    allowedAudiences: norm(payload?.allowed_audiences),
    allowedKinds: norm(payload?.allowed_kinds),
    allowedCampaignStatuses: norm(payload?.allowed_campaign_statuses),
  };
}

/**
 * Nutzer-Labels (frei eingegeben, mehrsprachig) → Kategorie-Slugs des Katalogs.
 * Nur eine Uebersetzungsschicht; die Filterlogik selbst kennt nur Slugs.
 */
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  travel: ["travel", "reise", "reisen", "urlaub", "trip", "flug", "flüge", "fluege", "ταξίδια"],
  hotels: ["hotels", "hotel", "unterkunft", "resort", "ξενοδοχεία"],
  food: [
    "food",
    "essen",
    "gastronomie",
    "gastronomy",
    "restaurant",
    "restaurants",
    "kulinarik",
    "trinken",
    "φαγητό",
  ],
  events: ["events", "event", "veranstaltung", "festival", "konzert", "party", "εκδηλώσεις"],
  language: ["language", "sprache", "sprachen", "sprachkurs", "γλώσσα"],
  shopping: ["shopping", "mode", "fashion", "einkaufen", "shop", "αγορές"],
};

/** Ein Label auf passende Kategorie-Slugs abbilden (unbekannt = Label selbst). */
export function categorySlugs(label: string): string[] {
  const value = label.trim().toLowerCase();
  if (!value) return [];
  const hits: string[] = [];
  for (const [slug, words] of Object.entries(CATEGORY_SYNONYMS)) {
    if (words.some((w) => w === value || w.includes(value) || value.includes(w))) hits.push(slug);
  }
  return hits.length > 0 ? hits : [value];
}

/** Nutzer-Auswahl (Labels) → Targeting. */
export function targetingFromLabels(labels: readonly string[] | null | undefined): AdTargeting {
  return { ...EMPTY_AD_TARGETING, allowedCategories: norm(labels).flatMap(categorySlugs) };
}

export const hasAdTargeting = (t: AdTargeting) =>
  Object.values(t).some((list) => (list as string[]).length > 0);

const allows = (allowed: string[], value: string | undefined, universal?: string) => {
  if (allowed.length === 0) return true;
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return true; // unkategorisiert = universell einsetzbar
  if (universal && v === universal) return true;
  return allowed.includes(v);
};

/** Erfuellt ein Werbemittel die erlaubte Auswahl? */
export function matchesAdTargeting(ad: TargetableAd, t: AdTargeting): boolean {
  if (t.allowedCategories.length > 0) {
    const cats = (ad.filters ?? []).map((f) => f.toLowerCase());
    // Werbemittel ohne Kategorie gelten als universell und bleiben zulaessig.
    if (cats.length > 0 && !cats.some((c) => t.allowedCategories.includes(c))) return false;
  }
  return (
    allows(t.allowedRegions, ad.regionCode, "*") &&
    allows(t.allowedLanguages, ad.language) &&
    allows(t.allowedAudiences, ad.audience) &&
    allows(t.allowedKinds, ad.kind) &&
    allows(t.allowedCampaignStatuses, ad.campaignStatus)
  );
}

/**
 * Pool einschraenken. Ohne Auswahl bleibt der Pool unveraendert; mit Auswahl
 * bleibt ausschliesslich passende Werbung uebrig (Reihenfolge bleibt erhalten,
 * darueber entscheidet weiterhin der bestehende Algorithmus).
 */
export function filterAdEntries<T extends TargetableAd>(pool: readonly T[], t: AdTargeting): T[] {
  if (!hasAdTargeting(t)) return [...pool];
  return pool.filter((ad) => matchesAdTargeting(ad, t));
}
