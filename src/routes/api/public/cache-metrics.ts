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
      GET: async () => {
        const { serverCacheMetrics } = await import("@/lib/server-cache.server");
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
        return Response.json(
          { ok: true, cache: serverCacheMetrics(), memory },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
