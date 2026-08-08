/**
 * Serverlogik des Live-Testmodus.
 *
 * Zuständig für:
 *  - Lesen/Schreiben der Testeinstellungen (`test_bot_settings`)
 *  - zeitgesteuerte Bot-Posts (nur `is_bot = true` Konten)
 *  - Auswertung der Testmetriken (`ad_test_events` + bestehende Zähler)
 *
 * Es werden ausschließlich Test-/Bot-Konten verändert. Echte Nutzer,
 * Kampagnen (`ad_campaigns`) und Abrechnungsdaten bleiben unberührt.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  TEST_BOT_HASHTAGS,
  TEST_BOT_POST_TEXTS,
  TEST_BOT_POST_TITLES,
  TEST_BOT_SLANG_WORDS,
} from "@/lib/testbots.shared";
import type { LiveTestMetrics, LiveTestSettings } from "@/lib/live-test.shared";

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const shuffle = <T>(list: T[]): T[] => [...list].sort(() => Math.random() - 0.5);
const clampTo = (value: number, allowed: readonly number[], fallback: number) =>
  allowed.includes(value) ? value : fallback;

/* --------------------------------------------------------------- settings */

export async function loadLiveSettings(): Promise<LiveTestSettings> {
  const { data, error } = await supabaseAdmin
    .from("test_bot_settings")
    .select("enabled, live_test, post_interval_minutes, ad_frequency, last_live_run_at")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    botsEnabled: data?.enabled ?? false,
    liveTest: data?.live_test ?? false,
    postIntervalMinutes: data?.post_interval_minutes ?? 3,
    adFrequency: data?.ad_frequency ?? 15,
    lastRunAt: data?.last_live_run_at ?? null,
  };
}

export async function saveLiveSettings(patch: {
  liveTest?: boolean;
  postIntervalMinutes?: number;
  adFrequency?: number;
}): Promise<LiveTestSettings> {
  const update: Record<string, unknown> = {};
  if (patch.liveTest !== undefined) update.live_test = patch.liveTest;
  if (patch.postIntervalMinutes !== undefined) {
    update.post_interval_minutes = clampTo(Math.round(patch.postIntervalMinutes), [1, 3], 3);
  }
  if (patch.adFrequency !== undefined) {
    update.ad_frequency = clampTo(Math.round(patch.adFrequency), [15, 25], 15);
  }
  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin
      .from("test_bot_settings")
      .update(update as never)
      .eq("id", true);
    if (error) throw new Error(error.message);
  }
  return loadLiveSettings();
}

/* ------------------------------------------------------------- bot posting */

type LiveBot = {
  id: string;
  userId: string;
  username: string;
  region: string;
  language: string;
};

async function activeBots(): Promise<LiveBot[]> {
  const { data } = await supabaseAdmin
    .from("test_accounts")
    .select("id, user_id, username, region, language, active")
    .eq("is_bot", true)
    .eq("active", true);
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    region: r.region ?? "",
    language: r.language ?? "Deutsch",
  }));
}

