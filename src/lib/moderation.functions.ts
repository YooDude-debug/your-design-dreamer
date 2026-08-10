import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Startet den Moderations-Worker fuer angemeldete Nutzer.
 *
 * Die Autorisierung erfolgt serverseitig ueber die bestehende Anmeldung –
 * es gelangt kein Geheimnis in die Oberflaeche. Der Worker verarbeitet nur
 * bereits gespeicherte Auftraege und gibt keine Inhalte zurueck.
 */
export const runModerationQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ processed: number }> => {
    const { processModerationQueue } = await import("@/lib/moderation-queue.server");
    const results = await processModerationQueue(5);
    return { processed: results.length };
  });
