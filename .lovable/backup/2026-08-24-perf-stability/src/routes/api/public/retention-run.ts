import { createFileRoute } from "@tanstack/react-router";

/**
 * Zeitgesteuerter Lauf der Aufbewahrungsfristen (technische Protokolle).
 *
 * Zugriff ausschliesslich mit Server-Secret (`x-worker-secret` oder Bearer).
 * Ohne konfigurierte Fristen löscht der Lauf nichts und liefert nur einen
 * Bericht. Es werden keine Nutzerdaten zurückgegeben.
 */
export const Route = createFileRoute("/api/public/retention-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedWorkerRequest } = await import("@/lib/worker-auth.server");
        if (
          !isAuthorizedWorkerRequest(request, ["RETENTION_CRON_TOKEN", "MODERATION_CRON_TOKEN"])
        ) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runRetention } = await import("@/lib/retention.server");
          const report = await runRetention();
          return Response.json({ ok: true, ...report });
        } catch (error) {
          console.error("[retention-run] failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
