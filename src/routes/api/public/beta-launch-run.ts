import { createFileRoute } from "@tanstack/react-router";

/**
 * Zeitgesteuerter Lauf der Open-Beta-Startbenachrichtigung.
 *
 * Zugriff ausschliesslich mit Server-Secret (`x-worker-secret` oder Bearer).
 * Der Lauf sendet nur, wenn die offene Beta aktiviert und der geplante
 * Zeitpunkt (10:00 Uhr Europe/Berlin) erreicht ist. Es werden ausschliesslich
 * Zahlen zurueckgegeben, niemals E-Mail-Adressen.
 */
export const Route = createFileRoute("/api/public/beta-launch-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedWorkerRequest } = await import("@/lib/worker-auth.server");
        if (
          !isAuthorizedWorkerRequest(request, ["BETA_LAUNCH_CRON_TOKEN", "MODERATION_CRON_TOKEN"])
        ) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runBetaLaunchDispatch } = await import("@/lib/beta-launch.server");
          const report = await runBetaLaunchDispatch();
          return Response.json({ ok: true, ...report });
        } catch (error) {
          console.error("[beta-launch-run] failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
