/**
 * Dezenter Hinweis zum Experimentalstatus von ORB Core und zur Verarbeitung
 * von Inhalten durch externe KI-Dienste. Sachlich formuliert, ORB bleibt als
 * KI-System gekennzeichnet – keine Behauptung von Bewusstsein.
 */

import { Info } from "lucide-react";

export function OrbExperimentNotice() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        ORB Core ist ein experimentelles KI-System. Funktionen und Verhalten können sich während der
        Entwicklung verändern. Für bestimmte Funktionen können Inhalte an externe KI-Dienste
        übertragen und dort verarbeitet werden.
      </span>
    </p>
  );
}
