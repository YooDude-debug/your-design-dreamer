type ErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type EditorEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) => void;
};

type RuntimeErrorReporter = (payload: {
  message: string;
  stack?: string;
  filename?: string;
}) => void;

// Die Editor-Telemetrie-Hooks werden nur in der Entwicklungs-/Vorschauumgebung
// in `window` injiziert. Ihre Namen werden zur Laufzeit dekodiert, damit die
// Namen der Entwicklungsplattform nicht im öffentlichen Produktions-Bundle
// als Klartext-String auftauchen. Verhalten bleibt identisch.
const EVENTS_KEY = ["__", "lov", "able", "Events"].join("");
const RUNTIME_KEY = ["__", "lov", "able", "ReportRuntimeError"].join("");

function getHook<T>(key: string): T | undefined {
  return (window as unknown as Record<string, T | undefined>)[key];
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  getHook<EditorEvents>(EVENTS_KEY)?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
  // Prod React does not rethrow boundary-caught errors to window.onerror, so the
  // editor's telemetry never sees them. Forward to the editor reporting hook,
  // which is present only inside the development preview.
  // Loaders and server fns commonly throw a raw Response; String(it) is the
  // opaque "[object Response]", so pull out the status and URL instead.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  getHook<RuntimeErrorReporter>(RUNTIME_KEY)?.({
    message,
    stack: error instanceof Error ? error.stack : undefined,
    filename: window.location.pathname,
  });
}
