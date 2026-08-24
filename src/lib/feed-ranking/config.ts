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
  /** Beziehung: gefolgte Nutzer und Connections (deutlicher, gedeckelter Bonus). */
  relationship: 13,
  /** Echte Interaktionen (normalisiert, zeitgewichtet). */
  engagement: 12,
  /** SlangTags ($) – "Wie spricht die Community darüber?" (eigenes Signal). */
  slangAffinity: 10,
  /** SlangTag-Qualität – abgesenkt, da nur Teilmessungen vorliegen. */
  slangQuality: 8,
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

  /**
   * Diversity-/Re-Ranking-Schicht (siehe `diversity.ts`). Alle Strafen und
   * Boni sind Vielfache der Score-Spanne des Kandidatensatzes und wirken
   * dadurch unabhängig von der absoluten Score-Höhe. Bewusst klein gehalten:
   * die Relevanz bleibt führend, es werden nur monotone Muster aufgebrochen.
   */
  diversity: {
    /** Nur so viele Kandidaten kommen pro Position in Frage (kein Chaos). */
    candidateWindow: 18,
    /** Gemeinsamer Maßstab aller Strafen (Anteil der Score-Spanne). */
    penaltyScale: 0.9,
    /** Obergrenze: eine Strafe darf höchstens diesen Anteil der Fensterspanne kosten. */
    maxPenaltyShare: 1.5,

    /** Gleicher Autor: klare, aber weiche Wiederholungsstrafe. */
    authorPenalty: 3,
    authorWindow: 4,
    /** Gleicher Channel. */
    channelPenalty: 2.2,
    channelWindow: 3,
    /** Gleiches Thema / gleiche Kategorie. */
    topicPenalty: 1.8,
    topicWindow: 3,
    /** Gleiche Region. */
    regionPenalty: 1,
    regionWindow: 2,
    /** Gleicher Medientyp (Bild, Galerie, Video, Text, Audio). */
    mediaPenalty: 2,
    mediaWindow: 3,
    /** Mit/ohne SlangTag abwechseln, damit SlangTags rhythmisch auftauchen. */
    slangPenalty: 1.2,
    slangWindow: 2,

    /** Zuletzt ganz oben gesehene Beiträge nicht erneut an den Anfang setzen. */
    seenPenalty: 4,
    seenTopPositions: 3,

    /** Engagement nicht überbewerten: virale Blöcke werden aufgelöst. */
    viralEngagementPoints: 7,
    viralStreakLimit: 2,
    viralStreakPenalty: 2.5,

    /** Entdeckung neuer SlangTags (wenige Wiedergaben) – kleiner Bonus. */
    slangDiscoveryBoost: 0.8,
    slangDiscoveryMaxPlays: 25,

    /** Kontrollierte Variation zwischen gleichwertigen Kandidaten. */
    variationJitter: 1.2,
  },

  /** Freshness: Halbwertszeit des Aktualitätsbonus in Stunden. */
  freshnessHalfLifeHours: 30,
  /** Sehr gute alte Beiträge behalten diesen Mindestanteil des Bonus. */
  freshnessFloor: 0.12,

  /** Startbonus für neue Ersteller. */
  newCreatorMaxAgeDays: 21,
  newCreatorMaxImpressions: 2_000,

  /** Interessen: maximal berücksichtigte Treffer (danach Sättigung). */
  interestMatchSaturation: 4,

  /**
   * Hashtag-Signale (thematische Einordnung). Vollständig getrennt von den
   * SlangTag-Signalen – beide Systeme haben eigene Schwellen und Gewichte.
   */
  hashtag: {
    /** Punkte für einen gefolgten Hashtag. */
    followedWeight: 1,
    /** Punkte für einen aktuell trendenden Hashtag. */
    trendingWeight: 0.45,
    /** Punkte für ein passendes Grundinteresse. */
    interestWeight: 0.6,
    /** Ab so vielen gewichteten Treffern ist das Signal gesättigt. */
    matchSaturation: 2.5,
    /**
     * Hashtag-Stuffing-Schutz: nur die ersten Hashtags eines Beitrags werden
     * gewertet. Mehr Hashtags bringen dadurch nie mehr Reichweite.
     */
    maxCountedTags: 5,
    /** Ab dieser Anzahl gilt ein Beitrag als überladen (leichter Abzug). */
    stuffingLimit: 8,
    /** Höchstabzug für Überladung (auf den Hashtag-Faktor bezogen). */
    stuffingPenalty: 0.35,
  },

  /** SlangTag-Signale (sprachlich/regionale Vernetzung). */
  slang: {
    /** Punkte für einen bereits gehörten/bevorzugten SlangTag (gelernt). */
    learnedWeight: 1,
    /** Punkte, wenn die Region des SlangTags zur Region des Nutzers passt. */
    regionWeight: 0.9,
    /** Punkte, wenn die Sprache des SlangTags zur Sprache des Nutzers passt. */
    languageWeight: 0.5,
    matchSaturation: 2,
  },

  /**
   * Beziehungssignal: gefolgte Nutzer und Connections erhalten einen klaren,
   * aber gedeckelten Bonus – niemals eine feste Spitzenposition.
   */
  relationship: {
    followingValue: 0.8,
    connectionValue: 0.5,
    /** Beides gleichzeitig ergibt höchstens diesen Wert. */
    maxValue: 1,
  },

  /**
   * Interaktionen (Likes, Kommentare, Shares, Saves). Bewusst normalisiert:
   * absolute Zahlen sättigen, die Wirkung verfällt mit dem Alter.
   */
  engagement: {
    likeWeight: 1,
    commentWeight: 1.5,
    shareWeight: 1.7,
    saveWeight: 1.6,
    /** Ab so vielen gewichteten Interaktionen ist das Volumen gesättigt. */
    volumeSaturation: 40,
    /** Interaktionen pro Stunde für halbe Sättigung der Geschwindigkeit. */
    velocitySaturation: 3,
    /** Engagement-Rate (Interaktionen je Aufruf), die als sehr gut gilt. */
    goodRate: 0.25,
    /** Unter dieser Aufrufzahl ist die Rate statistisch nicht belastbar. */
    minViewsForRate: 20,
    /** Halbwertszeit des Interaktionsbonus in Stunden. */
    halfLifeHours: 48,
    /** Restwirkung sehr alter Interaktionen. */
    decayFloor: 0.1,
    /** Anteile der drei Teilsignale (Summe 1). */
    velocityShare: 0.45,
    rateShare: 0.35,
    volumeShare: 0.2,
  },

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
