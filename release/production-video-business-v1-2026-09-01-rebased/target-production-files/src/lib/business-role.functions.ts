/**
 * Unternehmerrolle – Freischaltung bei der Registrierung als Unternehmen.
 *
 * Rolle und Abo sind zwei getrennte Zustände: die Rolle `business` erlaubt den
 * Zugang zum Unternehmerbereich, das Business-Abo erlaubt Kampagnen. Ein
 * Unternehmen darf ohne Abo bestehen – „Später entscheiden“ ändert nichts an
 * der Rolle.
 *
 * Geschrieben wird ausschliesslich in die bestehende Rollenquelle
 * `public.user_roles` (Rolle `business`), identisch zum vorhandenen
 * Creator-Rollenwechsel. Es entsteht keine parallele Rollenarchitektur;
 * Creator- und Adminrollen bleiben unberührt.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BusinessRoleResult =
  | { ok: true; isBusiness: true; alreadyBusiness: boolean }
  | { ok: false; error: "failed" };

/** Aktiviert die Unternehmerrolle für das eigene Konto (idempotent). */
export const activateBusinessRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessRoleResult> => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "business",
    });
    if (existing === true) return { ok: true, isBusiness: true, alreadyBusiness: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "business" }, { onConflict: "user_id,role" });
    if (error) {
      console.error("[business-role] grant failed", error.message);
      return { ok: false, error: "failed" };
    }
    return { ok: true, isBusiness: true, alreadyBusiness: false };
  });
