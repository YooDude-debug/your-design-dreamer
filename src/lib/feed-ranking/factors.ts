/**
 * Ranking-Module des Feed-Algorithmus.
 *
 * Jedes Modul ist eigenständig, rein funktional und liefert einen
 * normalisierten Wert. Neue Faktoren werden hier ergänzt und in
 * `DEFAULT_FACTORS` registriert – der Kern bleibt unverändert.
 */

import { FEED_CONFIG } from "./config";
import type { FactorResult, RankablePost, RankingFactor } from "./types";
import { clamp01, hashUnit, locationParts, norm, saturate } from "./utils";

/* ------------------------------------------------------------------ *
 * 1. Persönliche Interessen (höchste Priorität)
 * ------------------------------------------------------------------ */

/**
 * Merkmale für Interessen/Stummschaltung. Bewusst OHNE Hashtags und ohne
 * SlangTags: beide Systeme haben eigene Faktoren und dürfen sich nie
 * gegenseitig ersetzen oder vermischen.
 */
function postTerms(post: RankablePost) {
  return new Set(
    [
      ...(post.topics ?? []).map(norm),
      ...locationParts(post.region),
      norm(post.language),
      norm(post.authorId),
    ].filter(Boolean),
  );
}

/** Alle Merkmale inkl. beider Tag-Systeme – nur für negative Nutzerwünsche. */
function mutableTerms(post: RankablePost) {
  const terms = postTerms(post);
  for (const value of [...post.hashtags.map(norm), ...post.slangTagIds.map(norm)]) {
    if (value) terms.add(value);
  }
  return terms;
}

export const interestFactor: RankingFactor = {
  key: "interests",
  score: (post, ctx): FactorResult => {
    if (ctx.interests.length === 0) return { value: 0 };
    const terms = postTerms(post);
    let matched = 0;
    let weighted = 0;

    for (const interest of ctx.interests) {
      const value = norm(interest.value);
      if (!value) continue;
      const hit =
        terms.has(value) || [...terms].some((t) => t.includes(value) || value.includes(t));
      if (!hit) continue;
      matched += 1;
      const kindWeight = FEED_CONFIG.interestKindWeight[interest.kind] ?? 1;
      const learned = ctx.learned[`topic:${value}`] ?? 0;
      const bonus = 1 + clamp01(learned) * FEED_CONFIG.learning.influenceCap;
      weighted += (interest.weight ?? 1) * kindWeight * bonus;
    }

    if (matched === 0) return { value: 0, detail: { matched } };
    // Mehrere Übereinstimmungen erhöhen den Score, sättigen aber ab.
    const value = clamp01(weighted / FEED_CONFIG.interestMatchSaturation);
    return { value, detail: { matched } };
  },
};

/* ------------------------------------------------------------------ *
 * 1b. Hashtags (#) – thematische Einordnung des Beitrags
 * ------------------------------------------------------------------ */

