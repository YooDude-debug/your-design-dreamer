/**
 * Eigene Fehleranzeige für ORB Core.
 *
 * Zeigt eine verständliche Meldung und einen Wiederholen-Knopf. Technische
 * Details (Meldungstexte, Aufrufstapel) werden nur in die Entwicklerkonsole
 * geschrieben und nie im Text angezeigt.
 */

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export function OrbErrorState({
  error,
  onRetry,
  retrying = false,
}: {
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  useEffect(() => {
    if (error) console.error("[orb] Fehler in ORB Core:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto my-6 w-full max-w-2xl rounded-2xl border border-border bg-background p-5 text-center"
    >
      <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-semibold">ORB ist momentan nicht verfügbar.</p>
      <p className="mt-1 text-sm text-muted-foreground">Bitte versuche es erneut.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" /> Erneut versuchen
        </button>
      )}
    </div>
  );
}
