/**
 * Interest Engine – serverseitige Datenlogik.
 *
 * Arbeitet ausschließlich mit einem übergebenen Supabase-Client (RLS gilt als
 * angemeldeter Nutzer). Keine UI-Abhängigkeiten. Nur Daten, die innerhalb von
 * Y-Dude entstehen; Nachrichteninhalte werden nie gelesen oder gespeichert.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildConfig, type EngineConfig } from "./config";
import {
  aggregateConnectionInfluence,
  buildProfile,
  connectionStrength,
  decayScore,
  evaluatePromotion,
  isSameUtcDay,
  nextConfidence,
  pointsForAction,
  scoreContent,
} from "./scoring";
import type {
  ConfidenceRow,
  ConnectionInfluenceRow,
  ContentType,
  InteractionInput,
  InterestCategory,
  InterestProfile,
  InterestProfileEntry,
  Recommendation,
} from "./types";

export type DB = SupabaseClient<Database>;

/* ------------------------------------------------------------------ */
/* Caching (pro Worker-Instanz, TTL-basiert – vorbereitet für Skalierung) */
/* ------------------------------------------------------------------ */

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await load();
  cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return value;
}

export function invalidateInterestCache(userId?: string) {
  if (!userId) return cache.clear();
  for (const key of [...cache.keys()]) if (key.includes(userId)) cache.delete(key);
}

/* ------------------------------------------------------------------ */
/* Stammdaten                                                          */
/* ------------------------------------------------------------------ */

/**
 * Tuning-Parameter der Engine.
 *
 * Diese Werte sind interne Ranking-Parameter und für Nutzer nicht lesbar
 * (RLS: nur Administratoren). Sie werden daher serverseitig mit dem
 * Service-Client geladen; bei fehlenden Werten greifen die Standardwerte
 * aus `buildConfig`. Der übergebene Nutzer-Client wird hier absichtlich
 * nicht verwendet.
 */
export async function loadConfig(_sb: DB): Promise<EngineConfig> {
  return cached("config", 300, async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("interest_engine_config").select("key,value");
    return buildConfig((data ?? []).map((r) => ({ key: r.key, value: Number(r.value) })));
  });
}


export async function loadCategories(sb: DB): Promise<InterestCategory[]> {
  return cached("categories", 600, async () => {
    const { data } = await sb
      .from("interest_categories")
      .select("id,slug,name,kind,parent_id,active")
      .eq("active", true);
    return (data ?? []).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      kind: r.kind,
      parentId: r.parent_id,
      active: r.active,
    }));
  });
}

/** Kategorien eines Inhalts auflösen. */
export async function getContentCategories(sb: DB, contentType: ContentType, contentIds: string[]) {
  if (contentIds.length === 0) return [];
  const { data } = await sb
    .from("content_categories")
    .select("content_id,category_id,weight")
    .eq("content_type", contentType)
    .in("content_id", contentIds);
  return (data ?? []).map((r) => ({
    contentId: r.content_id,
    categoryId: r.category_id,
    weight: Number(r.weight),
  }));
}

/** Kategorien für einen Inhalt setzen (idempotent). */
export async function setContentCategories(
  sb: DB,
  params: {
    contentType: ContentType;
    contentId: string;
    ownerId: string;
    categoryIds: string[];
    source?: string;
  },
) {
  await sb
    .from("content_categories")
    .delete()
    .eq("content_type", params.contentType)
    .eq("content_id", params.contentId);
  if (params.categoryIds.length === 0) return { ok: true, count: 0 };
  const { error } = await sb.from("content_categories").insert(
    params.categoryIds.map((categoryId) => ({
      content_type: params.contentType,
      content_id: params.contentId,
      category_id: categoryId,
      owner_id: params.ownerId,
      source: params.source ?? "manual",
    })),
  );
  if (error) throw error;
  return { ok: true, count: params.categoryIds.length };
}

/* ------------------------------------------------------------------ */
/* Grundinteressen (80 %)                                              */
/* ------------------------------------------------------------------ */

export async function setBaseInterests(
  sb: DB,
  userId: string,
  categoryIds: string[],
  baseScore = 100,
) {
  await sb.from("user_interests").delete().eq("user_id", userId);
  if (categoryIds.length > 0) {
    const { error } = await sb
      .from("user_interests")
      .insert(
        categoryIds.map((id) => ({ user_id: userId, category_id: id, base_score: baseScore })),
      );
    if (error) throw error;
  }
  invalidateInterestCache(userId);
  return { ok: true, count: categoryIds.length };
}

