/**
 * Kern des Feed-Algorithmus 2.0.
 *
 * Aufgaben:
 *  - Beiträge über registrierte Module bewerten (modular, erweiterbar)
 *  - Vielfalt sicherstellen (Autor, Thema, Region, Medientyp)
 *  - Exploration (10–20 %) mit Personalisierung mischen
 *
 * Der Feed ist niemals chronologisch: die Reihenfolge ergibt sich
 * ausschließlich aus dem Score plus Vielfalt-/Explorationsregeln.
 */

import { FEED_CONFIG, FEED_WEIGHTS, type FeedWeightKey } from "./config";
import { applyFeedDiversity } from "./diversity";
import { DEFAULT_FACTORS } from "./factors";
import type { FeedViewerContext, RankablePost, RankingFactor, ScoredPost } from "./types";
import { hashUnit } from "./utils";

/** Gewicht eines Moduls; unbekannte Module wirken mit Gewicht 1. */
function weightFor(key: string) {
  return (FEED_WEIGHTS as Record<string, number>)[key as FeedWeightKey] ?? 1;
}

/** Bewertet einen einzelnen Beitrag. Reine Funktion → leicht testbar. */
export function scorePost(
  post: RankablePost,
  ctx: FeedViewerContext,
  factors: RankingFactor[] = DEFAULT_FACTORS,
  now = Date.now(),
): ScoredPost {
  const breakdown: Record<string, number> = {};
  let total = 0;
  for (const factor of factors) {
    const result = factor.score(post, ctx, now);
    const points = result.value * weightFor(factor.key);
    breakdown[factor.key] = Number(points.toFixed(3));
    total += points;
  }
  return { postId: post.id, score: Number(total.toFixed(3)), breakdown, exploration: false };
}

/** Bewertet eine Liste von Beiträgen (ohne Sortierung). */
export function scorePosts(
  posts: RankablePost[],
  ctx: FeedViewerContext,
  factors: RankingFactor[] = DEFAULT_FACTORS,
  now = Date.now(),
): ScoredPost[] {
  return posts.map((post) => scorePost(post, ctx, factors, now));
}

/**
 * Mischt das Explorations-Kontingent ein: weniger bekannte oder
 * schlechter passende Beiträge erhalten feste Plätze im Feed.
 */
function injectExploration(
  ranked: ScoredPost[],
  ctx: FeedViewerContext,
  byId: Map<string, RankablePost>,
): ScoredPost[] {
  const share = FEED_CONFIG.explorationShare;
  const slots = Math.floor(ranked.length * share);
  if (slots <= 0 || ranked.length < 6) return ranked;

  const cut = Math.floor(ranked.length * FEED_CONFIG.personalizedShare);
  const head = ranked.slice(0, cut);
  const tail = ranked.slice(cut);
  if (tail.length === 0) return ranked;

  // Kandidaten deterministisch, aber nutzerspezifisch ziehen.
  const candidates = tail
    .map((item) => ({ item, roll: hashUnit(`${ctx.userId}:explore:${item.postId}`) }))
    .sort((a, b) => b.roll - a.roll)
    .slice(0, slots)
    .map(({ item }) => ({ ...item, exploration: true }));

  const chosen = new Set(candidates.map((c) => c.postId));
  const rest = tail.filter((item) => !chosen.has(item.postId));

  const out: ScoredPost[] = [];
  const step = Math.max(2, Math.floor(head.length / Math.max(1, candidates.length)));
  let ci = 0;
  head.forEach((item, index) => {
    out.push(item);
    if (index > 0 && index % step === 0 && ci < candidates.length) {
      out.push(candidates[ci]);
      ci += 1;
    }
  });
  while (ci < candidates.length) out.push(candidates[ci++]);
  out.push(...rest);

  // Doppelte defensiv entfernen (falls Slots kollidieren).
  const seen = new Set<string>();
  return out.filter((item) => {
    if (seen.has(item.postId) || !byId.has(item.postId)) return false;
    seen.add(item.postId);
    return true;
  });
}

export type RankFeedInput = {
  posts: RankablePost[];
  ctx: FeedViewerContext;
  factors?: RankingFactor[];
  now?: number;
  /** Lazy Loading: Anzahl gewünschter Beiträge. */
  limit?: number;
  offset?: number;
};

/** Vollständige Feed-Berechnung: Score → Vielfalt → Exploration → Seite. */
export function rankFeed(input: RankFeedInput): ScoredPost[] {
  const { posts, ctx } = input;
  const factors = input.factors ?? DEFAULT_FACTORS;
  const now = input.now ?? Date.now();
  const byId = new Map(posts.map((p) => [p.id, p]));

  const scored = scorePosts(posts, ctx, factors, now);
  const arranged = applyFeedDiversity({ scored, byId, ctx });
  const withExploration = injectExploration(arranged, ctx, byId);

  const offset = input.offset ?? 0;
  const limit = input.limit ?? withExploration.length;
  return withExploration.slice(offset, offset + limit);
}

/** Bequemer Helfer: gibt die Beiträge selbst in Ranking-Reihenfolge zurück. */
export function rankPosts<T extends RankablePost>(
  posts: T[],
  ctx: FeedViewerContext,
  options: Omit<RankFeedInput, "posts" | "ctx"> = {},
): T[] {
  const byId = new Map(posts.map((p) => [p.id, p]));
  return rankFeed({ posts, ctx, ...options })
    .map((item) => byId.get(item.postId))
    .filter((p): p is T => !!p);
}
