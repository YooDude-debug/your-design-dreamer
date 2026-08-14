/**
 * Feed-Algorithmus 2.0 – serverseitige Datenlogik.
 *
 * Arbeitet ausschließlich mit einem übergebenen Supabase-Client (RLS gilt als
 * angemeldeter Nutzer). Es werden nur Interaktionen gespeichert, die innerhalb
 * von Y-Dude entstehen – keine Nachrichteninhalte, keine Fremddaten.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { FEED_CONFIG } from "./config";
import { applyDelta, deltasForSignal, isSuppressSignal, signalValue } from "./learning";
import type { FeedSignalInput, FeedViewerContext, ScoredPost } from "./types";

export type DB = SupabaseClient<Database>;

/* ------------------------------------------------------------------ */
/* Gelernte Gewichte                                                   */
/* ------------------------------------------------------------------ */

/** Lädt alle gelernten Gewichte des Nutzers als Schlüssel → Gewicht. */
export async function loadLearnedWeights(db: DB, userId: string): Promise<Record<string, number>> {
  const { data, error } = await db
    .from("feed_learned_weights")
    .select("key, weight")
    .eq("user_id", userId);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of data ?? []) out[row.key] = Number(row.weight);
  return out;
}

/**
 * Verarbeitet ein Signal: Rohsignal protokollieren und die betroffenen
 * gelernten Gewichte anpassen. Fehler einzelner Schritte blockieren den Feed
 * nie – das Signal ist eine Nebenwirkung, keine Voraussetzung.
 */
