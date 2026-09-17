/**
 * Y-Dude Market – NUR LESENDER Rechte-Gesundheitscheck (Diagnose, Fix B).
 *
 * Hintergrund: Die Verkaufsbestätigung (`market_complete_transaction`) und
 * serverseitige Chat-Systemnachrichten (`public.messages`) laufen bewusst über
 * den privilegierten Serverclient (`supabaseAdmin`). Traten in Production
 * Rechtefehler auf, lag die Ursache in der Serverumgebung – der Aufruf kam
 * nicht als `service_role` an. Policies und Grants waren korrekt.
 *
 * Dieser Check stellt genau das fest, OHNE etwas zu verändern:
 * - Sind die erwarteten Serverumgebungsvariablen vorhanden?
 * - Ist der Lesezugriff möglich, den nur eine privilegierte Rolle hat
 *   (`public.messages` hat für `anon` KEIN SELECT)?
 *
 * Sicherheitsregeln dieses Moduls:
 * - Es werden NIE Schlüssel, Tokens oder Schlüsselteile gelesen, geloggt oder
 *   zurückgegeben – nur „vorhanden ja/nein“.
 * - Ausschliesslich lesende Abfragen: keine Inserts, Updates, Deletes und kein
 *   Aufruf der Abschlussfunktion.
 * - Keine Policies, Grants, Rollen oder Migrationen werden verändert.
 */

export type MarketPermissionHealth = {
  /** Erwartete Serverumgebung vorhanden (ohne Werte preiszugeben). */
  env: { supabaseUrl: boolean; serviceRoleKey: boolean };
  /**
   * Lesesonden. `true` = erlaubt, `false` = verweigert (mit Fehlercode).
   * `messages` ist die aussagekräftige Sonde: für `anon` ist SELECT entzogen.
   */
  probes: {
    messagesSelect: { ok: boolean; code: string | null };
    transactionsSelect: { ok: boolean; code: string | null };
  };
  /** „ok“ nur, wenn Umgebung vorhanden ist und beide Lesesonden gelingen. */
  status: "ok" | "degraded";
  /** Klartexthinweise zur Zuordnung im Fehlerfall (ohne Secrets). */
  notes: string[];
};

export async function marketPermissionHealth(): Promise<MarketPermissionHealth> {
  const notes: string[] = [];
  const env = {
    supabaseUrl: Boolean(process.env["SUPABASE_URL"]),
    serviceRoleKey: Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]),
  };
  if (!env.supabaseUrl) notes.push("SUPABASE_URL fehlt in der Serverumgebung.");
  if (!env.serviceRoleKey) notes.push("SUPABASE_SERVICE_ROLE_KEY fehlt in der Serverumgebung.");

  const probes: MarketPermissionHealth["probes"] = {
    messagesSelect: { ok: false, code: env.serviceRoleKey ? null : "env_missing" },
    transactionsSelect: { ok: false, code: env.serviceRoleKey ? null : "env_missing" },
  };

  if (env.supabaseUrl && env.serviceRoleKey) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const messages = await supabaseAdmin.from("messages").select("id").limit(1);
    probes.messagesSelect = {
      ok: !messages.error,
      code: messages.error?.code ?? null,
    };
    if (messages.error) {
      notes.push(
        "Lesezugriff auf messages verweigert – der Serveraufruf erreicht die " +
          "Datenbank nicht mit der Service-Role-Berechtigung.",
      );
    }
    const transactions = await supabaseAdmin.from("market_transactions").select("id").limit(1);
    probes.transactionsSelect = {
      ok: !transactions.error,
      code: transactions.error?.code ?? null,
    };
  }

  const status: MarketPermissionHealth["status"] =
    env.supabaseUrl &&
    env.serviceRoleKey &&
    probes.messagesSelect.ok &&
    probes.transactionsSelect.ok
      ? "ok"
      : "degraded";

  if (status === "degraded") {
    // Eindeutig zuordenbarer Logeintrag – ohne Secrets, ohne Nutzerdaten.
    console.error("[market] permission health degraded", { env, probes, notes });
  }
  return { env, probes, status, notes };
}
