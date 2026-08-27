import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OpsHealth } from "@/lib/ops-monitor.shared";

/**
 * Adminzugänge zur technischen Überwachung (Phase 3).
 * Jede Funktion prüft zuerst die Adminrolle; ohne Adminrolle gibt es keine Daten.
 */

export const opsGetHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { environment?: string } | undefined) => ({
    environment: (["development", "staging", "production"] as const).includes(
      (input?.environment ?? "") as never,
    )
      ? (input!.environment as "development" | "staging" | "production")
      : undefined,
  }))
  .handler(async ({ context, data }): Promise<OpsHealth> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { loadOpsHealth } = await import("@/lib/ops-health.server");
    const { appEnvironment } = await import("@/lib/environment.server");
    return loadOpsHealth(data.environment ?? appEnvironment());
  });

export const opsUpdateIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "acknowledged", "investigating", "resolved"]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acknowledged = data.status === "acknowledged" || data.status === "investigating";
    const { error } = await supabaseAdmin
      .from("ops_incidents")
      .update({
        status: data.status,
        ...(data.note !== undefined ? { note: data.note } : {}),
        acknowledged_by: acknowledged ? context.userId : null,
        acknowledged_at: acknowledged ? new Date().toISOString() : null,
        resolved_at: data.status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);

    return { ok: !error };
  });

/**
 * Selbsttest des Alarmwegs. Erzeugt bewusst technische Testereignisse.
 * Nur für Admins und ausschließlich außerhalb der Produktionsumgebung –
 * die Produktion wird nicht absichtlich beschädigt.
 */
export const opsSelfTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        scenario: z.enum([
          "api_error",
          "webhook_error",
          "push_failure",
          "high_latency",
          "db_error",
        ]),
      })
      .parse(input),
  )
  .handler(
    async ({ context, data }): Promise<{ ok: boolean; blocked?: string; events: number }> => {
      const { assertAdmin } = await import("@/lib/admin.server");
      await assertAdmin(context);
      const { appEnvironment } = await import("@/lib/environment.server");
      const environment = appEnvironment();
      if (environment === "production") {
        return { ok: false, blocked: "Selbsttest ist in der Produktion gesperrt.", events: 0 };
      }

      const { recordOpsEvent } = await import("@/lib/ops-monitor.server");
      const plans: Record<
        typeof data.scenario,
        {
          area: "api" | "webhook" | "push" | "performance" | "database";
          event: string;
          times: number;
        }
      > = {
        api_error: { area: "api", event: "selftest_api_error", times: 10 },
        webhook_error: { area: "webhook", event: "selftest_webhook_error", times: 3 },
        push_failure: { area: "push", event: "selftest_push_failure", times: 25 },
        high_latency: { area: "performance", event: "selftest_slow_api", times: 10 },
        db_error: { area: "database", event: "selftest_db_error", times: 3 },
      };
      const plan = plans[data.scenario];
      for (let i = 0; i < plan.times; i += 1) {
        await recordOpsEvent({
          area: plan.area,
          event: plan.event,
          severity: plan.area === "performance" ? "warning" : "critical",
          environment,
          service: "ops_selftest",
          fn: data.scenario,
          error: new Error(`Simulierter Testfehler (${data.scenario})`),
          ...(plan.area === "performance" ? { durationMs: 4200 } : {}),
          context: { selftest: true, iteration: i + 1 },
        });
      }
      return { ok: true, events: plan.times };
    },
  );

/**
 * Kontrollierter Alarmtest: prüft ausschließlich den Zustellweg des
 * hinterlegten Alarmkanals. Es entstehen keine Vorfälle und keine
 * Fehlerereignisse, deshalb ist der Test auch in der Produktion erlaubt.
 */
export const opsTestAlertChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ configured: boolean; delivered: boolean; channels: number }> => {
      const { assertAdmin } = await import("@/lib/admin.server");
      await assertAdmin(context);
      const { testAlertChannel } = await import("@/lib/ops-monitor.server");
      return testAlertChannel();
    },
  );
