import { createPortal } from "react-dom";
import { Play, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import type { VideoAd } from "@/lib/ad-video-demo";
import { useVideoAdPlayback } from "@/lib/ads/video-ad-playback";

/**
 * Vollbild-Videowerbung ueber dem Feed – reine Darstellung.
 *
 * Die komplette Abspiellogik (Feed-Freeze, stummer Autostart, Lautstaerke,
 * Skip-Sperre inkl. Countdown, Maximallaenge) liegt zentral im Werbekernel
 * unter `@/lib/ads/video-ad-playback` und gilt fuer jede Videoanzeige.
 */
export function FeedVideoAdOverlay({
  ad,
  anchor,
  lang = "de",
  onEnded,
  onSkip,
}: {
  ad: VideoAd;
  /** Element im Feed, aus dem die Werbung gestartet wurde (Scroll-Anker). */
  anchor: HTMLElement | null;
  lang?: string;
  onEnded: () => void;
  onSkip: () => void;
}) {
  const de = lang !== "en";
  const {
    videoProps,
    muted,
    left,
    skipIn,
    canSkip,
    needsTap,
    changeVolume,
    toggleMuted,
    playManually,
    skip,
  } = useVideoAdPlayback({ ad, anchor, onEnded, onSkip });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={de ? "Videowerbung" : "Video ad"}
      data-feed-ad-overlay=""
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-black"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <span className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] rounded-full border border-slangtag-creator/40 bg-slangtag-creator/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slangtag-creator">
        {de ? "Werbung" : "Ad"}
      </span>

      <video
        {...videoProps}
        src={ad.video}
        poster={ad.poster}
        muted={muted}
        playsInline
        autoPlay
        preload="auto"
        onClick={() => {
          if (needsTap) playManually();
        }}
        className={
          ad.aspect === "9/16"
            ? "max-h-full w-auto max-w-full object-contain"
            : "max-h-full w-full object-contain"
        }
      />

      {needsTap ? (
        <button
          type="button"
          onClick={playManually}
          aria-label={de ? "Werbevideo abspielen" : "Play video ad"}
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full border border-primary/50 bg-primary/20 text-primary shadow-glow backdrop-blur-md">
            <Play className="h-7 w-7" />
          </span>
        </button>
      ) : null}

      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-0 right-0 flex items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeVolume(-1)}
            aria-label={de ? "Leiser" : "Volume down"}
            className="control-chip grid h-10 w-10 place-items-center rounded-full"
          >
            <Volume1 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => changeVolume(1)}
            aria-label={de ? "Lauter" : "Volume up"}
            className="control-chip grid h-10 w-10 place-items-center rounded-full"
          >
            <Volume2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleMuted}
            aria-label={muted ? (de ? "Ton an" : "Unmute") : de ? "Ton aus" : "Mute"}
            className="control-chip grid h-10 w-10 place-items-center rounded-full"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        <button
          type="button"
          disabled={!canSkip}
          aria-disabled={!canSkip}
          onClick={skip}
          className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/15 px-5 py-2.5 text-sm font-bold text-primary shadow-glow backdrop-blur-md disabled:cursor-not-allowed disabled:border-border disabled:bg-surface/60 disabled:text-muted-foreground disabled:shadow-none"
        >
          <SkipForward className="h-4 w-4" />
          {canSkip
            ? de
              ? "Überspringen"
              : "Skip"
            : de
              ? `Überspringen in ${skipIn}s`
              : `Skip in ${skipIn}s`}
          {canSkip && left !== null ? (
            <span className="text-[11px] font-semibold text-muted-foreground">{left}s</span>
          ) : null}
        </button>
      </div>
    </div>,
    document.body,
  );
}
