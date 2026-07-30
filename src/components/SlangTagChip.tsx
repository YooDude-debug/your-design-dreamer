import { useEffect, useRef, useState } from "react";
import { Play, Pause, MapPin, Heart } from "lucide-react";
import { Waveform } from "@/components/Waveform";
import { useData } from "@/lib/data";
import { formatStat, type SlangTag, type SlangTagPlacement } from "@/lib/types";

type Props = {
  tag: SlangTag;
  variant?: SlangTagPlacement["variant"];
  showRegion?: boolean;
  showStats?: boolean;
  onOpen?: () => void;
  className?: string;
};

/** Glassmorphes, interaktives SlangTag-Element. Tippen spielt NUR das Audio ab. */
export function SlangTagChip({
  tag,
  variant = "compact",
  showRegion = true,
  showStats = true,
  onOpen,
  className = "",
}: Props) {
  const { registerPlay } = useData();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!tag.audio) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(tag.audio);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play();
      setPlaying(true);
      void registerPlay(tag.id);
    }
  };

  const glass =
    "rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-[0_0_18px_oklch(0.82_0.24_150/0.22)]";

  const PlayButton = ({ size = "h-6 w-6", icon = "h-2.5 w-2.5" }: { size?: string; icon?: string }) => (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? `${tag.name} pausieren` : `${tag.name} abspielen`}
      className={`grid ${size} shrink-0 place-items-center rounded-full border transition-transform hover:scale-105 ${
        playing ? "border-brand bg-brand/25 text-brand shadow-glow" : "border-brand/60 bg-black/40 text-brand"
      }`}
    >
      {playing ? <Pause className={icon} /> : <Play className={`${icon} fill-current`} />}
    </button>
  );

  if (variant === "dot") {
    return (
      <div className={`inline-flex flex-col items-start gap-0.5 ${className}`}>
        <div className={`inline-flex items-center gap-1.5 px-1.5 py-1 pr-2 ${glass}`}>
          <PlayButton size="h-5 w-5" icon="h-2 w-2" />
          <button
            type="button"
            onClick={onOpen}
            className="text-[11px] font-bold leading-none tracking-tight text-white hover:text-brand"
          >
            ${tag.name}
          </button>
        </div>
        {showStats && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] text-white/90 ${glass} rounded-md`}>
            <Play className="h-2 w-2 fill-current" /> {formatStat(tag.stats.plays)}
          </span>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`${glass} inline-block px-2 py-1.5 ${className}`}>
        <div className="flex items-center gap-1.5">
          <PlayButton size="h-6 w-6" icon="h-2.5 w-2.5" />
          <Waveform bars={16} className="h-3 w-14" animated={playing} />
          <button
            type="button"
            onClick={onOpen}
            className="text-xs font-black leading-none tracking-tight text-white hover:text-brand"
          >
            ${tag.name}
          </button>
        </div>
        {showStats && (
          <div className="mt-1 flex items-center gap-2 border-t border-white/15 pt-1 text-[9px] text-white/85">
            <span className="inline-flex items-center gap-0.5">
              <Play className="h-2 w-2" /> {formatStat(tag.stats.plays)}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <Heart className="h-2 w-2" /> {formatStat(tag.stats.likes)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${glass} inline-block px-2.5 py-2 ${className}`}>
      <div className="flex items-center gap-2">
        <PlayButton size="h-7 w-7" icon="h-3 w-3" />
        <Waveform bars={20} className="h-3.5 w-16" animated={playing} />
        <button
          type="button"
          onClick={onOpen}
          className="text-sm font-black leading-none tracking-tight text-white hover:text-brand"
        >
          ${tag.name}
        </button>
      </div>
      {(showRegion || showStats) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-white/15 pt-1.5 text-[10px] text-white/90">
          {showRegion && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" /> {tag.region.split(",")[0]}
            </span>
          )}
          {showStats && (
            <>
              <span className="inline-flex items-center gap-1">
                <Play className="h-2.5 w-2.5" /> {formatStat(tag.stats.plays)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-2.5 w-2.5" /> {formatStat(tag.stats.likes)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
