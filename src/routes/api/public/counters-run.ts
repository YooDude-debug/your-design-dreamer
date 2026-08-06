import { createFileRoute } from "@tanstack/react-router";

/**
 * Hintergrundlauf der Zählerverarbeitung.
 *
 * Aufrufe (views) und Wiedergaben (plays) werden in der Warteschlange
 * `counter_events` gesammelt und hier gebündelt verrechnet: pro betroffener
 * Zeile genau ein UPDATE statt eines UPDATEs je Ereignis. Dadurch entstehen
 * deutlich weniger Zeilensperren; die angezeigten Zahlen bleiben identisch.
 *
 * Der Endpunkt gibt keine Nutzerdaten zurück, nur die Anzahl verrechneter
 * Zeilen. Er kann von einem Zeitplan (cron) oder intern angestossen werden.
 */
export const Route = createFileRoute("/api/public/counters-run")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { flushCounterEvents } = await import("@/lib/counters.server");
          const applied = await flushCounterEvents();
          return Response.json({ ok: true, applied });
        } catch (error) {
          console.error("[counters-run] failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
