/**
 * Hashtag-System – serverseitige Datenlogik.
 *
 * Hashtags (#) beantworten die Frage "Worum geht der Beitrag?" und besitzen
 * eigene Tabellen (`hashtags`, `post_hashtags`, `hashtag_follows`), eigene
 * Indizes, eigene Trendliste und eigene Ranking-Signale. Das SlangTag-System
 * ($) bleibt davon vollständig getrennt – die beiden Systeme werden nie
 * vermischt und ersetzen sich nie gegenseitig.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type DB = SupabaseClient<Database>;

export type HashtagSummary = { tag: string; postsCount: number };
export type HashtagTrend = HashtagSummary & {
  recentPosts: number;
  engagement: number;
  score: number;
};
export type HashtagPage = {
  tag: string;
  postsCount: number;
  postIds: string[];
  following: boolean;
};

/** Vereinheitlicht einen Hashtag: ohne "#", getrimmt, klein geschrieben. */
export function normalizeHashtag(value: string) {
  return value.trim().replace(/^#+/, "").toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Suche und Trends                                                    */
/* ------------------------------------------------------------------ */

/** Indexgestützte Hashtag-Suche (eigene Suche, unabhängig von SlangTags). */
export async function searchHashtags(db: DB, q: string, limit = 20): Promise<HashtagSummary[]> {
  const { data, error } = await db.rpc("search_hashtags", {
    _q: normalizeHashtag(q ?? ""),
    _limit: Math.min(Math.max(limit, 1), 50),
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({ tag: row.tag, postsCount: row.posts_count }));
}

/**
 * Trending-Hashtags eines Zeitraums (eigene Trendliste).
 * Die Liste ist für alle Nutzer identisch und wird deshalb serverseitig
 * 60 Sekunden zwischengespeichert.
 */
export async function getTrendingHashtags(db: DB, days = 7, limit = 10): Promise<HashtagTrend[]> {
  const safeDays = Math.min(Math.max(days, 1), 90);
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const { cachedRead } = await import("@/lib/server-cache.server");
  return cachedRead(`hashtag-trends:${safeDays}:${safeLimit}`, async () => {
    const { data, error } = await db.rpc("trending_hashtags", {
      _days: safeDays,
      _limit: safeLimit,
    });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      tag: row.tag,
      postsCount: row.posts_count,
      recentPosts: row.recent_posts,
      engagement: row.engagement,
      score: Number(row.score),
    }));
  });
}

/* ------------------------------------------------------------------ */
/* Hashtag-Seite                                                       */
/* ------------------------------------------------------------------ */

/**
 * Alle für den Nutzer sichtbaren Beiträge eines Hashtags – über den Index,
 * nicht über einen Textscan der Beiträge.
 */
export async function getHashtagPage(
  db: DB,
  userId: string,
  tag: string,
  limit = 60,
): Promise<HashtagPage> {
  const normalized = normalizeHashtag(tag);
  const { data: row } = await db
    .from("hashtags")
    .select("id, tag, posts_count")
    .eq("tag", normalized)
    .maybeSingle();

  if (!row) return { tag: normalized, postsCount: 0, postIds: [], following: false };

  const [{ data: links }, { data: follow }] = await Promise.all([
    db
      .from("post_hashtags")
      .select("post_id, created_at")
      .eq("hashtag_id", row.id)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200)),
    db
      .from("hashtag_follows")
      .select("hashtag_id")
      .eq("user_id", userId)
      .eq("hashtag_id", row.id)
      .maybeSingle(),
  ]);

  return {
    tag: row.tag,
    postsCount: row.posts_count,
    postIds: (links ?? []).map((link) => link.post_id),
    following: Boolean(follow),
  };
}

/* ------------------------------------------------------------------ */
/* Gefolgte Hashtags (eigenes Ranking-Signal)                          */
/* ------------------------------------------------------------------ */

export async function listFollowedHashtags(db: DB, userId: string): Promise<string[]> {
  const { data } = await db
    .from("hashtag_follows")
    .select("hashtags(tag)")
    .eq("user_id", userId)
    .limit(200);
  return (data ?? [])
    .map((row) => (row.hashtags as { tag: string } | null)?.tag ?? "")
    .filter(Boolean);
}

export async function setHashtagFollow(db: DB, userId: string, tag: string, follow: boolean) {
  const normalized = normalizeHashtag(tag);
  const { data: row } = await db
    .from("hashtags")
    .select("id")
    .eq("tag", normalized)
    .maybeSingle();
  if (!row) return { ok: false, following: false };

  if (follow) {
    const { error } = await db
      .from("hashtag_follows")
      .upsert({ user_id: userId, hashtag_id: row.id }, { onConflict: "user_id,hashtag_id" });
    if (error) throw error;
  } else {
    const { error } = await db
      .from("hashtag_follows")
      .delete()
      .eq("user_id", userId)
      .eq("hashtag_id", row.id);
    if (error) throw error;
  }
  return { ok: true, following: follow };
}
