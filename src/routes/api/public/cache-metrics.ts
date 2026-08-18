import { createFileRoute } from "@tanstack/react-router";

/**
 * Kennzahlen des serverseitigen Kurzzeit-Caches.
 *
 * Gibt ausschließlich aggregierte Zähler zurück (Treffer, Fehlschläge,
 * eingesparte Datenbankabfragen, Ladezeiten, Speicherverbrauch der Instanz) –
 * keine Cache-Inhalte, keine Nutzerdaten. Dient der Messung von Trefferquote
 * und Entlastung der Datenbank, z. B. während eines Belastungstests.
 */
export const Route = createFileRoute("/api/public/cache-metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Interner Messendpunkt: nur mit Server-Secret aufrufbar.
        const { isAuthorizedWorkerRequest } = await import("@/lib/worker-auth.server");
        if (
          !isAuthorizedWorkerRequest(request, [
            "METRICS_CRON_TOKEN",
            "COUNTERS_CRON_TOKEN",
            "MODERATION_CRON_TOKEN",
          ])
        ) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { serverCacheMetrics } = await import("@/lib/server-cache.server");
        const { runtimeMetrics, measureEventLoopLagMs } = await import(
          "@/lib/runtime-metrics.server"
        );
        const { httpCacheMetrics } = await import("@/lib/http-cache.server");
        const memory =
          typeof process !== "undefined" && typeof process.memoryUsage === "function"
            ? (() => {
                const m = process.memoryUsage();
                return {
                  heapUsedMb: Number((m.heapUsed / 1048576).toFixed(1)),
                  rssMb: Number((m.rss / 1048576).toFixed(1)),
                };
              })()
            : null;
        const cpu =
          typeof process !== "undefined" && typeof process.cpuUsage === "function"
            ? (() => {
                const c = process.cpuUsage();
                return {
                  userSeconds: Number((c.user / 1_000_000).toFixed(2)),
                  systemSeconds: Number((c.system / 1_000_000).toFixed(2)),
                };
              })()
            : null;
        return Response.json(
          {
            ok: true,
            cache: serverCacheMetrics(),
            httpCache: httpCacheMetrics(),
            runtime: runtimeMetrics(),
            eventLoopLagMs: await measureEventLoopLagMs(),
            memory,
            cpu,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },

    },
  },
});
