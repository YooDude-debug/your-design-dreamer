import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Waveform } from "@/components/Waveform";

/**
 * Gemeinsame Positionierungslogik für den Werbe-SlangTag.
 *
 * Wie bei normalen User-Posts liegt der SlangTag als Overlay direkt auf der
 * Bildfläche und wird ausschließlich in Prozent relativ zum Bild-Container
 * positioniert (unten links). Damit wandert er proportional mit – egal ob
 * kleine Feed-Vorschau, große Werbeansicht, Desktop oder Smartphone.
 *
 * `scaleRefWidth`: Referenzbreite der großen Ansicht. Ist sie gesetzt, wird der
 * Chip proportional zur tatsächlichen Bildbreite skaliert (Ursprung unten links),
 * damit er in der kleinen Vorschau exakt an derselben relativen Bildposition
 * sitzt wie in der großen Anzeige.
 *
 * Voraussetzung: der Bild-Wrapper ist `relative` und begrenzt (`overflow-hidden`).
 */
export const AD_SLANGTAG_POS = { leftPct: 4, bottomPct: 5 } as const;

export function AdSlangTag({
  name,
  playing,
  onToggle,
  size = "sm",
  duration,
  badge = false,
  scaleRefWidth,
}: {
  name: string;
  playing: boolean;
  onToggle: () => void;
  size?: "sm" | "lg";
  duration?: string;
  badge?: boolean;
  scaleRefWidth?: number;
}) {
  const lg = size === "lg";
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // Proportionale Skalierung anhand der echten Bildbreite (kein fester Pixelwert).
  useEffect(() => {
    if (!scaleRefWidth) return;
    const host = wrapRef.current?.parentElement;
    if (!host) return;
    const apply = () => {
      const w = host.getBoundingClientRect().width;
      if (w > 0) setScale(Math.min(1, w / scaleRefWidth));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    return () => ro.disconnect();
  }, [scaleRefWidth]);

  return (
    <div
      ref={wrapRef}
      style={{
        left: `${AD_SLANGTAG_POS.leftPct}%`,
        bottom: `${AD_SLANGTAG_POS.bottomPct}%`,
        width: scaleRefWidth ? `${(100 - AD_SLANGTAG_POS.leftPct * 2) / scale}%` : undefined,
        transform: scaleRefWidth ? `scale(${scale})` : undefined,
        transformOrigin: "bottom left",
      }}
      className="absolute z-10 max-w-[92%] origin-bottom-left"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={`$$${name}`}
        className={`inline-flex min-w-0 max-w-full items-center rounded-full border border-brand-cyan/50 bg-background/70 font-bold text-brand-cyan backdrop-blur ${
          lg ? "gap-2 px-3 py-1.5 text-[12px]" : "gap-1 px-1.5 py-1 text-[10px]"
        }`}
      >
        {playing ? (
          <Pause className={lg ? "h-3.5 w-3.5 shrink-0" : "h-3 w-3 shrink-0"} />
        ) : (
          <Play className={lg ? "h-3.5 w-3.5 shrink-0" : "h-3 w-3 shrink-0"} />
        )}
        <span className="truncate">$${name}</span>
        <Waveform
          bars={lg ? 14 : 8}
          color="var(--brand-cyan)"
          animated={playing}
          className={lg ? "ml-auto h-4 w-14 shrink-0" : "ml-auto h-3 w-6 shrink-0"}
        />
        {duration && lg && (
          <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
            {duration}
          </span>
        )}
        {badge && (
          <span className="shrink-0 rounded-full border border-brand-cyan/50 px-1.5 text-[9px] font-bold uppercase tracking-widest">
            AD
          </span>
        )}
      </button>
    </div>
  );
}
