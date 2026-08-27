/**
 * Serverseitige Freigabe des Demo-/Testwerbebestands.
 *
 * Gleiche Regel wie im Client (`demo-inventory.ts`): Demowerbung nur für
 * Admin-Konten und nur bei aktivem Werbe-Testmodus. Fehler werden bewusst als
 * „nicht erlaubt“ gewertet – im Zweifel wird keine Demowerbung ausgespielt.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { demoInventoryAllowed } from "./demo-inventory";

export async function isDemoInventoryAllowedFor(userId: string): Promise<boolean> {
  try {
    const [role, settings] = await Promise.all([
      supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabaseAdmin.from("ad_test_settings").select("enabled").eq("id", true).maybeSingle(),
    ]);
    return demoInventoryAllowed({
      isAdmin: role.data === true,
      testMode: settings.data?.enabled === true,
    });
  } catch {
    return false;
  }
}