async function loadBaseInterests(sb: DB, userId: string) {
  const { data } = await sb
    .from("user_interests")
    .select("category_id,base_score")
    .eq("user_id", userId);
  return (data ?? []).map((r) => ({ categoryId: r.category_id, baseScore: Number(r.base_score) }));
}

/* ------------------------------------------------------------------ */
/* Interaktionen erfassen                                              */
/* ------------------------------------------------------------------ */

async function resolveEventCategories(sb: DB, input: InteractionInput): Promise<string[]> {
  const ids = new Set(input.categoryIds ?? []);
  if (input.contentType && input.contentId) {
    const rows = await getContentCategories(sb, input.contentType, [input.contentId]);
    for (const row of rows) ids.add(row.categoryId);
  }
  return [...ids];
}

/**
 * Zentrale Eintrittsstelle: protokolliert eine Aktion, erhöht die dynamischen
 * Scores und aktualisiert den Confidence Score je Kategorie.
 */
export async function recordInteraction(sb: DB, userId: string, input: InteractionInput) {
  const cfg = await loadConfig(sb);
  const categoryIds = await resolveEventCategories(sb, input);
  const points = pointsForAction(cfg, input.action, input.dwellMs ?? 0);
  const now = Date.now();

  await sb.from("interaction_events").insert(
    (categoryIds.length > 0 ? categoryIds : [null]).map((categoryId) => ({
      user_id: userId,
      action: input.action,
      category_id: categoryId,
      content_type: input.contentType ?? null,
      content_id: input.contentId ?? null,
      peer_id: input.peerId ?? null,
      weight: points,
      dwell_ms: Math.max(0, Math.round(input.dwellMs ?? 0)),
    })),
  );

  const promoted: string[] = [];
  if (categoryIds.length > 0) {
    const [{ data: scoreRows }, { data: confRows }] = await Promise.all([
      sb
        .from("user_interest_scores")
        .select("*")
        .eq("user_id", userId)
        .in("category_id", categoryIds),
      sb
        .from("interest_confidence")
        .select("*")
        .eq("user_id", userId)
        .in("category_id", categoryIds),
    ]);
    const scoreMap = new Map((scoreRows ?? []).map((r) => [r.category_id, r]));
    const confMap = new Map((confRows ?? []).map((r) => [r.category_id, r]));

    const scoreUpserts = categoryIds.map((categoryId) => {
      const prev = scoreMap.get(categoryId);
      const decayedPrev = prev
        ? decayScore(cfg, Number(prev.dynamic_score), new Date(prev.last_decay_at).getTime(), now)
        : 0;
      return {
        user_id: userId,
        category_id: categoryId,
        dynamic_score: decayedPrev + points,
        events_count: (prev?.events_count ?? 0) + 1,
        last_event_at: new Date(now).toISOString(),
        last_decay_at: new Date(now).toISOString(),
      };
    });

    const confUpserts = categoryIds.map((categoryId) => {
      const prev = confMap.get(categoryId);
      const prevLast = prev?.last_event_at ? new Date(prev.last_event_at).getTime() : null;
      const newDay = prevLast === null || !isSameUtcDay(prevLast, now);
      const base = {
        confidence: Number(prev?.confidence ?? 0),
        viewCount: prev?.view_count ?? 0,
        engageCount: prev?.engage_count ?? 0,
        distinctDays: prev?.distinct_days ?? 0,
      };
      const next = nextConfidence(cfg, base, input.action, newDay);
      const isPromoted = evaluatePromotion(cfg, { ...next, promoted: prev?.promoted ?? false });
      if (isPromoted && !prev?.promoted) promoted.push(categoryId);
      return {
        user_id: userId,
        category_id: categoryId,
        confidence: next.confidence,
        view_count: next.viewCount,
        engage_count: next.engageCount,
        distinct_days: next.distinctDays,
        first_event_at: prev?.first_event_at ?? new Date(now).toISOString(),
        last_event_at: new Date(now).toISOString(),
        promoted: isPromoted,
        promoted_at: isPromoted ? (prev?.promoted_at ?? new Date(now).toISOString()) : null,
      };
    });

    await Promise.all([
      sb.from("user_interest_scores").upsert(scoreUpserts, { onConflict: "user_id,category_id" }),
      sb.from("interest_confidence").upsert(confUpserts, { onConflict: "user_id,category_id" }),
    ]);
  }

  // Messenger/Connections: ausschließlich Häufigkeiten, keine Inhalte.
  if (
    input.peerId &&
    ["message", "connection", "post_like", "post_comment"].includes(input.action)
  ) {
    await bumpConnectionCounter(sb, userId, input.peerId, input.action);
  }

  invalidateInterestCache(userId);
  return { ok: true, points, categoryIds, promotedCategoryIds: promoted };
}

