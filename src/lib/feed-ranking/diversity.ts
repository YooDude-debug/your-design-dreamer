/**
 * Diversity-/Re-Ranking-Schicht des Feed-Algorithmus.
 *
 * Ablauf:  Beiträge laden → Ranking (Score) → **Diversity** → Feed
 *
 * Grundsatz: Der bestehende Relevanzscore bleibt die Grundlage. Diese Schicht
 * verschiebt lediglich Beiträge innerhalb eines begrenzten Kandidatenfensters,
 * damit keine monotonen Folgen entstehen (immer derselbe Autor, Channel,
 * Medientyp oder Themenblock). Es wird nichts gemischt und nichts gewürfelt:
 * jede Verschiebung ist eine kleine, gedeckelte Strafe auf den Score.
 *
 * Alle Gewichte liegen zentral in `FEED_CONFIG.diversity`.
 */

import { FEED_CONFIG } from "./config";
import type { FeedViewerContext, RankablePost, ScoredPost } from "./types";
import { hashUnit, locationParts, norm } from "./utils";

const D = FEED_CONFIG.diversity;

/** Merkmale eines Beitrags, auf die sich Wiederholungsstrafen beziehen. */
type Facets = {
  author: string;
  channel: string;
  topic: string;
  region: string;
  media: string;
  slang: string;
};

/** Feinerer Medientyp als das reine Ranking-Feld (visuelle Variation). */
function mediaFacet(post: RankablePost) {
  if (post.hasVideo) return "video";
  if (post.mediaType === "image" && (post.imageCount ?? 1) > 1) return "gallery";
  return post.mediaType;
}

function facetsOf(post: RankablePost): Facets {
  return {
    author: norm(post.authorId),
    channel: norm(post.channelId ?? ""),
    topic: norm((post.topics ?? post.hashtags)[0] ?? ""),
    region: locationParts(post.region)[0] ?? "",
    media: mediaFacet(post),
    slang: post.slangTagIds.length > 0 ? "slang" : "plain",
  };
}

/**
 * Abklingende Wiederholungsstrafe: direkt hintereinander wirkt sie voll,
 * mit zunehmendem Abstand läuft sie linear auf 0 zu.
 */
function repeatPenalty(distance: number | undefined, window: number, weight: number) {
  if (distance === undefined || distance >= window) return 0;
  return weight * (1 - distance / window);
}

/** Beiträge mit hoher Interaktion sollen den Feed nicht als Block dominieren. */
function isViral(item: ScoredPost) {
  const engagement = item.breakdown["engagement"] ?? 0;
  return engagement >= D.viralEngagementPoints;
}

export type DiversityInput = {
  scored: ScoredPost[];
  byId: Map<string, RankablePost>;
  ctx?: FeedViewerContext;
};

/**
 * Ordnet bereits bewertete Beiträge so an, dass Relevanz erhalten bleibt,
 * monotone Muster aber aufgebrochen werden.
 */
export function applyFeedDiversity(input: DiversityInput): ScoredPost[] {
  const { scored, byId, ctx } = input;
  const pool = [...scored].sort((a, b) => b.score - a.score);
  if (pool.length < 3) return pool;

  // Strafen wirken relativ zur Spanne INNERHALB des Kandidatenfensters.
  // Dadurch passt sich die Wirkung automatisch an: liegen die Kandidaten dicht
  // beieinander, genügt eine kleine Strafe; ist ein Beitrag klar relevanter,
  // bleibt er trotz Strafe vorne.
  const seen = new Set(ctx?.recentlySeenIds ?? []);
  const seed = ctx ? `${ctx.userId}:${ctx.sessionSeed ?? ""}` : "";

  const last = {
    author: new Map<string, number>(),
    channel: new Map<string, number>(),
    topic: new Map<string, number>(),
    region: new Map<string, number>(),
    media: new Map<string, number>(),
    slang: new Map<string, number>(),
  };
  let viralStreak = 0;

  const out: ScoredPost[] = [];
  while (pool.length > 0) {
    const pos = out.length;
    // Nur ein begrenztes Fenster wird betrachtet – ein deutlich schwächerer
    // Beitrag kann dadurch niemals nach oben springen (kein Chaos, O(n·k)).
    const windowSize = Math.min(pool.length, D.candidateWindow);
    const localSpan = Math.max(0.5, pool[0].score - pool[windowSize - 1].score);
    const scale = localSpan * D.penaltyScale;
    let bestIndex = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < windowSize; i += 1) {
      const item = pool[i];
      const post = byId.get(item.postId);
      let value = item.score;
      if (post) {
        const f = facetsOf(post);
        let penalty = 0;
        penalty += repeatPenalty(
          pos - (last.author.get(f.author) ?? -999),
          D.authorWindow,
          D.authorPenalty,
        );
        if (f.channel)
          penalty += repeatPenalty(
            pos - (last.channel.get(f.channel) ?? -999),
            D.channelWindow,
            D.channelPenalty,
          );
        if (f.topic)
          penalty += repeatPenalty(
            pos - (last.topic.get(f.topic) ?? -999),
            D.topicWindow,
            D.topicPenalty,
          );
        if (f.region)
          penalty += repeatPenalty(
            pos - (last.region.get(f.region) ?? -999),
            D.regionWindow,
            D.regionPenalty,
          );
        penalty += repeatPenalty(
          pos - (last.media.get(f.media) ?? -999),
          D.mediaWindow,
          D.mediaPenalty,
        );
        penalty += repeatPenalty(
          pos - (last.slang.get(f.slang) ?? -999),
          D.slangWindow,
          D.slangPenalty,
        );

        // Bereits ganz oben gesehene Beiträge nicht erneut als Erstes zeigen.
        if (seen.has(item.postId) && pos < D.seenTopPositions) penalty += D.seenPenalty;

        // Virale Blöcke auflösen (Interaktion bleibt Signal, dominiert aber nicht).
        if (viralStreak >= D.viralStreakLimit && isViral(item)) penalty += D.viralStreakPenalty;

        // Gedeckelt: kein Beitrag kann durch Vielfalt beliebig weit fallen.
        value -= Math.min(penalty * scale, localSpan * D.maxPenaltyShare);

        // Entdeckung: junge SlangTag-Beiträge mit wenigen Wiedergaben dürfen
        // gelegentlich etwas höher erscheinen (Kernfeature sichtbar halten).
        const plays = post.slangQuality?.plays ?? 0;
        if (post.slangTagIds.length > 0 && plays <= D.slangDiscoveryMaxPlays) {
          value += D.slangDiscoveryBoost * scale;
        }

        // Sehr kleine, deterministische Session-Variation: bei nahezu gleich
        // bewerteten Kandidaten entscheidet sie, wer zuerst kommt.
        if (seed) value += (hashUnit(`${seed}:${item.postId}`) - 0.5) * D.variationJitter * scale;
      }
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }

    const [picked] = pool.splice(bestIndex, 1);
    out.push(picked);
    const post = byId.get(picked.postId);
    if (post) {
      const f = facetsOf(post);
      last.author.set(f.author, pos);
      if (f.channel) last.channel.set(f.channel, pos);
      if (f.topic) last.topic.set(f.topic, pos);
      if (f.region) last.region.set(f.region, pos);
      last.media.set(f.media, pos);
      last.slang.set(f.slang, pos);
    }
    viralStreak = isViral(picked) ? viralStreak + 1 : 0;
  }

  return out;
}
