import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AgeStatus } from "@/lib/age-policy";

/**
 * Altersstatus des angemeldeten Kontos.
 *
 * Die Ableitung erfolgt ausschliesslich in der Datenbank
 * (`public.my_age_status()`); das Geburtsdatum verlaesst den Server nie.
 * Fehlt eine Angabe oder schlaegt die Abfrage fehl, gilt fail-closed
 * `UNKNOWN` – damit ist kein personalisiertes Werbe-Profiling erlaubt.
 */
export const getMyAgeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ status: AgeStatus }> => {
    const { data, error } = await context.supabase.rpc("my_age_status");
    if (error) {
      console.error("[age] my_age_status", error.code ?? "", error.message);
      return { status: "UNKNOWN" };
    }
    const value = (data ?? "UNKNOWN") as string;
    return {
      status:
        value === "BLOCKED" || value === "MINOR_14_17" || value === "ADULT_18_PLUS"
          ? (value as AgeStatus)
          : "UNKNOWN",
    };
  });
