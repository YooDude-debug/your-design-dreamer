/**
 * Serverlogik des Werbe-Testmodus.
 *
 * Zuständig für:
 *  - Lesen/Schreiben der Testeinstellungen (`ad_test_settings`)
 *  - Auswertung der Testmetriken (`ad_test_events` + bestehende Zähler)
 *
 * Es werden ausschließlich Testmessungen geschrieben. Echte Kampagnen
 * (`ad_campaigns`) und Abrechnungsdaten bleiben unberührt.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { LiveTestMetrics, LiveTestSettings } from "@/lib/live-test.shared";

const clampTo = (value: number, allowed: readonly number[], fallback: number) =>
  allowed.includes(value) ? value : fallback;

/* --------------------------------------------------------------- settings */

export async function loadLiveSettings(): Promise<LiveTestSettings> {
  const { data, error } = await supabaseAdmin
    .from("ad_test_settings")
    .select("enabled, ad_frequency")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    liveTest: data?.enabled ?? false,
    adFrequency: data?.ad_frequency ?? 15,
  };
}

export async function saveLiveSettings(patch: {
  liveTest?: boolean;
  adFrequency?: number;
}): Promise<LiveTestSettings> {
  const update: Record<string, unknown> = {};
  if (patch.liveTest !== undefined) update.enabled = patch.liveTest;
  if (patch.adFrequency !== undefined) {
    update.ad_frequency = clampTo(Math.round(patch.adFrequency), [15, 25], 15);
  }
  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin
      .from("ad_test_settings")
      .update(update as never)
      .eq("id", true);
    if (error) throw new Error(error.message);
  }
  return loadLiveSettings();
}

/* ---------------------------------------------------------------- metrics */

export async function loadLiveMetrics(): Promise<LiveTestMetrics> {
  const settings = await loadLiveSettings();
  const since = new Date(Date.now() - 86_400_000).toISOString();

  const [events, newPosts, tags] = await Promise.all([
    supabaseAdmin
      .from("ad_test_events")
      .select("kind, feed_position, interactions, ad_id")
      .gte("created_at", since),
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

  const posts24 = newPosts.data ?? [];
  const tagUse = new Map<string, number>();
  for (const p of posts24) {
    for (const id of (p.slang_tag_ids ?? []) as string[]) {
      tagUse.set(id, (tagUse.get(id) ?? 0) + 1);
    }
  }

  const tagRows = tags.data ?? [];
  const sum = (key: "plays_count" | "uses_count" | "likes_count" | "shares_count") =>
    tagRows.reduce((acc, t) => acc + (t[key] ?? 0), 0);

  return {
    settings,
    feed: {
      impressions: of("feed_impression").length,
      steps: of("feed_step").length,
      newPosts24h: posts24.length,
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