/** Vereinheitlicht einen Hashtag für Vergleiche (ohne "#", klein). */
function normHashtag(value: string) {
  return norm(value).replace(/^#+/, "");
}

/**
 * Eigenes Hashtag-Signal: gefolgte Hashtags, Trend-Hashtags, gelernte
 * Hashtag-Gewichte und thematische Interessen. Verwendet ausschließlich
 * `post.hashtags` – SlangTags fließen hier niemals ein.
 */
export const hashtagFactor: RankingFactor = {
  key: "hashtagAffinity",
  score: (post, ctx): FactorResult => {
    const tags = post.hashtags.map(normHashtag).filter(Boolean);
    if (tags.length === 0) return { value: 0 };

    const followed = new Set(ctx.followedHashtags.map(normHashtag));
    const trending = new Set(ctx.trendingHashtags.map(normHashtag));
    const interests = new Set(ctx.interests.map((i) => norm(i.value)).filter(Boolean));
    const cfg = FEED_CONFIG.hashtag;

    let sum = 0;
    let matchedFollowed = 0;
    let matchedTrending = 0;
    for (const tag of new Set(tags)) {
      if (followed.has(tag)) {
        sum += cfg.followedWeight;
        matchedFollowed += 1;
      }
      if (trending.has(tag)) {
        sum += cfg.trendingWeight;
        matchedTrending += 1;
      }
      if (interests.has(tag)) sum += cfg.interestWeight;
      const learned = ctx.learned[`hashtag:${tag}`];
      if (learned !== undefined) {
        sum += Math.max(-1, Math.min(1, learned)) * FEED_CONFIG.learning.influenceCap;
      }
    }

    if (sum === 0) return { value: 0, detail: { matchedFollowed, matchedTrending } };
    const value = Math.max(-1, Math.min(1, sum / cfg.matchSaturation));
    return { value, detail: { matchedFollowed, matchedTrending } };
  },
};

/* ------------------------------------------------------------------ *
 * 1c. SlangTags ($) – sprachliche und regionale Vernetzung
 * ------------------------------------------------------------------ */

/**
 * Eigenes SlangTag-Signal: gelernte SlangTag-Vorlieben sowie regionale und
 * sprachliche Nähe der verwendeten SlangTags. Hashtags fließen hier nie ein.
 */
export const slangAffinityFactor: RankingFactor = {
  key: "slangAffinity",
  score: (post, ctx): FactorResult => {
    if (post.slangTagIds.length === 0) return { value: 0 };
    const cfg = FEED_CONFIG.slang;
    const viewerRegions = new Set(
      [ctx.location.city, ctx.location.region, ctx.location.country]
        .filter(Boolean)
        .flatMap((part) => locationParts(part as string)),
    );
    const viewerLanguages = new Set(ctx.languages.map(norm).filter(Boolean));

    let sum = 0;
    let learnedHits = 0;
    for (const id of new Set(post.slangTagIds.map(norm))) {
      const learned = ctx.learned[`slang:${id}`];
      if (learned === undefined) continue;
      learnedHits += 1;
      sum += Math.max(-1, Math.min(1, learned)) * cfg.learnedWeight;
    }

    let regionHits = 0;
    for (const region of post.slangRegions ?? []) {
      if (locationParts(region).some((part) => viewerRegions.has(part))) {
        regionHits += 1;
        sum += cfg.regionWeight;
      }
    }

    let languageHits = 0;
    for (const language of post.slangLanguages ?? []) {
      if (viewerLanguages.has(norm(language))) {
        languageHits += 1;
        sum += cfg.languageWeight;
      }
    }

    if (sum === 0) return { value: 0, detail: { learnedHits, regionHits, languageHits } };
    const value = Math.max(-1, Math.min(1, sum / cfg.matchSaturation));
    return { value, detail: { learnedHits, regionHits, languageHits } };
  },
};

/* ------------------------------------------------------------------ *
 * 2. Regionales Ranking mit automatischer Radius-Erweiterung
 * ------------------------------------------------------------------ */

export const regionFactor: RankingFactor = {
  key: "region",
  score: (post, ctx): FactorResult => {
    const parts = locationParts(post.region);
    if (parts.length === 0) return { value: FEED_CONFIG.regionLevels.at(-1)?.value ?? 0 };
    const loc = ctx.location;
    const has = (needle?: string) => !!needle && parts.some((p) => p === norm(needle));

    if (has(loc.city)) return { value: 1, detail: { level: "city" } };
    if ((loc.neighborCities ?? []).some((c) => has(c)))
      return { value: 0.82, detail: { level: "neighborCity" } };
    if (has(loc.region)) return { value: 0.68, detail: { level: "region" } };
    if (has(loc.state)) return { value: 0.52, detail: { level: "state" } };
    if (has(loc.country)) return { value: 0.36, detail: { level: "country" } };
    if (has(loc.continent)) return { value: 0.18, detail: { level: "continent" } };
    return { value: 0.06, detail: { level: "world" } };
  },
};

/* ------------------------------------------------------------------ *
 * 3. SlangTag-Qualität – Hörverhalten wiegt schwerer als Reichweite
 * ------------------------------------------------------------------ */

export const slangQualityFactor: RankingFactor = {
  key: "slangQuality",
  score: (post): FactorResult => {
    const q = post.slangQuality;
    if (!q || q.plays <= 0) return { value: 0 };

    const completionRate = clamp01(q.completions / Math.max(1, q.plays));
    const listenRate = q.durationSeconds > 0 ? clamp01(q.avgListenSeconds / q.durationSeconds) : 0;
    const repeatRate = clamp01(q.repeats / Math.max(1, q.plays));
    const engagement = clamp01(
      (q.likes + q.comments * 1.4 + q.shares * 1.5 + q.saves * 1.6 + q.upvotes) /
        Math.max(4, q.plays),
    );
    const afterListen = clamp01(q.profileVisits / Math.max(1, q.plays));
    const reach = saturate(q.plays, 400);

    // Qualität (Hördauer, Vollständigkeit, Engagement) dominiert die Reichweite.
    const value = clamp01(
      0.3 * completionRate +
        0.24 * listenRate +
        0.12 * repeatRate +
        0.2 * engagement +
        0.07 * afterListen +
        0.07 * reach,
    );
    return { value, detail: { completionRate, listenRate } };
  },
};

/* ------------------------------------------------------------------ *
 * 4. Beitragsqualität – schwache Qualität senkt den Score leicht
 * ------------------------------------------------------------------ */

export const postQualityFactor: RankingFactor = {
  key: "postQuality",
  score: (post): FactorResult => {
    const q = post.quality;
    if (!q) return { value: 0.5 };

    const image = q.imagePixels ? clamp01(q.imagePixels / FEED_CONFIG.goodImagePixels) : 0;
    const audio = q.audioKbps ? clamp01(q.audioKbps / FEED_CONFIG.goodAudioKbps) : 0;
    const media = Math.max(image, audio);
    const readability = clamp01(q.descriptionLength / FEED_CONFIG.goodDescriptionLength);
    const metadata = clamp01(
      (q.hasTitle ? 0.4 : 0) + (q.hashtagCount > 0 ? 0.3 : 0) + (q.slangTagCount > 0 ? 0.3 : 0),
    );

    const value = clamp01(0.4 * media + 0.25 * readability + 0.35 * metadata);
    return { value, detail: { media, readability, metadata } };
  },
};

/* ------------------------------------------------------------------ *
 * 5. Aktualität – exponentiell abnehmend mit Untergrenze
 * ------------------------------------------------------------------ */

export const freshnessFactor: RankingFactor = {
  key: "freshness",
  score: (post, _ctx, now): FactorResult => {
    const hours = Math.max(0, (now - post.createdAt) / 3_600_000);
    const decayed = Math.pow(0.5, hours / FEED_CONFIG.freshnessHalfLifeHours);
    // Sehr gute alte Beiträge bleiben durch die Untergrenze langfristig sichtbar.
    const value = clamp01(FEED_CONFIG.freshnessFloor + (1 - FEED_CONFIG.freshnessFloor) * decayed);
    return { value, detail: { hours } };
  },
};

/* ------------------------------------------------------------------ *
 * 6. Startbonus für neue Ersteller
 * ------------------------------------------------------------------ */

export const newCreatorFactor: RankingFactor = {
  key: "newCreator",
  score: (post): FactorResult => {
    const a = post.author;
    if (!a) return { value: 0 };
    const youngEnough = a.accountAgeDays <= FEED_CONFIG.newCreatorMaxAgeDays;
    const belowImpressions = a.impressions < FEED_CONFIG.newCreatorMaxImpressions;
    if (!youngEnough || !belowImpressions) return { value: 0 };
    const ageLeft = 1 - clamp01(a.accountAgeDays / FEED_CONFIG.newCreatorMaxAgeDays);
    const reachLeft = 1 - clamp01(a.impressions / FEED_CONFIG.newCreatorMaxImpressions);
    return { value: clamp01(0.5 * ageLeft + 0.5 * reachLeft), detail: { boosted: true } };
  },
};

/* ------------------------------------------------------------------ *
 * 7. Creator-Vertrauen (langfristig)
 * ------------------------------------------------------------------ */

export const creatorTrustFactor: RankingFactor = {
  key: "creatorTrust",
  score: (post): FactorResult => {
    const a = post.author;
    if (!a) return { value: 0.5 };
    const activity = clamp01((a.activeDaysLast30 ?? 0) / 15);
    const deletionRate = clamp01(a.deletedPostCount / Math.max(1, a.postCount));
    const rating = clamp01(a.communityRating ?? 0.5);
    const constructive = saturate(a.commentsWritten ?? 0, 25);
    const violations = clamp01(a.violations / 5);

    const value = clamp01(
      0.25 * activity +
        0.3 * rating +
        0.15 * constructive +
        (a.verified ? 0.1 : 0) +
        0.2 * (1 - deletionRate) -
        0.5 * violations,
    );
    return { value, detail: { deletionRate, violations } };
  },
};

/* ------------------------------------------------------------------ *
 * 8. Spam-Erkennung (Abzug)
 * ------------------------------------------------------------------ */

export type SpamContext = {
  /** Anzahl inhaltsgleicher Uploads desselben Erstellers. */
  duplicateCount?: number;
  /** Uploads des Erstellers in den letzten 24 h. */
  uploadsLast24h?: number;
  /** Wie oft derselbe SlangTag vom Ersteller wiederholt wird. */
  slangRepeatCount?: number;
  /** Heuristik-Flags. */
  clickbait?: boolean;
  artificialEngagement?: boolean;
  copyPaste?: boolean;
  botLike?: boolean;
};

/** Spam-Kontext wird optional am Beitrag mitgeliefert. */
export type RankablePostWithSpam = RankablePost & { spam?: SpamContext };

export const spamFactor: RankingFactor = {
  key: "spam",
  score: (post): FactorResult => {
    const s = (post as RankablePostWithSpam).spam;
    if (!s) return { value: 0 };
    let penalty = 0;
    penalty += clamp01((s.duplicateCount ?? 0) / 3) * 0.3;
    penalty += clamp01((s.uploadsLast24h ?? 0) / FEED_CONFIG.spamMaxPostsPerDay) * 0.2;
    penalty += clamp01((s.slangRepeatCount ?? 0) / FEED_CONFIG.spamSlangRepeatLimit) * 0.15;
    if (s.clickbait) penalty += 0.15;
    if (s.artificialEngagement) penalty += 0.25;
    if (s.copyPaste) penalty += 0.15;
    if (s.botLike) penalty += 0.3;
    return { value: -clamp01(penalty), detail: { penalty } };
  },
};

/* ------------------------------------------------------------------ *
 * 9. Gelernte Präferenzen (lernender Algorithmus, gedeckelt)
 * ------------------------------------------------------------------ */

export const learnedFactor: RankingFactor = {
  key: "learned",
  score: (post, ctx): FactorResult => {
    const keys = [
      `author:${norm(post.authorId)}`,
      ...(post.topics ?? []).map((t) => `topic:${norm(t)}`),
      // Getrennte Namensräume: Hashtags und SlangTags lernen unabhängig.
      ...post.hashtags.map((t) => `hashtag:${normHashtag(t)}`),
      ...post.slangTagIds.map((t) => `slang:${norm(t)}`),
      ...locationParts(post.region).map((r) => `region:${r}`),
      post.language ? `language:${norm(post.language)}` : "",
      `media:${post.mediaType}`,
    ].filter(Boolean);

    let sum = 0;
    let count = 0;
    for (const key of keys) {
      const weight = ctx.learned[key];
      if (weight === undefined) continue;
      sum += weight;
      count += 1;
    }
    if (count === 0) return { value: 0 };
    // Deckelung: gelernte Signale ergänzen die freiwilligen Interessen, ersetzen sie nie.
    const avg = sum / count;
    const capped = Math.max(-1, Math.min(1, avg)) * FEED_CONFIG.learning.influenceCap;
    return { value: capped, detail: { avg } };
  },
};

/* ------------------------------------------------------------------ *
 * 10. Negative Nutzerwünsche ("Kein Interesse", Stumm, Blockiert)
 * ------------------------------------------------------------------ */

export const mutedFactor: RankingFactor = {
  key: "muted",
  score: (post, ctx): FactorResult => {
    const authorMuted = ctx.muted.authorIds.includes(post.authorId);
    const terms = mutableTerms(post);
    const topicMuted = ctx.muted.topics.some((topic) => terms.has(norm(topic)));
    if (!authorMuted && !topicMuted) return { value: 0 };
    return { value: -1, detail: { authorMuted, topicMuted } };
  },
};

/* ------------------------------------------------------------------ *
 * 11. Feiner Zufallsanteil (kein chronologisches Ranking)
 * ------------------------------------------------------------------ */

export const jitterFactor: RankingFactor = {
  key: "jitter",
  score: (post, ctx): FactorResult => ({
    value: hashUnit(`${ctx.userId}:${post.id}`),
  }),
};

/** Registrierte Standardmodule – Reihenfolge ist irrelevant. */
export const DEFAULT_FACTORS: RankingFactor[] = [
  interestFactor,
  hashtagFactor,
  slangAffinityFactor,
  regionFactor,
  slangQualityFactor,
  postQualityFactor,
  freshnessFactor,
  newCreatorFactor,
  creatorTrustFactor,
  spamFactor,
  learnedFactor,
  mutedFactor,
  jitterFactor,
];
