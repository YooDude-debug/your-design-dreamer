import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TestBotActivitySummary, TestBotRow, TestBotSettings } from "@/lib/testbots.shared";

export const getTestBotState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ settings: TestBotSettings; bots: TestBotRow[] }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { loadBotSettings, loadBots } = await import("@/lib/testbots.server");
    const [settings, bots] = await Promise.all([loadBotSettings(), loadBots()]);
    return { settings, bots };
  });

export const setTestBotSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled?: boolean; running?: boolean; botCount?: number }) => input)
  .handler(async ({ context, data }): Promise<TestBotSettings> => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { saveBotSettings } = await import("@/lib/testbots.server");
    const settings = await saveBotSettings(data);
    await logAdminAction(adminId, "test_bot_settings", {
      targetType: "test_bot",
      targetLabel: "Einstellungen",
      details: data as Record<string, unknown>,
    });
    return settings;
  });

export const seedTestBots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { count?: number }) => ({ count: input?.count ?? 20 }))
  .handler(async ({ context, data }): Promise<{ created: string[] }> => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { seedBots } = await import("@/lib/testbots.server");
    const res = await seedBots(data.count);
    await logAdminAction(adminId, "test_bot_seed", {
      targetType: "test_bot",
      targetLabel: `${res.created.length} Testbots`,
    });
    return res;
  });

export const runTestBotActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rounds?: number }) => ({ rounds: input?.rounds ?? 1 }))
  .handler(async ({ context, data }): Promise<TestBotActivitySummary> => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { runBotActivity } = await import("@/lib/testbots.server");
    const summary = await runBotActivity(data.rounds);
    await logAdminAction(adminId, "test_bot_activity", {
      targetType: "test_bot",
      targetLabel: "Aktivitätslauf",
      details: summary as unknown as Record<string, unknown>,
    });
    return summary;
  });

export const resetTestBotActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ removed: number }> => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { resetBotActivity } = await import("@/lib/testbots.server");
    const res = await resetBotActivity();
    await logAdminAction(adminId, "test_bot_reset", {
      targetType: "test_bot",
      targetLabel: "Aktivität zurückgesetzt",
      details: res,
    });
    return res;
  });

export const updateTestBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; active?: boolean; intervalMinutes?: number; actions?: string[] }) =>
      input,
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { updateBot } = await import("@/lib/testbots.server");
    const { id, ...patch } = data;
    await updateBot(id, patch);
    return { ok: true };
  });

export const purgeTestBots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ accounts: number; content: number }> => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { purgeBots } = await import("@/lib/testbots.server");
    const res = await purgeBots();
    await logAdminAction(adminId, "test_bot_purge", {
      targetType: "test_bot",
      targetLabel: "Alle Testbots gelöscht",
      details: res,
    });
    return res;
  });