async function bumpConnectionCounter(sb: DB, userId: string, peerId: string, action: string) {
  const { data: prev } = await sb
    .from("connection_influence")
    .select("*")
    .eq("user_id", userId)
    .eq("peer_id", peerId)
    .maybeSingle();
  const row = {
    message_count: (prev?.message_count ?? 0) + (action === "message" ? 1 : 0),
    like_count: (prev?.like_count ?? 0) + (action === "post_like" ? 1 : 0),
    comment_count: (prev?.comment_count ?? 0) + (action === "post_comment" ? 1 : 0),
    shared_interests: prev?.shared_interests ?? 0,
    shared_slang_tags: prev?.shared_slang_tags ?? 0,
  };
  const cfg = await loadConfig(sb);
  await sb.from("connection_influence").upsert(
    {
      user_id: userId,
      peer_id: peerId,
      ...row,
      strength: connectionStrength(cfg, {
        messageCount: row.message_count,
        likeCount: row.like_count,
        commentCount: row.comment_count,
        sharedInterests: row.shared_interests,
        sharedSlangTags: row.shared_slang_tags,
      }),
      last_interaction_at: new Date().toISOString(),
      calculated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,peer_id" },
  );
}

/* ------------------------------------------------------------------ */
/* Veralten / Decay                                                    */
/* ------------------------------------------------------------------ */

/** Lässt alle dynamischen Scores eines Nutzers altern. Grundkern bleibt. */
export async function updateInterestDecay(sb: DB, userId: string) {
  const cfg = await loadConfig(sb);
  const now = Date.now();
  const { data } = await sb.from("user_interest_scores").select("*").eq("user_id", userId);
  const rows = data ?? [];
  if (rows.length === 0) return { ok: true, updated: 0, removed: 0 };

  const keep: typeof rows = [];
  const drop: string[] = [];
  for (const row of rows) {
    const value = decayScore(
      cfg,
      Number(row.dynamic_score),
      new Date(row.last_decay_at).getTime(),
      now,
    );
    if (value <= 0) drop.push(row.category_id);
    else keep.push({ ...row, dynamic_score: value, last_decay_at: new Date(now).toISOString() });
  }
  if (keep.length > 0)
    await sb.from("user_interest_scores").upsert(keep, { onConflict: "user_id,category_id" });
  if (drop.length > 0)
    await sb.from("user_interest_scores").delete().eq("user_id", userId).in("category_id", drop);

  invalidateInterestCache(userId);
  return { ok: true, updated: keep.length, removed: drop.length };
}

/* ------------------------------------------------------------------ */
/* Connections                                                         */
/* ------------------------------------------------------------------ */

/** Berechnet Interaktionsstärke inkl. gemeinsamer Interessen/SlangTags neu. */
export async function calculateConnectionInfluence(sb: DB, userId: string) {
  const cfg = await loadConfig(sb);
  const { data: connections } = await sb
    .from("connections")
    .select("requester_id,addressee_id,status")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  const peerIds = (connections ?? []).map((c) =>
    c.requester_id === userId ? c.addressee_id : c.requester_id,
  );
  if (peerIds.length === 0) return { ok: true, peers: 0 };

  const [{ data: mine }, { data: theirs }, { data: existing }] = await Promise.all([
    sb.from("user_interests").select("category_id").eq("user_id", userId),
    sb.from("user_interests").select("user_id,category_id").in("user_id", peerIds),
    sb.from("connection_influence").select("*").eq("user_id", userId),
  ]);

  const myCats = new Set((mine ?? []).map((r) => r.category_id));
  const peerCats = new Map<string, Set<string>>();
  for (const row of theirs ?? []) {
    if (!peerCats.has(row.user_id)) peerCats.set(row.user_id, new Set());
    peerCats.get(row.user_id)!.add(row.category_id);
  }
  const prevMap = new Map((existing ?? []).map((r) => [r.peer_id, r]));

  const upserts = peerIds.map((peerId) => {
    const prev = prevMap.get(peerId);
    const shared = [...(peerCats.get(peerId) ?? [])].filter((c) => myCats.has(c)).length;
    const counts = {
      messageCount: prev?.message_count ?? 0,
      likeCount: prev?.like_count ?? 0,
      commentCount: prev?.comment_count ?? 0,
      sharedInterests: shared,
      sharedSlangTags: prev?.shared_slang_tags ?? 0,
    };
    return {
      user_id: userId,
      peer_id: peerId,
      message_count: counts.messageCount,
      like_count: counts.likeCount,
      comment_count: counts.commentCount,
      shared_interests: shared,
      shared_slang_tags: counts.sharedSlangTags,
      strength: connectionStrength(cfg, counts),
      last_interaction_at: prev?.last_interaction_at ?? null,
      calculated_at: new Date().toISOString(),
    };
  });

  await sb.from("connection_influence").upsert(upserts, { onConflict: "user_id,peer_id" });
  invalidateInterestCache(userId);
  return { ok: true, peers: upserts.length };
}

async function loadConnectionInfluence(sb: DB, userId: string): Promise<ConnectionInfluenceRow[]> {
  const { data } = await sb
    .from("connection_influence")
    .select("*")
    .eq("user_id", userId)
    .order("strength", { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => ({
    peerId: r.peer_id,
    messageCount: r.message_count,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    sharedInterests: r.shared_interests,
    sharedSlangTags: r.shared_slang_tags,
    strength: Number(r.strength),
  }));
}

/* ------------------------------------------------------------------ */
/* Interessenprofil                                                    */
/* ------------------------------------------------------------------ */

export async function getInterestProfile(sb: DB, userId: string): Promise<InterestProfile> {
  const cfg = await loadConfig(sb);
  const ttl = cfg["cache.profile_ttl_seconds"];
  return cached(`profile:${userId}`, ttl, async () => {
    const [categories, baseInterests, scores, confidences, connections] = await Promise.all([
      loadCategories(sb),
      loadBaseInterests(sb, userId),
      sb.from("user_interest_scores").select("*").eq("user_id", userId),
      sb.from("interest_confidence").select("*").eq("user_id", userId),
      loadConnectionInfluence(sb, userId),
    ]);

    const peerIds = connections
      .filter((c) => c.strength >= cfg["connection.min_strength"])
      .map((c) => c.peerId);
    const peerCategories: Record<string, { categoryId: string; score: number }[]> = {};
    if (peerIds.length > 0) {
      const { data: peerBase } = await sb
        .from("user_interests")
        .select("user_id,category_id,base_score")
        .in("user_id", peerIds);
      for (const row of peerBase ?? []) {
        (peerCategories[row.user_id] ??= []).push({
          categoryId: row.category_id,
          score: Number(row.base_score),
        });
      }
    }

    const entries = buildProfile({
      cfg,
      categories,
      baseInterests,
      dynamicScores: (scores.data ?? []).map((r) => ({
        categoryId: r.category_id,
        dynamicScore: Number(r.dynamic_score),
        eventsCount: r.events_count,
        lastEventAt: r.last_event_at ? new Date(r.last_event_at).getTime() : null,
        lastDecayAt: new Date(r.last_decay_at).getTime(),
      })),
      confidences: (confidences.data ?? []).map<ConfidenceRow>((r) => ({
        categoryId: r.category_id,
        confidence: Number(r.confidence),
        viewCount: r.view_count,
        engageCount: r.engage_count,
        distinctDays: r.distinct_days,
        promoted: r.promoted,
        lastEventAt: r.last_event_at ? new Date(r.last_event_at).getTime() : null,
      })),
      connectionInfluence: aggregateConnectionInfluence(cfg, connections, peerCategories),
    });

    return { userId, entries, computedAt: Date.now(), ttlSeconds: ttl };
  });
}

/** Einzelner Score einer Kategorie – bequemer Zugriff für spätere Module. */
export async function calculateInterestScore(sb: DB, userId: string, categoryId: string) {
  const profile = await getInterestProfile(sb, userId);
  return profile.entries.find((e) => e.categoryId === categoryId)?.score ?? 0;
}

/* ------------------------------------------------------------------ */
/* Empfehlungen (vorbereitet, noch nicht im UI verdrahtet)             */
/* ------------------------------------------------------------------ */

async function rankContent(
  sb: DB,
  entries: InterestProfileEntry[],
  contentType: ContentType,
  limit: number,
): Promise<Recommendation[]> {
  const top = entries.slice(0, 25).map((e) => e.categoryId);
  if (top.length === 0) return [];
  const { data } = await sb
    .from("content_categories")
    .select("content_id,category_id,weight")
    .eq("content_type", contentType)
    .in("category_id", top)
    .limit(limit * 40);

  const grouped = new Map<string, { categoryId: string; weight: number }[]>();
  for (const row of data ?? []) {
    (grouped.get(row.content_id) ?? grouped.set(row.content_id, []).get(row.content_id)!).push({
      categoryId: row.category_id,
      weight: Number(row.weight),
    });
  }

  return [...grouped.entries()]
    .map(([id, cats]) => {
      const { score, matchedCategoryIds } = scoreContent(entries, cats);
      return { id, type: contentType, score, matchedCategoryIds };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function getRecommendedFeed(sb: DB, userId: string, limit?: number) {
  const cfg = await loadConfig(sb);
  const profile = await getInterestProfile(sb, userId);
  return rankContent(sb, profile.entries, "post", limit ?? cfg["recommend.default_limit"]);
}

export async function getRecommendedSlangTags(sb: DB, userId: string, limit?: number) {
  const cfg = await loadConfig(sb);
  const profile = await getInterestProfile(sb, userId);
  return rankContent(sb, profile.entries, "slang_tag", limit ?? cfg["recommend.default_limit"]);
}

export async function getRecommendedAds(sb: DB, userId: string, limit?: number) {
  const cfg = await loadConfig(sb);
  const profile = await getInterestProfile(sb, userId);
  return rankContent(sb, profile.entries, "ad", limit ?? cfg["recommend.default_limit"]);
}

export async function getRecommendedCreators(sb: DB, userId: string, limit?: number) {
  const cfg = await loadConfig(sb);
  const profile = await getInterestProfile(sb, userId);
  const list = await rankContent(
    sb,
    profile.entries,
    "profile",
    (limit ?? cfg["recommend.default_limit"]) + 1,
  );
  return list.filter((r) => r.id !== userId).slice(0, limit ?? cfg["recommend.default_limit"]);
}

/** Connection-Empfehlungen: Nutzer mit hoher Interessenüberschneidung. */
export async function getRecommendedConnections(sb: DB, userId: string, limit?: number) {
  const cfg = await loadConfig(sb);
  const max = limit ?? cfg["recommend.default_limit"];
  const profile = await getInterestProfile(sb, userId);
  const top = profile.entries.slice(0, 25);
  if (top.length === 0) return [];

  const [{ data: candidates }, { data: existing }] = await Promise.all([
    sb
      .from("user_interests")
      .select("user_id,category_id,base_score")
      .in(
        "category_id",
        top.map((e) => e.categoryId),
      )
      .limit(max * 50),
    sb
      .from("connections")
      .select("requester_id,addressee_id")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
  ]);

  const blocked = new Set<string>([userId]);
  for (const c of existing ?? [])
    blocked.add(c.requester_id === userId ? c.addressee_id : c.requester_id);

  const grouped = new Map<string, { categoryId: string; weight: number }[]>();
  for (const row of candidates ?? []) {
    if (blocked.has(row.user_id)) continue;
    (grouped.get(row.user_id) ?? grouped.set(row.user_id, []).get(row.user_id)!).push({
      categoryId: row.category_id,
      weight: 1,
    });
  }

  return [...grouped.entries()]
    .map(([id, cats]) => {
      const { score, matchedCategoryIds } = scoreContent(profile.entries, cats);
      return { id, type: "profile" as const, score, matchedCategoryIds };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/** Trends: meistgenutzte Kategorien der letzten Tage (aggregiert, nutzerbezogen via RLS). */
export async function getTrendingCategories(sb: DB, days = 7, limit = 10) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await sb
    .from("interaction_events")
    .select("category_id,weight")
    .gte("created_at", since)
    .not("category_id", "is", null)
    .limit(5000);
  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.category_id) continue;
    totals.set(row.category_id, (totals.get(row.category_id) ?? 0) + Number(row.weight));
  }
  const categories = await loadCategories(sb);
  const byId = new Map(categories.map((c) => [c.id, c]));
  return [...totals.entries()]
    .map(([categoryId, score]) => ({
      categoryId,
      slug: byId.get(categoryId)?.slug ?? "",
      name: byId.get(categoryId)?.name ?? "",
      score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
