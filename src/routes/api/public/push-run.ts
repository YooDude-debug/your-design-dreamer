import { createFileRoute } from "@tanstack/react-router";

/**
 * Hintergrundlauf des Push-Versands. Aufrufer: ausschliesslich vertrauens-
 * wuerdige Server-/Zeitplan-Aufrufe (Cron).
 *
 * Autorisierung: geteiltes Server-Geheimnis (`PUSH_CRON_TOKEN` oder das
 * bestehende Worker-Geheimnis `MODERATION_CRON_TOKEN`) im Header
 * `x-worker-secret` bzw. `Authorization: Bearer …`, zeitkonstant verglichen.
 * Oeffentliche/publishable Supabase-Schluessel gelten NICHT als Berechtigung.
 * Es werden ausschliesslich bereits erzeugte Benachrichtigungen verschickt und
 * keine Nutzerdaten zurueckgegeben.
 */
export const Route = createFileRoute("/api/public/push-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedWorkerRequest } = await import("@/lib/worker-auth.server");
        if (!isAuthorizedWorkerRequest(request, ["PUSH_CRON_TOKEN", "MODERATION_CRON_TOKEN"])) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { processNotificationQueue, cleanupPushData } = await import("@/lib/push.server");
        try {
          const result = await processNotificationQueue(50);
          await cleanupPushData();
          return Response.json({ ok: true, ...result });
        } catch (error) {
          console.error("[push-run] failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
      OPTIONS: () => new Response(null, { status: 204 }),
    },
  },
});
