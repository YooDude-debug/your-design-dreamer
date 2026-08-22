/**
 * Hintergrund-Worker fuer die KI-Moderation von Beitraegen.
 *
 * Aufrufer:
 * - die App direkt nach dem Veroeffentlichen (nicht blockierend, ohne Warten)
 * - ein Zeitplan (Cron) als Sicherheitsnetz fuer Wiederholungsversuche
 *
 * Die Route fuehrt selbst keine Freigabe fuer Aufrufer durch – sie arbeitet nur
 * bereits gespeicherte Auftraege ab und gibt keine Inhalte zurueck. Zusaetzlich
 * wird der oeffentliche API-Schluessel als einfacher Aufrufnachweis geprueft.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/moderation-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        const key = request.headers.get("apikey") ?? request.headers.get("x-api-key") ?? "";
        if (!expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { processModerationQueue } = await import("@/lib/moderation-queue.server");
        const results = await processModerationQueue(5);
        return Response.json({ processed: results.length, results });
      },
      OPTIONS: () => new Response(null, { status: 204 }),
    },
  },
});
