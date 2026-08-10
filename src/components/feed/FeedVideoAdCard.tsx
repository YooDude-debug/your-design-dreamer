import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import type { VideoAd } from "@/lib/ad-video-demo";
import {
  VIDEO_AD_MAX_LENGTH,
  VIDEO_AD_SKIP_AFTER,
} from "@/lib/ad-catalog.shared";
import type { AdTestKind } from "@/lib/live-test.shared";

/**
 * Videowerbung im normalen Feed.
 *
 * Regeln: Autoplay nach den bestehenden Feed-Regeln (stumm), „Überspringen“
 * erscheint erst nach 2 Sekunden Wiedergabe, danach jederzeit möglich. Ohne
 * Skip läuft das Video normal weiter, hart begrenzt auf 30 Sekunden.
 */
export function FeedVideoAdCard({
  ad,
  position,
  lang = "de",
  autoPlay = false,
  onEvent,
  onDismiss,
}: {
  ad: VideoAd;
  position: number;
  lang?: string;
  autoPlay?: boolean;
  onEvent: (kind: AdTestKind) => void;
  onDismiss: () => void;
}) {
  const de = lang !== "en";
  const cardRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reported = useRef(false);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [watched, setWatched] = useState(0);

  const play = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    void el
      .play()
      .then(() => setPlaying(true))
      .catch(() => undefined);
  }, []);

  // Sichtbarkeit: Impression + Autoplay nach den bestehenden Feed-Regeln.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const on = entry.isIntersecting && entry.intersectionRatio >= 0.5;
          setVisible(on);
          if (on && !reported.current) {
            reported.current = true;
            onEvent("ad_impression");
          }
        }
      },
      { threshold: [0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onEvent]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (visible && autoPlay) play();
    else {
      el.pause();
      setPlaying(false);
    }
  }, [autoPlay, play, visible]);

  useEffect(() => () => videoRef.current?.pause(), []);

  const canSkip = watched >= VIDEO_AD_SKIP_AFTER;

  return (
    <article
      ref={cardRef}
      data-ad-video-card=""
      className="overflow-hidden rounded-2xl border border-slangtag-creator/50 bg-surface/60 shadow-[0_0_0_1px_var(--slangtag-creator)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slangtag-creator/30 bg-slangtag-creator/10 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-slangtag-creator">
          {de ? "Videowerbung" : "Video ad"}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground">#{position}</span>
      </div>

      <div className="relative bg-black">
        <video
          ref={videoRef}
          src={ad.video}
          poster={ad.poster}
          muted={muted}
          playsInline
          preload="metadata"
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            setWatched(el.currentTime);
            if (el.currentTime >= VIDEO_AD_MAX_LENGTH) {
              el.pause();
              setPlaying(false);
            }
          }}
          onEnded={() => setPlaying(false)}
          className={
            ad.aspect === "9/16"
              ? "mx-auto aspect-[9/16] max-h-[70vh] w-auto object-contain"
              : "aspect-[16/9] w-full object-cover"
          }
        />

        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              if (playing) {
                el.pause();
                setPlaying(false);
              } else play();
            }}
            aria-label={playing ? (de ? "Pause" : "Pause") : de ? "Abspielen" : "Play"}
            className="control-chip grid h-8 w-8 place-items-center rounded-full"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? (de ? "Ton an" : "Unmute") : de ? "Ton aus" : "Mute"}
            className="control-chip grid h-8 w-8 place-items-center rounded-full"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {canSkip ? (
          <button
            type="button"
            onClick={() => {
              videoRef.current?.pause();
              onEvent("ad_skip");
              onDismiss();
            }}
            className="control-chip absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
          >
            <SkipForward className="h-3.5 w-3.5" />
            {de ? "Überspringen" : "Skip"}
          </button>
        ) : (
          <span className="control-chip absolute bottom-2 right-2 rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
            {de
              ? `Überspringen in ${Math.max(1, Math.ceil(VIDEO_AD_SKIP_AFTER - watched))}s`
              : `Skip in ${Math.max(1, Math.ceil(VIDEO_AD_SKIP_AFTER - watched))}s`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 p-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slangtag-creator/40 bg-slangtag-creator/10 text-[10px] font-black text-slangtag-creator">
          {ad.logo}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold">{ad.headline}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {ad.company} · {ad.location}
          </p>
        </div>
        <a
          href={ad.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onEvent("ad_click")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
        >
          {ad.cta} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </article>
  );
}
