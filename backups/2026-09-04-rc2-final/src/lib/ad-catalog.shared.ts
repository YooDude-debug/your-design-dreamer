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
 * - `adsense_preview`  rein visueller Entwicklungs-Platzhalter an genau der
 *                      Stelle, an der spaeter ein AdSense-Platz liegt
 *                      (nur Admin + Testmodus, kein Google-Kontakt)
 * - `demo`             interner Demobestand (nur Admin + Testmodus)
 */
export type AdSource = "internal" | "market_promotion" | "adsense" | "adsense_preview" | "demo";

/** Ein geplanter Werbeplatz im normalen Feed. */
export type AdPlanSlot = {
  /** Nullbasierter Index des Beitrags, NACH dem die Werbung erscheint. */
  afterIndex: number;
  kind: AdKind;
  adId: string;
  /** Quelle des Platzes (fehlt bei alten Plänen → als `demo` behandeln). */
  source?: AdSource;
};

/**
 * Anzeigedaten einer Business-Kampagne (`source: "internal"`).
 * Enthält ausschliesslich bereits oeffentlich sichtbare Werbeinhalte.
 */
export type CampaignAdView = {
  id: string;
  name: string;
  caption: string;
  company: string;
  companyLogo: string | null;
  /** Benutzername des Unternehmens für das bestehende Profil-Ziel. */
  companyUsername: string | null;
  region: string;
  hashtags: string[];
  slangTagName: string | null;
  /** Kurzlebige signierte URL – ausschliesslich zum Probeanhören. */
  slangTagPreviewUrl: string | null;
  slangTagDuration: string | null;
  ctaUrl: string | null;
  /** F6: Handlungsoption der Kampagne (bestehende Y-Dude-Ziele). */
  cta: "listen" | "slangtag" | "profile" | null;
  /** F6: Kampagne bewirbt einen eigenen Exclusive SlangDrop. */
  isDrop: boolean;
  /** Verbleibende Exemplare des Drops (aus der bestehenden Drop-Logik). */
  dropRemaining: number | null;
  dropEndsAt: number | null;
};

export type AdPlan = {
  slots: AdPlanSlot[];
  /** Zeitpunkt der Erstellung (nur Diagnose). */
  createdAt: string;
  /** Werbedaten der eingeplanten Business-Kampagnen. */
  campaigns?: CampaignAdView[];
};

/** Werbevideo-Regeln (Sekunden). */
export const VIDEO_AD_SKIP_AFTER = 2;
export const VIDEO_AD_DEFAULT_LENGTH = 15;
export const VIDEO_AD_MAX_LENGTH = 30;
