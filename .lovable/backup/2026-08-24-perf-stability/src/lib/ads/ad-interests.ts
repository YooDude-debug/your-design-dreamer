/**
 * Gemeinsame Quelle für die gespeicherte Werbefeed-Auswahl
 * (`ad_preferences.interests`).
 *
 * Vorher haben mehrere Stellen (Werbefeed-Panel und Targeting-Hook) dieselbe
 * kleine Zeile unabhängig voneinander gelesen. Über den bestehenden
 * Kurzzeit-Cache entsteht daraus nur noch eine Datenbankabfrage; ein Speichern
 * verwirft den Eintrag gezielt, damit die Auswahl sofort greift.
 */

import { supabase } from "@/integrations/supabase/client";
import { cachedClientRead, invalidateClientCache } from "@/lib/client-cache";

export function adInterestsKey(userId: string) {
  return `ads:interests:${userId}`;
}

/** Liest die Interessen des Nutzers (geteilt, dedupliziert). */
export async function loadAdInterests(userId: string): Promise<string[]> {
  return cachedClientRead(adInterestsKey(userId), async () => {
    const { data } = await supabase
      .from("ad_preferences")
      .select("interests")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.interests ?? []) as string[];
  });
}

/** Nach dem Speichern aufrufen, damit der nächste Lesevorgang frisch ist. */
export function invalidateAdInterests(userId: string) {
  invalidateClientCache(adInterestsKey(userId));
}
