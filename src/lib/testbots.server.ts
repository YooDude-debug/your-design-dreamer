import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomPassword } from "@/lib/test-accounts.shared";
import {
  TEST_BOT_ACTIONS,
  TEST_BOT_COMMENTS,
  TEST_BOT_HASHTAGS,
  TEST_BOT_POOL,
  TEST_BOT_POST_TEXTS,
  TEST_BOT_POST_TITLES,
  TEST_BOT_PREFIX,
  TEST_BOT_SLANG_WORDS,
  type TestBotAction,
  type TestBotActivitySummary,
  type TestBotRow,
  type TestBotSettings,
} from "@/lib/testbots.shared";

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/** Realistische, aber zufällige Aktivitätszeit innerhalb der letzten Tage. */
function randomActivityTime() {
  const now = Date.now();
  const daysBack = rand(0, 6);
  const hour = pick([8, 9, 11, 12, 13, 15, 17, 18, 19, 20, 21, 22]);
  const d = new Date(now - daysBack * 86_400_000);
  d.setHours(hour, rand(0, 59), rand(0, 59), 0);
  return new Date(Math.min(d.getTime(), now)).toISOString();
}

/* ------------------------------------------------------------- settings */

export async function loadBotSettings(): Promise<TestBotSettings> {
  const { data, error } = await supabaseAdmin
    .from("test_bot_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    enabled: data?.enabled ?? false,
    running: data?.running ?? false,
    botCount: data?.bot_count ?? 20,
    updatedAt: data?.updated_at ?? new Date().toISOString(),
  };
}

export async function saveBotSettings(patch: {
  enabled?: boolean;
  running?: boolean;
  botCount?: number;
}): Promise<TestBotSettings> {
  const update: Record<string, unknown> = {};
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  if (patch.running !== undefined) update.running = patch.running;
  if (patch.botCount !== undefined) {
    update.bot_count = Math.max(0, Math.min(TEST_BOT_POOL.length, Math.round(patch.botCount)));
  }
  // Hauptschalter aus ⇒ Aktivität immer sofort gestoppt.
  if (patch.enabled === false) update.running = false;

  const { error } = await supabaseAdmin.from("test_bot_settings").update(update).eq("id", true);
  if (error) throw new Error(error.message);
  return loadBotSettings();
}

async function assertEnabled() {
  const settings = await loadBotSettings();
  if (!settings.enabled) throw new Error("Testbot-System ist deaktiviert");
  return settings;
}

/* ----------------------------------------------------------------- rows */

async function botIds(): Promise<string[]> {
  const { data } = await supabaseAdmin.from("test_accounts").select("user_id").eq("is_bot", true);
  return (data ?? []).map((r) => r.user_id);
}

export async function loadBots(): Promise<TestBotRow[]> {
  const { data, error } = await supabaseAdmin
    .from("test_accounts")
    .select("*")
    .eq("is_bot", true)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ids = rows.map((r) => r.user_id);
  if (ids.length === 0) return [];

  const [posts, comments, likes, tags] = await Promise.all([
    supabaseAdmin.from("posts").select("user_id").in("user_id", ids),
    supabaseAdmin.from("comments").select("user_id").in("user_id", ids),
    supabaseAdmin.from("post_likes").select("user_id").in("user_id", ids),
    supabaseAdmin.from("slang_tags").select("creator_id").in("creator_id", ids),
  ]);
  const count = (list: { [k: string]: unknown }[] | null, key: string, id: string) =>
    (list ?? []).filter((r) => r[key] === id).length;

  return rows.map((r) => {
    const cfg = (r.bot_config ?? {}) as { intervalMinutes?: number; actions?: string[] };
    return {
      id: r.id,
      userId: r.user_id,
      username: r.username,
      email: r.email,
      country: r.country ?? "",
      region: r.region ?? "",
      language: r.language ?? "",
      interests: Array.isArray(r.interests) ? r.interests : [],
      active: r.active,
      intervalMinutes: cfg.intervalMinutes ?? 60,
      actions: Array.isArray(cfg.actions) ? cfg.actions : [...TEST_BOT_ACTIONS],
      lastActivityAt: r.last_activity_at ?? null,
      posts: count(posts.data as never, "user_id", r.user_id),
      comments: count(comments.data as never, "user_id", r.user_id),
      likes: count(likes.data as never, "user_id", r.user_id),
      slangTags: count(tags.data as never, "creator_id", r.user_id),
    };
  });
}

