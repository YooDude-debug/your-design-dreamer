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
}: {
  name: string;
  playing: boolean;
  onToggle: () => void;
  size?: "sm" | "lg";
  duration?: string;
  badge?: boolean;
}) {
  const lg = size === "lg";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={`$$${name}`}
      style={{
        left: `${AD_SLANGTAG_POS.leftPct}%`,
        bottom: `${AD_SLANGTAG_POS.bottomPct}%`,
        maxWidth: `${100 - AD_SLANGTAG_POS.leftPct * 2}%`,
      }}
      className={`absolute z-10 inline-flex min-w-0 items-center rounded-full border border-brand-cyan/50 bg-background/70 font-bold text-brand-cyan backdrop-blur ${
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
        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{duration}</span>
      )}
      {badge && (
        <span className="shrink-0 rounded-full border border-brand-cyan/50 px-1.5 text-[9px] font-bold uppercase tracking-widest">
          AD
        </span>
      )}
    </button>
  );
}
