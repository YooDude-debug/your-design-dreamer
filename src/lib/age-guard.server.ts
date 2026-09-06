import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { allowsAdvertisingProfiling, type AgeStatus } from "@/lib/age-policy";

/**
 * Serverseitiger Jugendschutz fuer Werbe-Profiling.
 *
 * Der Altersstatus wird ausschliesslich aus der Datenbank abgeleitet
 * (`public.my_age_status()`), nie aus Client-Angaben. Bei Fehlern oder
 * fehlendem Geburtsdatum gilt fail-closed: kein personalisiertes Profiling.
 */
export async function currentAgeStatus(supabase: SupabaseClient<Database>): Promise<AgeStatus> {
  const { data, error } = await supabase.rpc("my_age_status");
  if (error) return "UNKNOWN";
  const value = (data ?? "UNKNOWN") as string;
  return value === "BLOCKED" || value === "MINOR_14_17" || value === "ADULT_18_PLUS"
    ? (value as AgeStatus)
    : "UNKNOWN";
}

/** true = dieses Konto darf NICHT in personalisiertes Werbe-Profiling. */
export async function advertisingProfilingBlocked(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  return !allowsAdvertisingProfiling(await currentAgeStatus(supabase));
}
