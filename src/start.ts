import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Laufzeit-Kennzahlen: zählt nur anonyme Summen (Anzahl, gleichzeitig laufende
// Anfragen, Dauer, Fehler) und verändert die Antwort nie.
const metricsMiddleware = createMiddleware().server(async ({ next }) => {
  const { trackRequestStart } = await import("./lib/runtime-metrics.server");
  const finish = trackRequestStart();
  try {
    const result = await next();
    finish(true);
    return result;
  } catch (error) {
    finish(false);
    throw error;
  }
});

/**
 * Erkennt Aufrufe eines veralteten Client-Bundles: Die gesendete
 * Server-Function-ID (base64 aus Dateipfad + Export) stammt aus einem
 * früheren Build und existiert im aktuellen Server-Manifest nicht mehr.
 * Das ist kein Serverausfall, sondern ein Client-Cache-Problem.
 */
function isStaleClientCall(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return message.toLowerCase().includes("invalid server function id");
}

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const isServerFn = request.headers.get("x-tsr-serverFn") === "true";
    const staleClient = isStaleClientCall(error);
    console.error("[errorMiddleware]", error);
    // Zentrale Fehlererfassung: unerwartete Serverfehler landen in der
    // Überwachung (nur Fehlertyp, Meldung und Pfad – keine Nutzdaten).
    // Veraltete Client-Bundles werden separat gruppiert, damit ein echter
    // Backend-Ausfall nicht in denselben Vorfall läuft. Erfasst und alarmiert
    // wird weiterhin – nur eben unter eigener Kennung.
    try {
      const { recordOpsEvent } = await import("./lib/ops-monitor.server");
      await recordOpsEvent({
        area: "api",
        event: staleClient ? "stale_client_server_fn" : "unhandled_server_error",
        error,
        severity: staleClient ? "warning" : "critical",
        request,
        fn: new URL(request.url).pathname,
        service: staleClient ? "stale_client" : isServerFn ? "server_fn" : "ssr",
      });

    } catch (reportError) {
      console.error("[errorMiddleware] reporting failed", reportError);
    }

    // Veraltetes Bundle: eindeutige Antwort, damit der Client seine Caches
    // verwirft und sich einmalig neu lädt (siehe recover-stale-bundle.ts).
    if (staleClient) {
      return new Response(
        JSON.stringify({ error: "stale_client_bundle", reload: true }),
        {
          status: 409,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "x-ydude-stale-client": "1",
          },
        },
      );
    }

    // Server-Funktionen dürfen keine HTML-Fehlerseite bekommen – der Client
    // kann sie nicht lesen und rendert dann eine leere Seite. Der Fehler wird
    // weitergeworfen, damit das Framework ihn serialisiert.
    if (isServerFn) {
      throw error;
    }
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});


// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [metricsMiddleware, errorMiddleware, csrfMiddleware],
}));