/** Owner-scoped SlangTag des Bots holen oder anlegen (Duplikate erwünscht). */
async function ensureBotTag(bot: LiveBot, name: string): Promise<string | null> {
  const normalized = name.trim().toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from("slang_tags")
    .select("id")
    .eq("owner_id", bot.userId)
    .eq("normalized_name", normalized)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabaseAdmin
    .from("slang_tags")
    .insert({
      name,
      normalized_name: normalized,
      creator_id: bot.userId,
      owner_id: bot.userId,
      kind: "community",
      region: bot.region,
      language: bot.language,
      meaning: "Live-Test SlangTag",
      examples: ["Live-Test."],
      duration: "0:02",
      moderation_status: "approved",
    })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

async function botImagePool(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("posts")
    .select("image_url")
    .in("user_id", userIds)
    .not("image_url", "is", null)
    .limit(40);
  return (data ?? []).map((r) => r.image_url).filter((u): u is string => !!u);
}

export type LiveRunResult = {
  ran: boolean;
  reason?: string;
  posts: number;
  likes: number;
  bots: string[];
  nextRunAt: string | null;
};

/**
 * Ein Lauf des Live-Tests: eine Teilmenge der Bots erzeugt frische Beiträge.
 * Zeitliche Streuung ist gewollt, doppelte Inhalte ebenfalls.
 */
export async function runLiveRound(force = false): Promise<LiveRunResult> {
  const settings = await loadLiveSettings();
  const empty = { posts: 0, likes: 0, bots: [] as string[], nextRunAt: null };
  if (!settings.botsEnabled || !settings.liveTest) {
    return { ran: false, reason: "disabled", ...empty };
  }
  const intervalMs = settings.postIntervalMinutes * 60_000;
  const last = settings.lastRunAt ? Date.parse(settings.lastRunAt) : 0;
  if (!force && last && Date.now() - last < intervalMs - 5_000) {
    return {
      ran: false,
      reason: "interval",
      ...empty,
      nextRunAt: new Date(last + intervalMs).toISOString(),
    };
  }

  const startedAt = new Date();
  await supabaseAdmin
    .from("test_bot_settings")
    .update({ last_live_run_at: startedAt.toISOString() } as never)
    .eq("id", true);

  const bots = await activeBots();
  if (bots.length === 0) return { ran: false, reason: "no-bots", ...empty };

  const images = await botImagePool(bots.map((b) => b.userId));
  // Nur eine Teilmenge pro Lauf → nicht alle Bots posten gleichzeitig.
  const chosen = shuffle(bots).slice(0, Math.min(bots.length, rand(1, 3)));
  const usedNames = TEST_BOT_SLANG_WORDS.slice(0, 6);

  let posts = 0;
  let likes = 0;
  for (const bot of chosen) {
    try {
      // Bewusst wenige Namen → gleiche SlangTags bei verschiedenen Bots.
      const tagId = await ensureBotTag(bot, pick(usedNames));
      const { error } = await supabaseAdmin.from("posts").insert({
        user_id: bot.userId,
        title: pick(TEST_BOT_POST_TITLES),
        description: pick(TEST_BOT_POST_TEXTS),
        region: bot.region,
        hashtags: [pick(TEST_BOT_HASHTAGS)],
        image_url: images.length ? pick(images) : null,
        slang_tag_ids: tagId ? [tagId] : [],
        visibility: "public",
        moderation_status: "approved",
      });
      if (!error) posts += 1;

      if (Math.random() < 0.5) {
        const { data: recent } = await supabaseAdmin
          .from("posts")
          .select("id")
          .neq("user_id", bot.userId)
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(20);
        const target = recent?.length ? pick(recent) : null;
        if (target) {
          const res = await supabaseAdmin
            .from("post_likes")
            .upsert({ post_id: target.id, user_id: bot.userId });
          if (!res.error) likes += 1;
        }
      }

      const now = new Date().toISOString();
      await supabaseAdmin.from("test_accounts").update({ last_activity_at: now }).eq("id", bot.id);
      await supabaseAdmin.from("profiles").update({ last_seen_at: now }).eq("id", bot.userId);
    } catch {
      // Ein fehlgeschlagener Bot darf den Lauf nicht abbrechen.
    }
  }

  return {
    ran: true,
    posts,
    likes,
    bots: chosen.map((b) => b.username),
    nextRunAt: new Date(startedAt.getTime() + intervalMs).toISOString(),
  };
}

/* ---------------------------------------------------------------- metrics */

export async function loadLiveMetrics(): Promise<LiveTestMetrics> {
  const settings = await loadLiveSettings();
  const since = new Date(Date.now() - 86_400_000).toISOString();

  const [events, botRows, newPosts, tags] = await Promise.all([
    supabaseAdmin
      .from("ad_test_events")
      .select("kind, feed_position, interactions, ad_id")
      .gte("created_at", since),
    supabaseAdmin
      .from("test_accounts")
      .select("user_id, username, active, last_activity_at")
      .eq("is_bot", true),
    supabaseAdmin.from("posts").select("id, user_id, slang_tag_ids").gte("created_at", since),
    supabaseAdmin
      .from("slang_tags")
      .select("id, plays_count, uses_count, likes_count, shares_count, created_at")
      .is("deleted_at", null),
  ]);

  const ev = events.data ?? [];
  const of = (kind: string) => ev.filter((e) => e.kind === kind);
  const avg = (list: number[]) =>
    list.length ? Number((list.reduce((a, b) => a + b, 0) / list.length).toFixed(1)) : 0;

  const botIds = new Set((botRows.data ?? []).map((b) => b.user_id));
  const posts24 = newPosts.data ?? [];
  const botPosts = posts24.filter((p) => botIds.has(p.user_id));
  const tagUse = new Map<string, number>();
  for (const p of posts24) {
    for (const id of (p.slang_tag_ids ?? []) as string[]) {
      tagUse.set(id, (tagUse.get(id) ?? 0) + 1);
    }
  }

  const tagRows = tags.data ?? [];
  const sum = (key: "plays_count" | "uses_count" | "likes_count" | "shares_count") =>
    tagRows.reduce((acc, t) => acc + (t[key] ?? 0), 0);

  const perBot = (botRows.data ?? []).map((b) => ({
    username: b.username,
    posts: botPosts.filter((p) => p.user_id === b.user_id).length,
    lastActivityAt: b.last_activity_at ?? null,
  }));

  const last = settings.lastRunAt ? Date.parse(settings.lastRunAt) : 0;

  return {
    settings,
    feed: {
      impressions: of("feed_impression").length,
      steps: of("feed_step").length,
      newPosts24h: posts24.length,
      botPosts: botPosts.length,
      repeatedTags: [...tagUse.values()].filter((n) => n > 1).length,
    },
    ads: {
      scheduled: of("ad_scheduled").length,
      impressions: of("ad_impression").length,
      clicks: of("ad_click").length,
      slangPlays: of("ad_slangtag_play").length,
      skips: of("ad_skip").length,
      avgInteractions: avg(of("ad_impression").map((e) => e.interactions ?? 0)),
      avgPosition: avg(of("ad_impression").map((e) => e.feed_position ?? 0)),
    },
    slang: {
      plays: sum("plays_count"),
      uses: sum("uses_count"),
      likes: sum("likes_count"),
      shares: sum("shares_count"),
      newTags24h: tagRows.filter((t) => (t.created_at ?? "") >= since).length,
    },
    bots: {
      total: perBot.length,
      active: (botRows.data ?? []).filter((b) => b.active).length,
      posts: perBot.sort((a, b) => b.posts - a.posts),
      nextRunAt:
        settings.liveTest && last
          ? new Date(last + settings.postIntervalMinutes * 60_000).toISOString()
          : null,
    },
  };
}

/** Testmessungen löschen (nur Testtabelle, keine Produktionsdaten). */
export async function clearAdTestEvents(): Promise<{ removed: number }> {
  const { count } = await supabaseAdmin
    .from("ad_test_events")
    .delete({ count: "exact" })
    .not("id", "is", null);
  return { removed: count ?? 0 };
}
