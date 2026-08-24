import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Serverseitiger Supabase-Client mit dem öffentlichen (publishable) Key.
 * Wird für Auth-Vorgänge genutzt, die erst nach erfolgreicher
 * Turnstile-Prüfung ausgeführt werden dürfen.
 */
export function createPublicServerClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
  const url = process.env["SUPABASE_URL"] ?? "";
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}
