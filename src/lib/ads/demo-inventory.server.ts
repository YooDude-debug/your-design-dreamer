/**
 * Serverseitige Freigabe des Demo-/Testwerbebestands.
 *
 * Gleiche Regel wie im Client (`demo-inventory.ts`): Demowerbung nur für
 * Admin-Konten und nur bei aktivem Werbe-Testmodus. Fehler werden bewusst als
 * „nicht erlaubt“ gewertet – im Zweifel wird keine Demowerbung ausgespielt.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";


export async function isDemoInventoryAllowedFor(userId: string): Promise<boolean> {
  try {
    const [role, settings] = await Promise.all([
      supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabaseAdmin.from("ad_test_settings").select("enabled").eq("id", true).maybeSingle(),
    ]);
    // Gleiche Regel wie im Client: Admin UND aktiver Testmodus.
    return role.data === true && settings.data?.enabled === true;
  } catch {
    return false;
  }
}
