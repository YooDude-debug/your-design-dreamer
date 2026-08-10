import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import type { VideoAd } from "@/lib/ad-video-demo";
import { VIDEO_AD_MAX_LENGTH } from "@/lib/ad-catalog.shared";
import { freezeFeed } from "@/lib/feed-freeze";

/**
 * Vollbild-Videowerbung ueber dem Feed.
 *
 * Solange der Clip laeuft, ist der Feed eingefroren (kein Weiterscrollen,
 * kein Reload). Beendet wird er entweder durch „Ueberspringen“ oder durch das
 * Ende des Videos – danach laeuft der Feed exakt an der vorherigen Position
 * weiter.
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [left, setLeft] = useState<number | null>(null);
  const [needsTap, setNeedsTap] = useState(false);

  // Feed einfrieren, solange das Overlay offen ist.
  useEffect(() => {
    const release = freezeFeed(anchor);
    return release;
  }, [anchor]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => setNeedsTap(true));
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={de ? "Videowerbung" : "Video ad"}
      data-feed-ad-overlay=""
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-black"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <span className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] rounded-full border border-slangtag-creator/40 bg-slangtag-creator/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slangtag-creator">
        {de ? "Werbung" : "Ad"}
      </span>

      <video
        ref={videoRef}
        src={ad.video}
        poster={ad.poster}
        muted={muted}
        playsInline
        autoPlay
        preload="auto"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setLeft(Number.isFinite(d) ? Math.ceil(d) : null);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (Number.isFinite(el.duration)) {
            setLeft(Math.max(0, Math.ceil(el.duration - el.currentTime)));
          }
          if (el.currentTime >= VIDEO_AD_MAX_LENGTH) {
            el.pause();
            onEnded();
          }
        }}
        onEnded={onEnded}
        onPlaying={() => setNeedsTap(false)}
        onError={onSkip}
        onClick={() => {
          if (needsTap) void videoRef.current?.play().catch(() => undefined);
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
          onClick={() => void videoRef.current?.play().catch(() => undefined)}
          aria-label={de ? "Werbevideo abspielen" : "Play video ad"}
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full border border-primary/50 bg-primary/20 text-primary shadow-glow backdrop-blur-md">
            <Play className="h-7 w-7" />
          </span>
        </button>
      ) : null}

      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-0 right-0 flex items-center justify-between gap-2 px-4">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? (de ? "Ton an" : "Unmute") : de ? "Ton aus" : "Mute"}
          className="control-chip grid h-10 w-10 place-items-center rounded-full"
        >
          {muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => {
            videoRef.current?.pause();
            onSkip();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/15 px-5 py-2.5 text-sm font-bold text-primary shadow-glow backdrop-blur-md"
        >
          <SkipForward className="h-4 w-4" />
          {de ? "Überspringen" : "Skip"}
          {left !== null ? (
            <span className="text-[11px] font-semibold text-muted-foreground">{left}s</span>
          ) : null}
        </button>
      </div>
    </div>,
    document.body,
  );
}
