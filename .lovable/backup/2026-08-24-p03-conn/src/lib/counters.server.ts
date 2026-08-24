/**
 * Gebündelte Zählerverarbeitung (nur Server).
 *
 * Aufrufe und Wiedergaben werden von Datenbank-Triggern in die Warteschlange
 * `counter_events` geschrieben. Hier werden sie zusammengefasst verrechnet.
 */

/** Verrechnet offene Zählerereignisse; liefert die Anzahl betroffener Zeilen. */
export async function flushCounterEvents(max = 5000): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("flush_counter_events", { _max: max });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
