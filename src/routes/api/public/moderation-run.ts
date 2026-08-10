/**
 * Hintergrund-Worker fuer die KI-Moderation von Beitraegen.
 *
 * Aufrufer: ausschliesslich vertrauenswuerdige Server-/Zeitplan-Aufrufe (Cron).
 * Die Oberflaeche startet den Worker nicht mehr ueber diese Route, sondern
 * ueber die angemeldete Serverfunktion `runModerationQueue`.
 *
 * Autorisierung: geteiltes Server-Geheimnis `MODERATION_CRON_TOKEN`
 * (Header `x-worker-secret` oder `Authorization: Bearer …`), zeitkonstant
 * verglichen. Oeffentliche/publishable Supabase-Schluessel werden bewusst NICHT
 * mehr als Berechtigung akzeptiert.
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export const Route = createFileRoute("/api/public/moderation-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["MODERATION_CRON_TOKEN"] ?? "";
        const header =
          request.headers.get("x-worker-secret") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

        if (!expected || !header || !safeEqual(header, expected)) {
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
