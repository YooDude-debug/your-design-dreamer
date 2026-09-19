/**
 * Dezenter Hinweis zum Experimentalstatus von ORB Core und zur Verarbeitung
 * von Inhalten durch externe KI-Dienste. Sachlich formuliert, ORB bleibt als
 * KI-System gekennzeichnet – keine Behauptung von Bewusstsein.
 *
 * Kompakte Variante: Nur ein Info-Icon (neben dem EXPERIMENTELL-Badge im
 * ORB-Header). Der Hinweistext öffnet sich in einem Popover und ist nicht
 * mehr dauerhaft im Seitenfluss sichtbar. Inhalt des Textes unverändert.
 */

import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const ORB_EXPERIMENT_NOTICE_TEXT =
  "ORB Core ist ein experimentelles KI-System. Funktionen und Verhalten können sich während der " +
  "Entwicklung verändern. Für bestimmte Funktionen können Inhalte an externe KI-Dienste " +
  "übertragen und dort verarbeitet werden.";

export function OrbExperimentNotice() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        aria-label="Hinweis zum Experimentalstatus von ORB Core"
        data-testid="orb-experiment-notice-trigger"
      >
        <button
          type="button"
          className="shrink-0 rounded-full border border-brand/35 bg-brand/10 p-1.5 text-brand transition-colors hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={12}
        className="w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border-brand/35 bg-popover p-3 text-[11px] leading-relaxed text-muted-foreground shadow-subtle"
        data-testid="orb-experiment-notice-content"
      >
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
          <span>{ORB_EXPERIMENT_NOTICE_TEXT}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
