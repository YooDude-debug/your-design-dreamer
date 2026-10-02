/**
 * P2: von ORB erzeugtes Bild als eigene ORB-Nachricht. Nur Sitzungszustand
 * (Data-URL im Browser) – nie gespeichert, nie Teil des Nachrichtentexts.
 */

import { ImageOff } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";

export type OrbVisualItem = {
  key: string;
  /** ORB-Nachricht, nach der das Bild erscheint. */
  afterMessageId: string | null;
  /** `memory` = gespeichertes Bild einer abgerufenen Erinnerung (Visual Memory). */
  kind: "explicit" | "autonomous" | "memory";
  status: "loading" | "ok" | "error";
  src?: string;
  message?: string;
  /** Nur bei `memory`: Herkunft des gespeicherten Bildes. */
  origin?: "user_upload" | "orb_generated" | "unknown";
  createdAt?: string;
};

const ORIGIN_LABEL = {
  user_upload: "von dir hochgeladen",
  orb_generated: "von ORB erzeugt",
  unknown: "Herkunft unbekannt",
} as const;

export function OrbVisualMessage({ item }: { item: OrbVisualItem }) {
  return (
    <div className="flex justify-start" data-testid="orb-visual" data-status={item.status}>
      <div className="max-w-[92%] px-1 py-1 text-foreground">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {item.kind === "memory"
            ? `Bild aus Erinnerung · ${ORIGIN_LABEL[item.origin ?? "unknown"]}${
                item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString()}` : ""
              }`
            : "Bild"}
        </span>
        {item.status === "loading" && (
          <div
            role="status"
            className="mt-1 grid size-56 place-content-center rounded-lg border border-border bg-muted/40"
          >
            <Shimmer>ORB erstellt ein Bild …</Shimmer>
          </div>
        )}
        {item.status === "ok" && item.src && (
          <img
            src={item.src}
            alt={item.kind === "memory" ? "Gespeichertes Bild einer Erinnerung" : "Von ORB erstelltes Bild"}
            className="mt-1 w-full max-w-sm rounded-lg border border-border"
          />
        )}
        {item.status === "error" && (
          <p
            role="status"
            className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          >
            <ImageOff className="size-4 shrink-0" aria-hidden />
            {item.message ?? "Das Bild konnte nicht erstellt werden."}
          </p>
        )}
      </div>
    </div>
  );
}
