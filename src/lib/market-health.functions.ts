/**
 * Diagnose-Endpunkt (Fix B) für den Market-Rechte-Gesundheitscheck.
 *
 * Nur für Administratoren, ausschliesslich lesend. Es werden keine Secrets
 * zurückgegeben und keine Produktionsdaten geschrieben.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMarketPermissionHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { hasAppRole } = await import("./role-guard.server");
    if (!(await hasAppRole(context.supabase, context.userId, "admin"))) {
      throw new Error("admin_role_required");
    }
    const { marketPermissionHealth } = await import("./market-health.server");
    return marketPermissionHealth();
  });