/* --------------------------------------------------------------- seeding */

/** Legt fehlende Bots an, bis die gewünschte Anzahl erreicht ist. */
export async function seedBots(count: number): Promise<{ created: string[] }> {
  await assertEnabled();
  const target = Math.max(0, Math.min(TEST_BOT_POOL.length, Math.round(count)));
  const existing = await loadBots();
  const taken = new Set(existing.map((b) => b.username));
  const created: string[] = [];

  for (const entry of TEST_BOT_POOL) {
    if (existing.length + created.length >= target) break;
    const username = `${TEST_BOT_PREFIX}${entry.name}`;
    if (taken.has(username)) continue;

    const email = `${username}@testbot.y-dude.com`;
    const password = randomPassword();
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, test_account: true, test_bot: true },
    });
    if (userError || !user.user) throw new Error(userError?.message ?? "createUser fehlgeschlagen");

    const uid = user.user.id;
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      username,
      display_name: `${entry.name.charAt(0).toUpperCase()}${entry.name.slice(1)} (Testbot)`,
      bio: `Testbot · ${entry.interests.join(", ")}`,
      location: entry.region,
      language: entry.language,
      is_test_bot: true,
      last_seen_at: randomActivityTime(),
    });

    const { error } = await supabaseAdmin.from("test_accounts").insert({
      user_id: uid,
      username,
      email,
      initial_password: password,
      region: entry.region,
      language: entry.language,
      country: entry.country,
      interests: entry.interests,
      is_bot: true,
      bot_config: {
        enabled: true,
        intervalMinutes: rand(20, 180),
        actions: [...TEST_BOT_ACTIONS],
        tone: "neutral",
      } as never,
    });
    if (error) throw new Error(error.message);
    created.push(username);
  }
  return { created };
}

/* -------------------------------------------------------------- activity */

