/**
 * Gewichte und Schwellen des Feed-Algorithmus.
 *
 * Sämtliche Werte liegen ausschließlich hier – kein Modul enthält "magische"
 * Zahlen. Dadurch kann das Ranking ohne Eingriff in die Logik justiert werden.
 */

export const FEED_WEIGHTS = {
  /** Persönliche Interessen haben die höchste Priorität. */
  interests: 34,
  region: 18,
  /** Hashtags (#) – "Worum geht der Beitrag?" (eigenes, getrenntes Signal). */
  hashtagAffinity: 16,
  /** SlangTags ($) – "Wie spricht die Community darüber?" (eigenes Signal). */
  slangAffinity: 10,
  slangQuality: 14,
  postQuality: 8,
  freshness: 12,
  newCreator: 6,
  creatorTrust: 8,
  /** Abzüge (werden negativ verrechnet). */
  spam: 22,
  /** Feiner Rauschanteil, damit gleiche Scores nicht dauerhaft gleich sortieren. */
  jitter: 2,
} as const;

export type FeedWeightKey = keyof typeof FEED_WEIGHTS;

export const FEED_CONFIG = {
  /** Anteil personalisierter Beiträge (Rest = Exploration). */
  personalizedShare: 0.88,
  /** Zufalls-/Entdeckungs-Kontingent (5–10 %). */
  explorationShare: 0.12,
  /** Höchstens so viele Beiträge derselben Person in Folge. */
  maxSameAuthorInRow: 1,
  /** Abstand (in Positionen), bevor derselbe Autor erneut erscheinen darf. */
  authorCooldown: 3,
  /** Abstand für dasselbe Thema bzw. dieselbe Region. */
  topicCooldown: 2,
  regionCooldown: 2,
  mediaCooldown: 2,

  /** Freshness: Halbwertszeit des Aktualitätsbonus in Stunden. */
  freshnessHalfLifeHours: 30,
  /** Sehr gute alte Beiträge behalten diesen Mindestanteil des Bonus. */
  freshnessFloor: 0.12,

  /** Startbonus für neue Ersteller. */
  newCreatorMaxAgeDays: 21,
  newCreatorMaxImpressions: 2_000,

  /** Interessen: maximal berücksichtigte Treffer (danach Sättigung). */
  interestMatchSaturation: 4,
  /** Relative Gewichte je Interessenart. */
  interestKindWeight: {
    category: 1,
    topic: 1,
    slang: 0.9,
    creator: 0.9,
    city: 0.8,
    region: 0.7,
    country: 0.5,
    language: 0.6,
  } as Record<string, number>,

  /** Regionale Abstufung (feinste Ebene zuerst). */
  regionLevels: [
    { key: "city", value: 1 },
    { key: "neighborCity", value: 0.82 },
    { key: "region", value: 0.68 },
    { key: "state", value: 0.52 },
    { key: "country", value: 0.36 },
    { key: "continent", value: 0.18 },
    { key: "world", value: 0.06 },
  ] as const,

  /** Qualitätsschwellen für Medien. */
  goodImagePixels: 640 * 640,
  goodAudioKbps: 96,
  goodDescriptionLength: 60,

  /** Spam-Erkennung. */
  spamMaxPostsPerDay: 12,
  spamEngagementRatioCap: 0.9,
  /** Häufigkeit, ab der ein wiederholter SlangTag als Spam gilt. */
  spamSlangRepeatLimit: 8,

  /** Lernender Algorithmus. */
  learning: {
    /** Lernrate pro Signal. */
    rate: 0.08,
    /** Grenzen des gelernten Zusatzgewichts. */
    min: -1,
    max: 1.5,
    /** Punktwerte der Signale. */
    signalValue: {
      view: 0.1,
      view_complete: 0.6,
      dwell: 0.4,
      listen_complete: 0.9,
      repeat: 0.8,
      like: 1,
      comment: 1.2,
      share: 1.3,
      follow: 1.5,
      save: 1.2,
      profile_visit: 0.7,
      skip: -0.6,
      fast_scroll: -0.4,
      not_interested: -1.5,
      mute: -1.5,
      block: -2,
      report: -2,
    } as Record<string, number>,
    /** Verweildauer, ab der ein "dwell" als positiv zählt (ms). */
    dwellPositiveMs: 4_000,
    /** Verweildauer, unter der schnelles Wegscrollen erkannt wird (ms). */
    dwellFastScrollMs: 1_200,
    /**
     * Gelernte Gewichte dürfen die freiwilligen Interessen nie ersetzen –
     * sie wirken nur als Zuschlag/Abschlag in diesem Rahmen.
     */
    influenceCap: 0.35,
  },

  /** Cache-Gültigkeit vorberechneter Scores in Sekunden. */
  scoreCacheTtlSeconds: 180,
  /** Standard-Seitengröße für Lazy Loading. */
  pageSize: 20,
} as const;
