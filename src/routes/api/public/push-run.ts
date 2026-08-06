import { createFileRoute } from "@tanstack/react-router";

/**
 * Hintergrundlauf des Push-Versands. Kann von einem Zeitplan (cron) oder
 * intern angestossen werden; verschickt ausschliesslich bereits erzeugte
 * Benachrichtigungen und gibt keine Nutzerdaten zurueck.
 */
export const Route = createFileRoute("/api/public/push-run")({
  server: {
    handlers: {
      POST: async () => {
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
    },
  },
});
