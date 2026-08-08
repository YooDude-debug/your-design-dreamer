/**
 * Feed-Algorithmus 2.0 – zentrale Typen.
 *
 * Der Kern ist bewusst UI-frei und datenbankfrei: alle Module arbeiten mit
 * einfachen, vollständig typisierten Eingaben. Dadurch ist jeder Faktor
 * isoliert testbar und der Feed kann jederzeit um neue Module erweitert
 * werden, ohne den Kern anzupassen.
 */

/** Medientyp eines Beitrags – u. a. für die Vielfalt-Regel. */
export type FeedMediaType = "image" | "audio" | "text" | "mixed";

/** Ein Beitrag in der für das Ranking benötigten, reduzierten Form. */
export type RankablePost = {
  id: string;
  authorId: string;
  createdAt: number;
  /** Freitext-Region des Beitrags ("Hamburg, Deutschland"). */
  region: string;
  /** Sprache des Beitrags (ISO-Kürzel, optional). */
  language?: string;
  /** Hashtags (#) – thematische Einordnung. Eigenes Signal, nie mit $ gemischt. */
  hashtags: string[];
  /** SlangTags ($) – sprachliche/regionale Vernetzung. Eigenes Signal. */
  slangTagIds: string[];
  /** Regionen der verwendeten SlangTags (für die regionale Vernetzung). */
  slangRegions?: string[];
  /** Sprachen der verwendeten SlangTags. */
  slangLanguages?: string[];
  /** Kategorien/Themen des Beitrags (Slugs oder freie Begriffe). */
  topics?: string[];
  mediaType: FeedMediaType;
  /** Interaktionen des Beitrags. */
  stats: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    views: number;
  };
  /** Aggregierte SlangTag-Qualität des Beitrags (siehe SlangTagQuality). */
  slangQuality?: SlangTagQuality;
  /** Technische/inhaltliche Beitragsqualität. */
  quality?: PostQualitySignals;
  /** Vertrauens- und Aktivitätsdaten des Erstellers. */
  author?: AuthorSignals;
};

/** Qualitätssignale der verwendeten SlangTags (Hörverhalten schlägt Reichweite). */
export type SlangTagQuality = {
  plays: number;
  /** Vollständige Wiedergaben. */
  completions: number;
  /** Durchschnittliche Hördauer in Sekunden. */
  avgListenSeconds: number;
  /** Gesamtdauer des SlangTags in Sekunden. */
  durationSeconds: number;
  repeats: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  /** Positive Bewertungen (Upvotes). */
  upvotes: number;
  /** Profilbesuche nach dem Anhören. */
  profileVisits: number;
};

/** Technische und redaktionelle Beitragsqualität. */
export type PostQualitySignals = {
  /** Bildbreite × Höhe in Pixeln (0 = kein Bild). */
  imagePixels?: number;
  /** Audio-Bitrate in kbit/s (0 = kein Audio). */
  audioKbps?: number;
  /** Länge des beschreibenden Textes. */
  descriptionLength: number;
  hasTitle: boolean;
  hashtagCount: number;
  slangTagCount: number;
};

/** Langfristige Signale zum Ersteller. */
export type AuthorSignals = {
  /** Konto-Alter in Tagen. */
  accountAgeDays: number;
  /** Bisher erhaltene Impressionen (Startbonus-Grenze). */
  impressions: number;
  postCount: number;
  deletedPostCount: number;
  /** Verstöße/Meldungen mit Konsequenz. */
  violations: number;
  /** Community-Bewertung 0..1. */
  communityRating?: number;
  verified?: boolean;
  /** Aktive Tage der letzten 30 Tage. */
  activeDaysLast30?: number;
  /** Kommentare, die der Ersteller selbst geschrieben hat. */
  commentsWritten?: number;
};

/** Nutzerkontext: freiwillige Interessen + gelernte Gewichte. */
export type FeedViewerContext = {
  userId: string;
  /** Freiwillig gewählte Interessen (Werbefeed) – nie überschreibbar. */
  interests: FeedInterest[];
  /** Standortkette des Nutzers, feinste Ebene zuerst. */
  location: FeedLocation;
  /** Sprachen des Nutzers. */
  languages: string[];
  /** Gefolgte Ersteller. */
  followingIds: string[];
  /** Bestätigte Connections (beidseitig) – eigenes, gedeckeltes Signal. */
  connectionIds: string[];

  /** Gefolgte Hashtags (#) – eigenes Signal des Hashtag-Systems. */
  followedHashtags: string[];
  /** Aktuell trendende Hashtags (#) – eigene Trendliste. */
  trendingHashtags: string[];
  /** Gelernte Gewichte (Schlüssel → Gewicht, siehe learning.ts). */
  learned: Record<string, number>;
  /** Ersteller/Themen mit "Kein Interesse". */
  muted: { authorIds: string[]; topics: string[] };
};

export type FeedInterestKind =
  | "category"
  | "topic"
  | "region"
  | "city"
  | "country"
  | "language"
  | "slang"
  | "creator";

/** Ein einzelnes Interesse mit eigener Gewichtung. */
export type FeedInterest = {
  value: string;
  kind: FeedInterestKind;
  /** Relative Stärke 0..1 (Standard 1). */
  weight?: number;
};

/** Geografische Hierarchie – für die automatische Radius-Erweiterung. */
export type FeedLocation = {
  city?: string;
  neighborCities?: string[];
  region?: string;
  state?: string;
  country?: string;
  continent?: string;
};

/** Ergebnis eines einzelnen Ranking-Moduls. */
export type FactorResult = {
  /** Normalisierter Wert 0..1 (bzw. −1..1 bei Abzügen). */
  value: number;
  /** Optionale Zusatzinfos für Debug/Analyse. */
  detail?: Record<string, number | string | boolean>;
};

/** Signatur eines Ranking-Moduls. Neue Module brauchen keine Kernänderung. */
export type RankingFactor = {
  /** Stabiler Schlüssel – auch Schlüssel des Gewichts in der Konfiguration. */
  key: string;
  /** Zusätzliche Punkte (positiv) oder Abzug (negativ). */
  score: (post: RankablePost, ctx: FeedViewerContext, now: number) => FactorResult;
};

/** Bewerteter Beitrag. */
export type ScoredPost = {
  postId: string;
  score: number;
  breakdown: Record<string, number>;
  /** Aus dem Explorations-Kontingent statt aus der Personalisierung. */
  exploration: boolean;
};

/** Signalarten des lernenden Algorithmus. */
export type FeedSignal =
  | "view"
  | "view_complete"
  | "dwell"
  | "listen_complete"
  | "repeat"
  | "like"
  | "comment"
  | "share"
  | "follow"
  | "save"
  | "profile_visit"
  | "skip"
  | "fast_scroll"
  | "not_interested"
  | "mute"
  | "block"
  | "report";

export type FeedSignalInput = {
  signal: FeedSignal;
  postId?: string;
  authorId?: string;
  /** Verweildauer in Millisekunden (bei "dwell"/"view"). */
  dwellMs?: number;
  /** Kategorien/Themen des Inhalts – Ziel der Gewichtsanpassung. */
  topics?: string[];
  /** Hashtags (#) des Inhalts – lernen im eigenen Namensraum `hashtag:`. */
  hashtags?: string[];
  /** SlangTags ($) des Inhalts – lernen im eigenen Namensraum `slang:`. */
  slangTagIds?: string[];
  region?: string;
  language?: string;
};