async function runBotAction(uid: string, action: TestBotAction, botUsernames: string[]) {
  const createdAt = randomActivityTime();

  if (action === "post") {
    const { error } = await supabaseAdmin.from("posts").insert({
      user_id: uid,
      title: pick(TEST_BOT_POST_TITLES),
      description: pick(TEST_BOT_POST_TEXTS),
      region: "",
      hashtags: [pick(TEST_BOT_HASHTAGS)],
      visibility: "public",
      created_at: createdAt,
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (action === "slangtag") {
    const name = `${pick(TEST_BOT_SLANG_WORDS)}${rand(10, 99)}`;
    await supabaseAdmin.from("slang_tags").insert({
      name,
      creator_id: uid,
      owner_id: uid,
      kind: "community",
      region: "",
      language: "Deutsch",
      meaning: "Testdaten-SlangTag",
      examples: ["Nur ein Test."],
      duration: "0:02",
      created_at: createdAt,
    });
    return;
  }

  if (action === "like" || action === "comment" || action === "share") {
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id")
      .neq("user_id", uid)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(40);
    const target = posts?.length ? pick(posts) : null;
    if (!target) return;
    if (action === "like") {
      await supabaseAdmin.from("post_likes").upsert({ post_id: target.id, user_id: uid });
    } else if (action === "share") {
      await supabaseAdmin.from("post_shares").upsert({ post_id: target.id, user_id: uid });
    } else {
      await supabaseAdmin
        .from("comments")
        .insert({ post_id: target.id, user_id: uid, body: pick(TEST_BOT_COMMENTS) });
    }
    return;
  }

  if (action === "visit") {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,username")
      .neq("id", uid)
      .limit(60);
    const others = (profiles ?? []).filter((p) => !botUsernames.includes(p.username));
    const target = others.length ? pick(others) : null;
    if (!target) return;
    await supabaseAdmin.from("post_views").upsert({ post_id: target.id, user_id: uid }).select();
  }
}

/**
 * Führt eine Runde simulierter Bot-Aktivität aus: zufällige Aktionen,
 * realistisch verteilt über die aktiven Bots.
 */
export async function runBotActivity(rounds = 1): Promise<TestBotActivitySummary> {
  await assertEnabled();
  const bots = (await loadBots()).filter((b) => b.active);
  const usernames = bots.map((b) => b.username);
  const summary: TestBotActivitySummary = {
    posts: 0,
    comments: 0,
    likes: 0,
    shares: 0,
    slangTags: 0,
    visits: 0,
    follows: 0,
  };
  if (bots.length === 0) throw new Error("Keine aktiven Testbots vorhanden");

  for (let r = 0; r < Math.max(1, Math.min(5, rounds)); r++) {
    for (const bot of bots) {
      // Nicht jeder Bot ist jede Runde aktiv – simuliert Aktivitätszeiten.
      if (Math.random() < 0.35) continue;
      const allowed = (bot.actions.length ? bot.actions : [...TEST_BOT_ACTIONS]).filter((a) =>
        (TEST_BOT_ACTIONS as readonly string[]).includes(a),
      ) as TestBotAction[];
      if (allowed.length === 0) continue;
      const action = pick(allowed);
      try {
        await runBotAction(bot.userId, action, usernames);
        if (action === "post") summary.posts++;
        else if (action === "comment") summary.comments++;
        else if (action === "like") summary.likes++;
        else if (action === "share") summary.shares++;
        else if (action === "slangtag") summary.slangTags++;
        else if (action === "visit") summary.visits++;
      } catch {
        // einzelne fehlgeschlagene Aktion darf den Lauf nicht abbrechen
      }
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("test_accounts")
        .update({ last_activity_at: now })
        .eq("id", bot.id);
      await supabaseAdmin.from("profiles").update({ last_seen_at: now }).eq("id", bot.userId);
    }
  }
  return summary;
}

/** Löscht alle von Bots erzeugten Inhalte, behält die Bot-Konten. */
export async function resetBotActivity(): Promise<{ removed: number }> {
  const ids = await botIds();
  if (ids.length === 0) return { removed: 0 };
  const removed = await purgeBotContent(ids);
  await supabaseAdmin
    .from("test_accounts")
    .update({ last_activity_at: null })
    .eq("is_bot", true);
  return { removed };
}

async function purgeBotContent(ids: string[]): Promise<number> {
  let removed = 0;
  const del = async (fn: () => Promise<{ count: number | null; error: unknown }>) => {
    const { count } = await fn();
    removed += count ?? 0;
  };

  // Beiträge der Bots und alle daran hängenden Interaktionen
  const { data: postRows } = await supabaseAdmin.from("posts").select("id").in("user_id", ids);
  const postIds = (postRows ?? []).map((p) => p.id);
  if (postIds.length > 0) {
    for (const table of [
      "comments",
      "post_likes",
      "post_saves",
      "post_shares",
      "post_views",
    ] as const) {
      await supabaseAdmin.from(table).delete().in("post_id", postIds);
    }
  }

  // Interaktionen der Bots auf fremden Beiträgen
  for (const table of ["comments", "post_likes", "post_saves", "post_shares", "post_views"] as const) {
    await del(async () => {
      const res = await supabaseAdmin.from(table).delete({ count: "exact" }).in("user_id", ids);
      return { count: res.count, error: res.error };
    });
  }

  await del(async () => {
    const res = await supabaseAdmin.from("posts").delete({ count: "exact" }).in("user_id", ids);
    return { count: res.count, error: res.error };
  });

  // SlangTags der Bots inklusive Interaktionen
  const { data: tagRows } = await supabaseAdmin
    .from("slang_tags")
    .select("id")
    .in("creator_id", ids);
  const tagIds = (tagRows ?? []).map((t) => t.id);
  if (tagIds.length > 0) {
    for (const table of [
      "slang_tag_likes",
      "slang_tag_saves",
      "slang_tag_shares",
      "slang_tag_plays",
      "slang_tag_votes",
    ] as const) {
      await supabaseAdmin.from(table).delete().in("tag_id", tagIds);
    }
    await supabaseAdmin.from("content_categories").delete().in("content_id", tagIds);
    await del(async () => {
      const res = await supabaseAdmin.from("slang_tags").delete({ count: "exact" }).in("id", tagIds);
      return { count: res.count, error: res.error };
    });
  }
  for (const table of [
    "slang_tag_likes",
    "slang_tag_saves",
    "slang_tag_shares",
    "slang_tag_plays",
    "slang_tag_votes",
  ] as const) {
    await supabaseAdmin.from(table).delete().in("user_id", ids);
  }

  // Benachrichtigungen, Verbindungen, Follows, Nachrichten, Interessen
  await del(async () => {
    const res = await supabaseAdmin.from("notifications").delete({ count: "exact" }).in("user_id", ids);
    return { count: res.count, error: res.error };
  });
  await supabaseAdmin.from("notifications").delete().in("actor_id", ids);
  await supabaseAdmin.from("follows").delete().in("follower_id", ids);
  await supabaseAdmin.from("follows").delete().in("following_id", ids);
  await supabaseAdmin.from("connections").delete().in("requester_id", ids);
  await supabaseAdmin.from("connections").delete().in("addressee_id", ids);
  await supabaseAdmin.from("messages").delete().in("sender_id", ids);
  await supabaseAdmin.from("conversation_members").delete().in("user_id", ids);
  await supabaseAdmin.from("reports").delete().in("reporter_id", ids);
  await supabaseAdmin.from("interaction_events").delete().in("user_id", ids);
  await supabaseAdmin.from("user_interests").delete().in("user_id", ids);
  await supabaseAdmin.from("user_interest_scores").delete().in("user_id", ids);
  await supabaseAdmin.from("interest_confidence").delete().in("user_id", ids);
  await supabaseAdmin.from("connection_influence").delete().in("user_id", ids);
  await supabaseAdmin.from("connection_influence").delete().in("peer_id", ids);
  await supabaseAdmin.from("ad_preferences").delete().in("user_id", ids);
  await supabaseAdmin.from("ad_pauses").delete().in("user_id", ids);
  await supabaseAdmin.from("travel_plans").delete().in("user_id", ids);
  await supabaseAdmin.from("content_categories").delete().in("owner_id", ids);

  return removed;
}

/** Entfernt Bots, alle ihre Inhalte und ihre Konten endgültig. */
export async function purgeBots(): Promise<{ accounts: number; content: number }> {
  const ids = await botIds();
  if (ids.length === 0) return { accounts: 0, content: 0 };

  const content = await purgeBotContent(ids);
  await supabaseAdmin.from("test_accounts").delete().in("user_id", ids);
  await supabaseAdmin.from("profiles").delete().in("id", ids);
  for (const id of ids) {
    await supabaseAdmin.auth.admin.deleteUser(id);
  }
  await supabaseAdmin.from("test_bot_settings").update({ running: false }).eq("id", true);
  return { accounts: ids.length, content };
}

/** Bot aktivieren / deaktivieren oder Verhalten anpassen. */
export async function updateBot(
  id: string,
  patch: { active?: boolean; intervalMinutes?: number; actions?: string[] },
): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from("test_accounts")
    .select("user_id,bot_config")
    .eq("id", id)
    .eq("is_bot", true)
    .maybeSingle();
  if (!row) throw new Error("Testbot nicht gefunden");

  const cfg = (row.bot_config ?? {}) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.intervalMinutes !== undefined || patch.actions !== undefined) {
    update.bot_config = {
      ...cfg,
      ...(patch.intervalMinutes !== undefined
        ? { intervalMinutes: Math.max(1, Math.round(patch.intervalMinutes)) }
        : {}),
      ...(patch.actions !== undefined ? { actions: patch.actions } : {}),
    };
  }
  const { error } = await supabaseAdmin.from("test_accounts").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  if (patch.active !== undefined) {
    await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      ban_duration: patch.active ? "none" : "876000h",
    });
  }
}
