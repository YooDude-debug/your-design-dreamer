/**
 * Serverseitige Missbrauchsbremse (P-06).
 *
 * Für Vorgänge, die ausschliesslich über Server-Functions laufen (z. B. das
 * Anlegen von Beiträgen inklusive KI-Moderation) zählen wir die eigenen
 * Datensätze im Zeitfenster. Es wird keine zusätzliche Tabelle geschrieben –
 * die Prüfung ist ein reiner `count`-Zugriff auf einen bereits indizierten
 * Zeitstempel und damit sehr günstig.
 *
 * Vorgänge, die der Browser direkt in die Datenbank schreibt (Kommentare,
 * Nachrichten, SlangTags), werden zusätzlich per Datenbank-Trigger begrenzt und
 * können deshalb nicht am Client vorbei umgangen werden.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export async function checkRateLimit(options: {
  table: "posts" | "slang_tags" | "comments" | "messages";
  userColumn?: string;
  userId: string;
  /** Erlaubte Anzahl innerhalb des Fensters. */
  max: number;
  /** Fenstergrösse in Minuten. */
  windowMinutes: number;
}): Promise<RateLimitResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - options.windowMinutes * 60_000).toISOString();

  const { count, error } = await supabaseAdmin
    .from(options.table)
    .select("id", { count: "exact", head: true })
    .eq(options.userColumn ?? "user_id", options.userId)
    .gte("created_at", since);

  // Bei einem Zählfehler wird der Vorgang nicht blockiert (kein Ausfall der
  // Kernfunktion wegen der Bremse), der Fehler landet aber im Log.
  if (error) {
    console.warn("[rate-limit] count failed", { table: options.table, message: error.message });
    return { ok: true };
  }

  if ((count ?? 0) >= options.max) {
    return { ok: false, retryAfterSeconds: options.windowMinutes * 60 };
  }
  return { ok: true };
}
