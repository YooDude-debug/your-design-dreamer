/**
 * Ad Provider / Adapter – Schnittstelle fuer eine ZUKUENFTIGE externe Werbe-API.
 *
 * WICHTIG: Diese Datei aendert die bestehende Werbelogik nicht. Sie definiert
 * nur Typen und einen Vertrag. Der bestehende Werbekernel
 * (`ad-catalog.shared.ts`, `ad-plan.server.ts`, `ads.functions.ts`,
 * `use-feed-ad-plan.ts`) bleibt unveraendert und ist weiterhin der
 * "internal" Provider.
 *
 * Datenfluss (geplant):
 *   Interessen/Profil  ->  AdTargetingSignal (minimal, pseudonym)
 *                      ->  AdProvider.fetchAds()
 *                      ->  ExternalAdCreative
 *                      ->  toCatalogEntry() (internes Y-Dude-Format)
 *                      ->  bestehende Auswahl/Ranking in buildFeedAdPlan()
 */

import type { AdCatalogEntry, AdKind } from "@/lib/ad-catalog.shared";

/**
 * Minimales, absichtlich armes Signal fuer eine externe Anfrage.
 * Es enthaelt bewusst KEINE User-ID, keine E-Mail, keinen Standort auf
 * Ortsebene, keine Follower-/Post-Daten und keine SlangTag-Inhalte.
 */
export type AdTargetingSignal = {
  /** Rotierendes Pseudonym (z. B. HMAC(userId, tagesSalt)) – nie die echte User-ID. */
  pseudoId: string;
  /** Maximal 3 Interessen-Slugs, wie sie der interne Algorithmus schon nutzt. */
  interests: string[];
  /** Grobe Region (Laendercode, z. B. "DE") oder "*". */
  regionCode: string;
  /** Sprachcode ("de", "en"). */
  language: string;
  /** Gewuenschte Werbearten. */
  kinds: AdKind[];
  /** Personalisierung erlaubt? false => kontextfreie Werbung anfordern. */
  personalized: boolean;
  /** Maximale Anzahl Creatives. */
  limit: number;
};

/** Antwortformat eines externen Anbieters, bereits normalisiert. */
export type ExternalAdCreative = {
  /** Anbieter-eigene ID – wird mit Provider-Prefix zur internen adId. */
  externalId: string;
  kind: AdKind;
  company: string;
  headline: string;
  body: string;
  cta: string;
  clickUrl: string;
  mediaUrl: string;
  posterUrl?: string;
  /** Themen-Slugs des Creatives (Match gegen Interessen). */
  filters: string[];
  regionCode: string;
  /** Opaque Tracking-Handles des Anbieters. */
  impressionToken?: string;
  clickToken?: string;
};

export type AdProviderResult = {
  providerId: string;
  creatives: ExternalAdCreative[];
  /** Empfohlene Cache-Dauer in Sekunden. */
  ttlSeconds: number;
};

export type AdProvider = {
  id: string;
  /** Liefert Creatives; MUSS bei Fehler/Timeout leer zurueckgeben, nie werfen. */
  fetchAds: (signal: AdTargetingSignal) => Promise<AdProviderResult>;
  /** Impression/Klick an den Anbieter zurueckmelden (best effort). */
  reportEvent?: (
    event: { type: "impression" | "click"; token?: string; adId: string },
  ) => Promise<void>;
};

/** Interne adId aus Provider + externer ID (kollisionsfrei zum Demokatalog). */
export const externalAdId = (providerId: string, externalId: string) =>
  `ext:${providerId}:${externalId}`;

/**
 * Uebersetzt ein externes Creative in den bestehenden Katalogeintrag, den
 * `buildFeedAdPlan()` bereits versteht (Gewichtung nach filters/regionCode).
 */
export function toCatalogEntry(
  providerId: string,
  creative: ExternalAdCreative,
): AdCatalogEntry {
  return {
    id: externalAdId(providerId, creative.externalId),
    kind: creative.kind,
    filters: creative.filters.map((f) => f.toLowerCase()),
    regionCode: creative.regionCode || "*",
  };
}

/**
 * Referenz-Provider: liefert nichts und haelt damit den bestehenden internen
 * Katalog als einzige Quelle. Platzhalter, bis eine echte API angebunden wird.
 */
export const nullAdProvider: AdProvider = {
  id: "internal",
  fetchAds: async () => ({ providerId: "internal", creatives: [], ttlSeconds: 60 }),
};
