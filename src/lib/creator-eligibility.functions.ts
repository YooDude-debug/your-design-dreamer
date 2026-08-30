/**
 * Creator-Eligibility – serverseitige Prüfung und Rollenwechsel.
 *
 * Zählungen stammen ausschliesslich aus den bestehenden autoritativen Tabellen
 * (`connections` mit Status `accepted`, `follows`) und werden immer für die
 * Benutzer-ID aus der geprüften Session ermittelt. Frontend-Werte, Parameter
 * oder lokale Zustände werden nicht akzeptiert.
 *
 * Der Rollenwechsel schreibt ausschliesslich in die bestehende Rollenquelle
 * `public.user_roles` (Rolle `creator`). Es entsteht keine parallele
 * Rollenarchitektur; Admin- und Unternehmerrollen bleiben unberührt.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readCreatorEligibility } from "@/lib/creator-eligibility.server";
import type { CreatorEligibility } from "@/lib/creator-eligibility";

export type BecomeCreatorResult =
  | { ok: true; alreadyCreator: boolean; eligibility: CreatorEligibility }
  | { ok: false; error: "not_eligible"; eligibility: CreatorEligibility }
  | { ok: false; error: "failed" };

/** Liefert die Voraussetzung und den echten Rollenstatus des eigenen Kontos. */
export const getCreatorEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<CreatorEligibility> =>
      readCreatorEligibility(context.supabase, context.userId),
  );

/**
 * Startet den Wechsel zur bestehenden Creator-Rolle. Die Voraussetzung wird
 * serverseitig neu aus der Datenbank berechnet; übergebene Werte gibt es
 * bewusst nicht.
 */
export const becomeCreator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BecomeCreatorResult> => {
    const eligibility = await readCreatorEligibility(context.supabase, context.userId);
    if (eligibility.isCreator) return { ok: true, alreadyCreator: true, eligibility };
    if (!eligibility.eligible) return { ok: false, error: "not_eligible", eligibility };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "creator" }, { onConflict: "user_id,role" });
    if (error) {
      console.error("[creator-eligibility] role grant failed", error.message);
      return { ok: false, error: "failed" };
    }
    return { ok: true, alreadyCreator: false, eligibility: { ...eligibility, isCreator: true } };
  });
