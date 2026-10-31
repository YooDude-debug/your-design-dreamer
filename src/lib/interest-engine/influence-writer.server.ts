/**
 * SEC-03: Einziger Schreibweg für `connection_influence`.
 *
 * Nutzer haben kein direktes Schreibrecht auf die Tabelle. Die Engine
 * berechnet die Werte serverseitig und speichert sie hier mit Systemrechten –
 * ausschließlich Zeilen des angemeldeten Nutzers (`user_id === userId`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type InfluenceRow = Database["public"]["Tables"]["connection_influence"]["Insert"];

type Writer = Pick<SupabaseClient<Database>, "from">;

/** Behält nur Zeilen, die dem angemeldeten Nutzer gehören und keine Selbstverbindung sind. */
export function ownInfluenceRows(userId: string, rows: InfluenceRow[]): InfluenceRow[] {
  if (typeof userId !== "string" || userId.length === 0) return [];
  return rows.filter(
    (r) =>
      r.user_id === userId &&
      typeof r.peer_id === "string" &&
      r.peer_id.length > 0 &&
      r.peer_id !== userId,
  );
}

export async function writeConnectionInfluence(
  userId: string,
  rows: InfluenceRow[],
  writer?: Writer,
): Promise<number> {
  const own = ownInfluenceRows(userId, rows);
  if (own.length === 0) return 0;
  const db: Writer =
    writer ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { error } = await db
    .from("connection_influence")
    .upsert(own, { onConflict: "user_id,peer_id" });
  if (error) {
    console.error("[influence] write failed");
    return 0;
  }
  return own.length;
}
