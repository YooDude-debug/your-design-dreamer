/**
 * Leichter Werbekatalog (ohne Medien-Importe).
 *
 * Server- und Clientseite teilen diese Metadaten. Der Server waehlt daraus
 * Werbung aus, der Client loest die IDs anschliessend gegen die Medienpools
 * (`ad-demo.ts` fuer Bildwerbung, `ad-video-demo.ts` fuer Videowerbung) auf.
 */

export type AdKind = "image" | "video";

export type AdCatalogEntry = {
  id: string;
  kind: AdKind;
  /** Themenfilter, wird gegen Interessen-Slugs gematcht. */
  filters: string[];
  /** Land/Region ("*" = überall). */
  regionCode: string;
};

/** Personalisierte Bildwerbung – identisch zu den IDs in `SPONSORED_ADS`. */
export const IMAGE_AD_CATALOG: AdCatalogEntry[] = [
  { id: "hotel-greece", kind: "image", filters: ["travel", "hotels"], regionCode: "GR" },
  { id: "doener-berlin", kind: "image", filters: ["food"], regionCode: "DE" },
  { id: "flight-tokyo", kind: "image", filters: ["travel"], regionCode: "JP" },
  { id: "language-london", kind: "image", filters: ["language"], regionCode: "GB" },
  { id: "tour-paris", kind: "image", filters: ["travel", "events"], regionCode: "FR" },
  { id: "festival-berlin", kind: "image", filters: ["events"], regionCode: "DE" },
  { id: "car-mallorca", kind: "image", filters: ["travel", "shopping"], regionCode: "ES" },
  { id: "insurance-travel", kind: "image", filters: ["travel", "shopping"], regionCode: "*" },
];

/** Videowerbung – identisch zu den IDs in `VIDEO_ADS`. */
export const VIDEO_AD_CATALOG: AdCatalogEntry[] = [
  // Testphase: nur der Y-Dude-Werbeclip wird als Videowerbung ausgespielt.
  // { id: "video-hotel-greece", kind: "video", filters: ["travel", "hotels"], regionCode: "GR" },
  // { id: "video-festival-berlin", kind: "video", filters: ["events"], regionCode: "DE" },
  // { id: "video-flight-tokyo", kind: "video", filters: ["travel"], regionCode: "JP" },
  // Test-Werbemittel: ueberall ausspielbar, damit das Videoformat im Feed geprueft werden kann.
  { id: "video-ydude-feedtest", kind: "video", filters: [], regionCode: "*" },
];

/**
 * Werbequelle eines Platzes. Der Kernel entscheidet die Quelle, die Seiten
 * fragen nur einen allgemeinen Werbeplatz an.
 *
 * - `internal`         eigene Y-Dude-Kampagnen (`ad_campaigns`)
 * - `market_promotion` bezahlte Market-Hervorhebungen
 * - `adsense`          Google AdSense (fremdgerendert)
 * - `demo`             interner Demobestand (nur Admin + Testmodus)
 */
export type AdSource = "internal" | "market_promotion" | "adsense" | "demo";

/** Ein geplanter Werbeplatz im normalen Feed. */
export type AdPlanSlot = {
  /** Nullbasierter Index des Beitrags, NACH dem die Werbung erscheint. */
  afterIndex: number;
  kind: AdKind;
  adId: string;
  /** Quelle des Platzes (fehlt bei alten Plänen → als `demo` behandeln). */
  source?: AdSource;
};

export type AdPlan = {
  slots: AdPlanSlot[];
  /** Zeitpunkt der Erstellung (nur Diagnose). */
  createdAt: string;
};

/** Werbevideo-Regeln (Sekunden). */
export const VIDEO_AD_SKIP_AFTER = 2;
export const VIDEO_AD_DEFAULT_LENGTH = 15;
export const VIDEO_AD_MAX_LENGTH = 30;
