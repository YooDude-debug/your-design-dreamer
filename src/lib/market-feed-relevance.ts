/**
 * Relevanzschicht für den Market-Feed (reine Rechenlogik, ohne Datenbank).
 *
 * Ein Angebot kann aus mehreren Gründen relevant sein: gespeicherte Suche,
 * gefolgter Verkäufer, Verkäufer-Metadaten, Kategorie-/Produkt-Treffer und
 * Aktualität. Diese Signale werden hier nachvollziehbar gewichtet und
 * zusammengeführt – bewusst ohne KI-Ranking, damit später ein größeres
 * Ranking-System darauf aufbauen kann.
 */

export type MarketFeedSignals = {
  /** Bester normalisierter Score (0..1) aus den passenden gespeicherten Suchen. */
  savedSearchScore: number;
  /** Anzahl gespeicherter Suchen, die dieses Angebot getroffen haben. */
  savedSearchMatches: number;
  /** Der eingeloggte Nutzer folgt dem Verkäufer. */
  followedSeller: boolean;
  /** Verkäuferprofil ist verifiziert (öffentlich sichtbares Merkmal). */
  sellerVerified: boolean;
  /**
   * Verkäufer ist Unternehmen/Händler/Creator. Platzhalter-Signal: unter den
   * bestehenden Rechten sind fremde Verkäufer-Stammdaten nicht lesbar, deshalb
   * bleibt es heute `false` und wird erst gefüllt, wenn die Daten regulär
   * zugänglich sind. Keine RLS-Umgehung.
   */
  sellerBusiness: boolean;
  /** Kategorie/Produktdaten passen zu einem bekannten Suchinteresse. */
  categoryMatch: boolean;
  /** Alter des Angebots in Stunden. */
  ageHours: number;
  /** Bestehende Market-Hervorhebung ist aktiv. */
  promoted: boolean;
};

export type MarketFeedReason =
  | "saved_search"
  | "followed_seller"
  | "verified_seller"
  | "business_seller"
  | "category"
  | "fresh";

/** Gewichte der Einzelsignale – bewusst offen und dokumentiert. */
export const MARKET_FEED_WEIGHTS = {
  savedSearch: 50,
  /** Jede weitere passende Suche erhöht die Relevanz leicht. */
  extraSavedSearch: 6,
  followedSeller: 25,
  sellerVerified: 6,
  sellerBusiness: 8,
  categoryMatch: 10,
  recency: 20,
  promoted: 4,
} as const;

/** Ab hier zählt ein Angebot nicht mehr als „neu“. */
export const MARKET_FEED_FRESH_HOURS = 48;
/** Nach diesem Zeitraum trägt die Aktualität nichts mehr bei. */
export const MARKET_FEED_RECENCY_DAYS = 14;

export function recencyFactor(ageHours: number): number {
  if (!Number.isFinite(ageHours) || ageHours <= 0) return 1;
  const days = ageHours / 24;
  return Math.max(0, 1 - days / MARKET_FEED_RECENCY_DAYS);
}

export function emptyMarketFeedSignals(): MarketFeedSignals {
  return {
    savedSearchScore: 0,
    savedSearchMatches: 0,
    followedSeller: false,
    sellerVerified: false,
    sellerBusiness: false,
    categoryMatch: false,
    ageHours: 0,
    promoted: false,
  };
}

/**
 * Kombinierter Relevanzwert. Ein reiner Suchtreffer und ein reines
 * Follow-Signal bleiben unterscheidbar; zusammen ergeben sie den höchsten Wert.
 */
export function scoreMarketFeedItem(signals: MarketFeedSignals): number {
  const w = MARKET_FEED_WEIGHTS;
  let score = 0;
  if (signals.savedSearchMatches > 0) {
    score += w.savedSearch * Math.min(1, Math.max(0, signals.savedSearchScore));
    score += w.extraSavedSearch * Math.min(3, signals.savedSearchMatches - 1);
  }
  if (signals.followedSeller) score += w.followedSeller;
  if (signals.sellerVerified) score += w.sellerVerified;
  if (signals.sellerBusiness) score += w.sellerBusiness;
  if (signals.categoryMatch) score += w.categoryMatch;
  if (signals.promoted) score += w.promoted;
  score += w.recency * recencyFactor(signals.ageHours);
  return Math.round(score * 100) / 100;
}

/** Nachvollziehbare Gründe – Grundlage für spätere UI-Hinweise. */
export function marketFeedReasons(signals: MarketFeedSignals): MarketFeedReason[] {
  const reasons: MarketFeedReason[] = [];
  if (signals.savedSearchMatches > 0) reasons.push("saved_search");
  if (signals.followedSeller) reasons.push("followed_seller");
  if (signals.sellerBusiness) reasons.push("business_seller");
  if (signals.sellerVerified) reasons.push("verified_seller");
  if (signals.categoryMatch) reasons.push("category");
  if (signals.ageHours <= MARKET_FEED_FRESH_HOURS) reasons.push("fresh");
  return reasons;
}
