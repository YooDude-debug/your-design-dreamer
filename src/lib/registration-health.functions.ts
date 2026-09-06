/**
 * Serverfunktionen für den Registrierungs-Check.
 * Ausschließlich für Administratoren; die eigentliche Prüflogik liegt
 * server-only in registration-health.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ManualStepResult,
  RegistrationHealthHistory,
  RegistrationHealthReport,
} from "@/lib/registration-health.shared";

export const runRegistrationCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RegistrationHealthReport> => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { runRegistrationHealthCheck } = await import("@/lib/registration-health.server");
    const report = await runRegistrationHealthCheck(adminId);
    await logAdminAction(adminId, "registration_health_check", {
      targetType: "system",
      details: { overall: report.overall, errors: report.errorCount },
    });
    return report;
  });

export const getRegistrationCheckHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RegistrationHealthHistory> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { loadRegistrationHealthHistory } = await import("@/lib/registration-health.server");
    return loadRegistrationHealthHistory();
  });

export const saveManualRegistrationTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { steps: ManualStepResult[]; note?: string }) => {
    if (!Array.isArray(input?.steps) || input.steps.length === 0) {
      throw new Error("Keine Testschritte übergeben.");
    }
    return {
      steps: input.steps.slice(0, 20).map((s) => ({
        label: String(s.label).slice(0, 200),
        status: s.status === "failed" ? ("failed" as const) : ("ok" as const),
        ...(s.note ? { note: String(s.note).slice(0, 500) } : {}),
      })),
      note: String(input.note ?? "").slice(0, 1000),
    };
  })
  .handler(async ({ data, context }): Promise<RegistrationHealthReport> => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { recordManualRegistrationTest } = await import("@/lib/registration-health.server");
    const report = await recordManualRegistrationTest(adminId, data.steps, data.note);
    await logAdminAction(adminId, "registration_manual_test", {
      targetType: "system",
      details: { overall: report.overall, errors: report.errorCount },
    });
    return report;
  });
