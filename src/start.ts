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

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("[errorMiddleware]", error);
    // Zentrale Fehlererfassung: unerwartete Serverfehler landen in der
    // Überwachung (nur Fehlertyp, Meldung und Pfad – keine Nutzdaten).
    try {
      const { recordOpsFailure } = await import("./lib/ops-monitor.server");
      await recordOpsFailure("api", "unhandled_server_error", error, {
        request,
        fn: new URL(request.url).pathname,
        service: request.headers.get("x-tsr-serverFn") === "true" ? "server_fn" : "ssr",
      });
    } catch (reportError) {
      console.error("[errorMiddleware] reporting failed", reportError);
    }

    // Server-Funktionen dürfen keine HTML-Fehlerseite bekommen – der Client
    // kann sie nicht lesen und rendert dann eine leere Seite. Der Fehler wird
    // weitergeworfen, damit das Framework ihn serialisiert.
    if (request.headers.get("x-tsr-serverFn") === "true") {
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