export async function recordSignal(db: DB, userId: string, input: FeedSignalInput) {
  const value = signalValue(input.signal, input.dwellMs);

  const { error: insertError } = await db.from("feed_signals").insert({
    user_id: userId,
    post_id: input.postId ?? null,
    author_id: input.authorId ?? null,
    signal: input.signal,
    value,
    dwell_ms: Math.max(0, Math.round(input.dwellMs ?? 0)),
  });
  if (insertError) throw insertError;

  const deltas = deltasForSignal(input);
  if (deltas.length === 0) return { ok: true, updated: 0 };

  const keys = deltas.map((d) => d.key);
  const { data: existing } = await db
    .from("feed_learned_weights")
    .select("key, weight, events_count")
    .eq("user_id", userId)
    .in("key", keys);

  const byKey = new Map((existing ?? []).map((row) => [row.key, row]));
  const rows = deltas.map((delta) => {
    const current = byKey.get(delta.key);
    return {
      user_id: userId,
      key: delta.key,
      weight: applyDelta(Number(current?.weight ?? 0), delta.delta),
      events_count: (current?.events_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await db
    .from("feed_learned_weights")
    .upsert(rows, { onConflict: "user_id,key" });
  if (error) throw error;

  // "Kein Interesse" wirkt sofort: der Score-Cache wird verworfen.
  if (isSuppressSignal(input.signal)) await clearScoreCache(db, userId);
  return { ok: true, updated: rows.length };
}

/**
 * Mehrere Signale in einem Durchgang verarbeiten (Batch).
 *
 * Fachlich identisch zu mehrfachem `recordSignal`, nur ohne die vielen
 * Einzelabfragen: alle Rohsignale werden mit einem INSERT geschrieben, die
 * Gewichtsänderungen je Schlüssel vorher im Speicher zusammengefasst und mit
 * einem einzigen UPSERT gespeichert. Das vermeidet zugleich, dass sich zwei
 * Änderungen am selben Schlüssel innerhalb eines Aufrufs überschreiben.
 */
export async function recordSignals(db: DB, userId: string, inputs: FeedSignalInput[]) {
  const list = inputs.slice(0, 50);
  if (list.length === 0) return { ok: true, updated: 0 };

  const rows = list.map((input) => ({
    user_id: userId,
    post_id: input.postId ?? null,
    author_id: input.authorId ?? null,
    signal: input.signal,
    value: signalValue(input.signal, input.dwellMs),
    dwell_ms: Math.max(0, Math.round(input.dwellMs ?? 0)),
  }));

  // Änderungen je Schlüssel aufaddieren (Reihenfolge bleibt erhalten).
  const summed = new Map<string, { delta: number; events: number }>();
  for (const input of list) {
    for (const delta of deltasForSignal(input)) {
      const current = summed.get(delta.key) ?? { delta: 0, events: 0 };
      summed.set(delta.key, { delta: current.delta + delta.delta, events: current.events + 1 });
    }
  }

  const keys = [...summed.keys()];
  // Rohsignale schreiben und aktuelle Gewichte lesen – voneinander unabhängig.
  const [insert, existing] = await Promise.all([
    db.from("feed_signals").insert(rows),
    keys.length > 0
      ? db
          .from("feed_learned_weights")
          .select("key, weight, events_count")
          .eq("user_id", userId)
          .in("key", keys)
      : Promise.resolve({ data: [] as { key: string; weight: number; events_count: number }[] }),
  ]);
  if (insert.error) throw insert.error;

  if (keys.length === 0) return { ok: true, updated: 0 };

  const byKey = new Map((existing.data ?? []).map((row) => [row.key, row]));
  const updatedAt = new Date().toISOString();
  const upserts = keys.map((key) => {
    const change = summed.get(key)!;
    const current = byKey.get(key);
    return {
      user_id: userId,
      key,
      weight: applyDelta(Number(current?.weight ?? 0), change.delta),
      events_count: (current?.events_count ?? 0) + change.events,
      updated_at: updatedAt,
    };
  });

  const { error } = await db
    .from("feed_learned_weights")
    .upsert(upserts, { onConflict: "user_id,key" });
  if (error) throw error;

  if (list.some((input) => isSuppressSignal(input.signal))) await clearScoreCache(db, userId);
  return { ok: true, updated: upserts.length };
}


/* ------------------------------------------------------------------ */
/* Score-Cache (Performance)                                           */
/* ------------------------------------------------------------------ */

/** Liest gültige, vorberechnete Scores (TTL aus der Konfiguration). */
export async function loadScoreCache(db: DB, userId: string): Promise<Record<string, number>> {
  const since = new Date(Date.now() - FEED_CONFIG.scoreCacheTtlSeconds * 1000).toISOString();
  const { data, error } = await db
    .from("feed_score_cache")
    .select("post_id, score")
    .eq("user_id", userId)
    .gte("computed_at", since);
  if (error) return {};
  const out: Record<string, number> = {};
  for (const row of data ?? []) out[row.post_id] = Number(row.score);
  return out;
}

/** Schreibt berechnete Scores in den Cache (best effort). */
export async function saveScoreCache(db: DB, userId: string, scored: ScoredPost[]) {
  if (scored.length === 0) return;
  const computedAt = new Date().toISOString();
  await db.from("feed_score_cache").upsert(
    scored.map((item) => ({
      user_id: userId,
      post_id: item.postId,
      score: item.score,
      breakdown: item.breakdown,
      computed_at: computedAt,
    })),
    { onConflict: "user_id,post_id" },
  );
}

export async function clearScoreCache(db: DB, userId: string) {
  await db.from("feed_score_cache").delete().eq("user_id", userId);
}

/* ------------------------------------------------------------------ */
/* Nutzerkontext                                                       */
/* ------------------------------------------------------------------ */

/**
 * Baut den Ranking-Kontext des Nutzers: freiwillige Interessen, Standortkette,
 * Sprachen, Gefolgte und gelernte Gewichte.
 */
export async function loadViewerContext(db: DB, userId: string): Promise<FeedViewerContext> {
  const [prefs, profile, follows, learned, hashtagFollows, hashtagTrends, connections] =
    await Promise.all([
      db.from("ad_preferences").select("interests").eq("user_id", userId).maybeSingle(),
      db.from("profiles").select("location, language").eq("id", userId).maybeSingle(),
      db.from("follows").select("following_id").eq("follower_id", userId).limit(1000),
      loadLearnedWeights(db, userId),
      // Hashtag-System: eigene Tabellen, eigenes Signal.
      db.from("hashtag_follows").select("hashtags(tag)").eq("user_id", userId).limit(200),
      db.rpc("trending_hashtags", { _days: 7, _limit: 25 }),
      // Connections: bestätigte Verbindungen in beide Richtungen.
      db
        .from("connections")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .limit(1000),
    ]);

  const parts = (profile.data?.location ?? "")
    .split(/[,/|]/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    userId,
    interests: (prefs.data?.interests ?? []).map((value) => ({
      value,
      kind: "category" as const,
      weight: 1,
    })),
    location: {
      city: parts[0],
      region: parts.length > 2 ? parts[1] : undefined,
      country: parts.at(-1),
    },
    languages: profile.data?.language ? [profile.data.language] : [],
    followingIds: (follows.data ?? []).map((row) => row.following_id),
    connectionIds: [
      ...new Set(
        (connections.data ?? [])
          .map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id))
          .filter((id): id is string => !!id && id !== userId),
      ),
    ],

    followedHashtags: (hashtagFollows.data ?? [])
      .map((row) => (row.hashtags as { tag: string } | null)?.tag ?? "")
      .filter(Boolean),
    trendingHashtags: (hashtagTrends.data ?? []).map((row) => row.tag),
    learned,
    // Negative Gewichte gelten als "Kein Interesse" und blenden Inhalte aus.
    muted: {
      authorIds: Object.entries(learned)
        .filter(([key, weight]) => key.startsWith("author:") && weight <= -0.9)
        .map(([key]) => key.slice("author:".length)),
      topics: Object.entries(learned)
        .filter(([key, weight]) => key.startsWith("topic:") && weight <= -0.9)
        .map(([key]) => key.slice("topic:".length)),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Datenschutz: Algorithmus zurücksetzen                               */
/* ------------------------------------------------------------------ */

/**
 * Löscht alle gelernten Gewichte, Rohsignale und zwischengespeicherten Scores
 * des Nutzers. Beiträge, Likes, Kommentare, Follower und die freiwillig
 * gewählten Interessen bleiben unberührt.
 */
export async function resetFeedAlgorithm(db: DB, userId: string) {
  const [weights, signals] = await Promise.all([
    db.from("feed_learned_weights").delete().eq("user_id", userId),
    db.from("feed_signals").delete().eq("user_id", userId),
  ]);
  await clearScoreCache(db, userId);
  if (weights.error) throw weights.error;
  if (signals.error) throw signals.error;
  return { ok: true, resetAt: new Date().toISOString() };
}
