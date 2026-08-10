/**
 * Serverseitige Username-Prüfung.
 *
 * Die Liste verbotener/reservierter Usernames liegt zentral in der Datenbank
 * (`public.reserved_usernames`). Die Prüfung läuft über die SECURITY DEFINER
 * Funktion `public.username_status`, damit normale Nutzer die Liste selbst
 * nicht lesen oder verändern können. Zusätzlich erzwingt ein Datenbank-Trigger
 * die Sperre bei jedem Insert/Update von `profiles.username`.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { USERNAME_RE, type UsernameStatus } from "@/lib/username";

export async function usernameStatus(username: string): Promise<UsernameStatus> {
  const value = (username ?? "").trim();
  if (!USERNAME_RE.test(value)) return "invalid";
  const { data, error } = await supabaseAdmin.rpc("username_status", { _username: value });
  if (error) throw new Error(error.message);
  const status = String(data ?? "");
  return status === "available" || status === "taken" || status === "reserved" || status === "invalid"
    ? (status as UsernameStatus)
    : "invalid";
}

/** Bequemer Guard für Registrierung und Username-Änderung. */
export async function assertUsernameUsable(username: string): Promise<void> {
  const status = await usernameStatus(username);
  if (status !== "available") throw new Error(`USERNAME_${status.toUpperCase()}`);
}
