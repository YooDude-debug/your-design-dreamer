import { useEffect, useRef, useState } from "react";
import { Play, Pause, MapPin, Heart } from "lucide-react";
import { Waveform } from "@/components/Waveform";
import { useSlangTags, formatStat, type SlangTag, type SlangTagPlacement } from "@/lib/slangtags";

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
  variant = "glass",
  showRegion = true,
  showStats = true,
  onOpen,
  className = "",
}: Props) {
  const { bump } = useSlangTags();
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
      bump(tag.id, "plays");
    }
  };

  const glass =
    "rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-[0_0_30px_oklch(0.82_0.24_150/0.25)]";

  const PlayButton = ({ size = "h-11 w-11" }: { size?: string }) => (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? `${tag.name} pausieren` : `${tag.name} abspielen`}
      className={`grid ${size} shrink-0 place-items-center rounded-full border transition-transform hover:scale-105 ${
        playing
          ? "border-brand bg-brand/25 text-brand shadow-glow"
          : "border-brand/60 bg-black/40 text-brand"
      }`}
    >
      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
    </button>
  );

  if (variant === "dot") {
    return (
      <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
        <div className={`inline-flex items-center gap-2 px-2 py-1.5 pr-3 ${glass}`}>
          <PlayButton size="h-8 w-8" />
          <button
            type="button"
            onClick={onOpen}
            className="text-sm font-bold tracking-tight text-white hover:text-brand"
          >
            ${tag.name}
          </button>
        </div>
        {showStats && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-white/90 ${glass} rounded-lg`}>
            <Play className="h-2.5 w-2.5 fill-current" /> {formatStat(tag.stats.plays)}
          </span>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`${glass} inline-block px-3 py-2 ${className}`}>
        <div className="flex items-center gap-2.5">
          <PlayButton size="h-9 w-9" />
          <Waveform bars={22} className="h-5 w-24" animated={playing} />
          <button
            type="button"
            onClick={onOpen}
            className="text-base font-black tracking-tight text-white hover:text-brand"
          >
            ${tag.name}
          </button>
        </div>
        {showStats && (
          <div className="mt-1.5 flex items-center gap-3 border-t border-white/15 pt-1.5 text-[11px] text-white/85">
            <span className="inline-flex items-center gap-1">
              <Play className="h-3 w-3" /> {formatStat(tag.stats.plays)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" /> {formatStat(tag.stats.likes)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${glass} inline-block px-4 py-3 ${className}`}>
      <div className="flex items-center gap-3">
        <PlayButton />
        <Waveform bars={26} className="h-6 w-28" animated={playing} />
        <button
          type="button"
          onClick={onOpen}
          className="text-2xl font-black tracking-tight text-white hover:text-brand"
        >
          ${tag.name}
        </button>
      </div>
      {(showRegion || showStats) && (
        <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-white/15 pt-2 text-xs text-white/90">
          {showRegion && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {tag.region.split(",")[0]}
            </span>
          )}
          {showStats && (
            <>
              <span className="inline-flex items-center gap-1">
                <Play className="h-3.5 w-3.5" /> {formatStat(tag.stats.plays)} Plays
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" /> {formatStat(tag.stats.likes)} Likes
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
