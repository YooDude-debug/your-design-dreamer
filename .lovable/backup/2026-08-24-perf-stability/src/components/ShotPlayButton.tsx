import { Loader2, Pause, Play } from "lucide-react";

/**
 * Gemeinsamer Start-Trigger eines SlangShots (Video + aktuell ausgewaehlter
 * SlangTag). Ohne Druck auf diesen Button startet nichts – kein Autoplay.
 */
export function ShotPlayButton({
  playing,
  preparing,
  onToggle,
  label = "Play",
  pauseLabel = "Pause",
}: {
  playing: boolean;
  preparing: boolean;
  onToggle: () => void;
  label?: string;
  pauseLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={playing ? pauseLabel : label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`absolute left-1/2 top-1/2 z-20 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-brand/60 bg-black/60 text-brand shadow-glow backdrop-blur transition-opacity ${
        playing ? "opacity-0 hover:opacity-100 focus:opacity-100" : "opacity-100"
      }`}
    >
      {preparing ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : playing ? (
        <Pause className="h-6 w-6" />
      ) : (
        <Play className="h-6 w-6 translate-x-[1px]" />
      )}
    </button>
  );
}
