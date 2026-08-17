import { useEffect, useRef, useState } from "react";
import { Play, Pause, MapPin, Heart } from "lucide-react";
import { Waveform } from "@/components/Waveform";
import { getAudio } from "@/lib/autoplay";
import { useData } from "@/lib/data-context";
import { formatStat, type SlangTag, type SlangTagPlacement } from "@/lib/types";
import { SlangTagName } from "@/components/SlangTagName";
import { slangTagTheme } from "@/lib/slangtag-ui";
import { openUnlockPrompt } from "@/lib/unlock-prompt";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";

type Props = {
  tag: SlangTag;
  variant?: SlangTagPlacement["variant"];
  showRegion?: boolean;
  showStats?: boolean;
  onOpen?: () => void;
  className?: string;
  /**
   * SlangShot: die Wiedergabe steuert der Sync-Controller. Der Chip zeigt dann
   * dessen Status und animiert die Wellenform anhand des echten Audios.
   */
  activePlaying?: boolean;
  activeMedia?: HTMLMediaElement | null;
  onActiveToggle?: () => void;
};

/** Glassmorphes, interaktives SlangTag-Element. Tippen spielt NUR das Audio ab. */
export function SlangTagChip({
  tag,
  variant = "compact",
  showRegion = true,
  showStats = true,
  onOpen,
  className = "",
  activePlaying,
  activeMedia = null,
  onActiveToggle,
}: Props) {
  const { registerPlay, isTagLocked } = useData();
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const [selfPlaying, setSelfPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Einmalig gesetzt, damit die Wellenform ein stabiles Medium erhaelt. */
  const [selfMedia, setSelfMedia] = useState<HTMLMediaElement | null>(null);
  /** Extern gesteuert (SlangShot) oder eigene Wiedergabe. */
  const external = onActiveToggle !== undefined;
  const playing = external ? !!activePlaying : selfPlaying;
  const waveMedia = external ? activeMedia : selfMedia;

  useEffect(() => () => audioRef.current?.pause(), []);

  const locked = isTagLocked(tag);
  const open = () => (locked ? openUnlockPrompt(tag) : onOpen?.());
  const lockedCls = locked ? "opacity-60" : "";

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (external) {
      onActiveToggle?.();
      return;
    }
    if (!tag.audio) return;
    if (!audioRef.current) {
      audioRef.current = getAudio(tag.audio);
      audioRef.current.preload = "auto";
      audioRef.current.onended = () => setSelfPlaying(false);
      setSelfMedia(audioRef.current);
    }
    if (selfPlaying) {
      audioRef.current.pause();
      setSelfPlaying(false);
    } else {
      void audioRef.current.play();
      setSelfPlaying(true);
      void registerPlay(tag.id);
    }
  };

  // Farben kommen zentral aus dem SlangTag-Typ (Community gruen, Creator blau).
  const theme = slangTagTheme(tag.kind);
  const business = theme.business;
  const accent = theme.text;
  const wave = theme.accent;
  const glass = `rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl ${theme.chipGlow}`;

  const PlayButton = ({
    size = "h-6 w-6",
    icon = "h-2.5 w-2.5",
  }: {
    size?: string;
    icon?: string;
  }) => (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? `${tag.name} ${at.pauseAria}` : `${tag.name} ${at.playAria}`}
      className={`grid ${size} shrink-0 place-items-center rounded-full border transition-transform hover:scale-105 ${accent} ${
        playing
          ? business
            ? "border-brand-cyan bg-brand-cyan/25 shadow-[0_0_14px_oklch(0.78_0.16_210/0.4)]"
            : "border-brand bg-brand/25 shadow-glow"
          : `${business ? "border-brand-cyan/60" : "border-brand/60"} bg-black/40`
      }`}
    >
      {playing ? <Pause className={icon} /> : <Play className={`${icon} fill-current`} />}
    </button>
  );

  if (variant === "dot") {
    return (
      <div className={`inline-flex flex-col items-start gap-0.5 ${lockedCls} ${className}`}>
        <div className={`inline-flex items-center gap-1.5 px-1.5 py-1 pr-2 ${glass}`}>
          <PlayButton size="h-5 w-5" icon="h-2 w-2" />
          <button
            type="button"
            onClick={open}
            className="text-[11px] font-bold leading-none tracking-tight hover:opacity-80"
          >
            <SlangTagName tag={tag} />
          </button>
        </div>
        {showStats && (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] text-white/90 ${glass} rounded-md`}
          >
            <Play className="h-2 w-2 fill-current" /> {formatStat(tag.stats.plays)}
          </span>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`${glass} block w-full min-w-0 max-w-full px-2 py-1.5 ${lockedCls} ${className}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <PlayButton size="h-6 w-6" icon="h-2.5 w-2.5" />
          <Waveform
            bars={12}
            color={wave}
            className="h-3 min-w-6 flex-1"
            animated={playing}
            media={waveMedia}
          />
          <button
            type="button"
            onClick={open}
            className="min-w-0 max-w-[55%] shrink text-xs font-black leading-none tracking-tight hover:opacity-80"
          >
            <SlangTagName tag={tag} />
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
    <div className={`${glass} inline-block px-2.5 py-2 ${lockedCls} ${className}`}>
      <div className="flex items-center gap-2">
        <PlayButton size="h-7 w-7" icon="h-3 w-3" />
        <Waveform
          bars={20}
          color={wave}
          className="h-3.5 w-16"
          animated={playing}
          media={waveMedia}
        />
        <button
          type="button"
          onClick={open}
          className="text-sm font-black leading-none tracking-tight hover:opacity-80"
        >
          <SlangTagName tag={tag} />
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
