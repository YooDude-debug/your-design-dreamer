/**
 * Öffentliche API des Live-Testmodus (Server Functions).
 *
 * Einstellungen dürfen alle angemeldeten Nutzer lesen (der Feed braucht die
 * Ad-Frequenz), ändern darf sie ausschließlich ein Admin-Konto.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdTestKind, LiveTestMetrics, LiveTestSettings } from "@/lib/live-test.shared";

export const getLiveTestSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<LiveTestSettings> => {
    const { loadLiveSettings } = await import("@/lib/live-test.server");
    return loadLiveSettings();
  });

export const setLiveTestSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { liveTest?: boolean; postIntervalMinutes?: number; adFrequency?: number }) => input,
  )
  .handler(async ({ context, data }): Promise<LiveTestSettings> => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { saveLiveSettings } = await import("@/lib/live-test.server");
    const settings = await saveLiveSettings(data);
    await logAdminAction(adminId, "live_test_settings", {
      targetType: "test_bot",
      targetLabel: "Live-Testmodus",
      details: data as Record<string, unknown>,
    });
    return settings;
  });

export const getLiveTestMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LiveTestMetrics> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { loadLiveMetrics } = await import("@/lib/live-test.server");
    return loadLiveMetrics();
  });

export const runLiveTestRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { runLiveRound } = await import("@/lib/live-test.server");
    return runLiveRound(true);
  });

export const clearLiveTestEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ removed: number }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { clearAdTestEvents } = await import("@/lib/live-test.server");
    return clearAdTestEvents();
  });

/** Testmessung schreiben – landet ausschließlich in `ad_test_events`. */
export const recordAdTestEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      kind: AdTestKind;
      adId?: string;
      feedPosition?: number;
      interactions?: number;
      details?: Record<string, unknown>;
    }) => input,
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { error } = await context.supabase.from("ad_test_events").insert({
      user_id: context.userId,
      kind: data.kind,
      ad_id: (data.adId ?? "").slice(0, 120),
      feed_position: Math.max(0, Math.min(9999, Math.round(data.feedPosition ?? 0))),
      interactions: Math.max(0, Math.min(9999, Math.round(data.interactions ?? 0))),
      details: (data.details ?? {}) as never,
    });
    if (error) return { ok: false };
    return { ok: true };
  });
