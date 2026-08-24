/**
 * Y-Dude Interest Engine – zentrale Typen.
 *
 * Der Kern ist bewusst UI-frei: keine React-Abhängigkeiten, keine Annahmen
 * über Feed, Werbe-Feed oder Messenger. Alle Bereiche können später dieselbe
 * Engine nutzen.
 */

export type CategoryKind = "topic" | "region" | "language" | "style" | "other";

export type ContentType = "post" | "slang_tag" | "profile" | "ad";

export type InterestCategory = {
  id: string;
  slug: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  active: boolean;
};

/** Alle protokollierbaren Aktionen. Inhalte von Nachrichten werden nie erfasst. */
export type InteractionAction =
  | "post_view"
  | "post_view_complete"
  | "post_like"
  | "post_comment"
  | "post_share"
  | "post_save"
  | "slangtag_play"
  | "slangtag_use"
  | "slangtag_save"
  | "profile_visit"
  | "search"
  | "message"
  | "connection";

/** Aktionen, die als aktives Engagement zählen (höheres Confidence-Gewicht). */
export const ENGAGEMENT_ACTIONS: InteractionAction[] = [
  "post_like",
  "post_comment",
  "post_share",
  "post_save",
  "slangtag_use",
  "slangtag_save",
  "message",
  "connection",
];

export type InteractionInput = {
  action: InteractionAction;
  /** Inhalt, auf den sich die Aktion bezieht – Kategorien werden daraus aufgelöst. */
  contentType?: ContentType;
  contentId?: string;
  /** Optionale direkte Kategorien (z. B. bei Suchanfragen). */
  categoryIds?: string[];
  /** Gegenüber bei Messenger-/Connection-Aktionen (nur Häufigkeit, kein Inhalt). */
  peerId?: string;
  /** Verweildauer in Millisekunden. */
  dwellMs?: number;
};

export type InterestScoreRow = {
  categoryId: string;
  dynamicScore: number;
  eventsCount: number;
  lastEventAt: number | null;
  lastDecayAt: number;
};

export type ConfidenceRow = {
  categoryId: string;
  confidence: number;
  viewCount: number;
  engageCount: number;
  distinctDays: number;
  promoted: boolean;
  lastEventAt: number | null;
};

export type ConnectionInfluenceRow = {
  peerId: string;
  messageCount: number;
  likeCount: number;
  commentCount: number;
  sharedInterests: number;
  sharedSlangTags: number;
  strength: number;
};

/** Ein einzelner Eintrag des berechneten Interessenprofils. */
export type InterestProfileEntry = {
  categoryId: string;
  slug: string;
  name: string;
  kind: CategoryKind;
  /** Vom Nutzer gewählter Grundwert (0 wenn nicht gewählt). */
  baseScore: number;
  /** Gelernter dynamischer Wert. */
  dynamicScore: number;
  /** Anteil aus Connections (max. weight.connection_max). */
  connectionScore: number;
  /** Confidence 0..1 (normalisiert am Schwellenwert). */
  confidence: number;
  /** Als echtes Interesse übernommen? */
  promoted: boolean;
  /** Gewichteter Endwert 0..100. */
  score: number;
};

export type InterestProfile = {
  userId: string;
  entries: InterestProfileEntry[];
  /** Zeitpunkt der Berechnung (ms). */
  computedAt: number;
  /** Cache-Gültigkeit in Sekunden. */
  ttlSeconds: number;
};

export type Recommendation<T extends string = string> = {
  id: string;
  type: T;
  score: number;
  /** Kategorien, die zur Empfehlung geführt haben. */
  matchedCategoryIds: string[];
};
