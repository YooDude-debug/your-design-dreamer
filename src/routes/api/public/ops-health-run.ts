import { createFileRoute } from "@tanstack/react-router";

/**
 * Wiederkehrende Systemprüfung (Observability, Phase 3).
 *
 * Prüft aktiv Datenbank, Datenbankfunktionen, Push-Warteschlange und
 * Zahlungszustände, meldet Auffälligkeiten an die Überwachung und räumt alte
 * Ereignisse auf. Gibt ausschließlich technische Zahlen zurück – keine
 * Nutzerdaten.
 */
export const Route = createFileRoute("/api/public/ops-health-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedWorkerRequest } = await import("@/lib/worker-auth.server");
        if (
          !isAuthorizedWorkerRequest(request, ["OPS_HEALTH_CRON_TOKEN", "MODERATION_CRON_TOKEN"])
        ) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { opsHealthChecks, opsHousekeeping, pingHeartbeat } =
            await import("@/lib/ops-monitor.server");
          const checks = await opsHealthChecks(request);
          const cleanup = await opsHousekeeping();
          // Lebenszeichen erst nach erfolgreicher Pruefung: bleibt es aus,
          // alarmiert der externe Dienst unabhaengig von Y-Dude.
          const heartbeat = await pingHeartbeat();
          return Response.json({ ok: true, checks, cleanup, heartbeat });
        } catch (error) {
          console.error("[ops-health-run] failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
