import { ExternalLink, Play } from "lucide-react";
import type { VideoAd } from "@/lib/ad-video-demo";
import type { AdTestKind } from "@/lib/live-test.shared";
import { FeedVideoAdOverlay } from "@/components/feed/FeedVideoAdOverlay";
import { useVideoAdCardAutostart } from "@/lib/ads/video-ad-playback";
import { useState } from "react";

/**
 * Videowerbung im normalen Feed.
 *
 * Die Karte ist nur die Huelle: Einrasten, Autostart, Feed-Pause, Lautstaerke
 * und Skip-Freigabe kommen zentral aus dem Werbekernel
 * (`@/lib/ads/video-ad-playback`). Jede kuenftige Videoanzeige erhaelt damit
 * automatisch denselben Ablauf.
 */
export function FeedVideoAdCard({
  ad,
  position,
  lang = "de",
  onEvent,
  onDismiss,
}: {
  ad: VideoAd;
  position: number;
  lang?: string;
  /** Wird vom Feed durchgereicht, die Videowerbung startet kernelgesteuert. */
  autoPlay?: boolean;
  onEvent: (kind: AdTestKind) => void;
  onDismiss: () => void;
}) {
  const de = lang !== "en";
  const [open, setOpen] = useState(false);
  const { cardRef, restart } = useVideoAdCardAutostart({
    ad,
    onImpression: () => onEvent("ad_impression"),
    onStart: () => setOpen(true),
  });

  return (
    <article
      ref={cardRef}
      data-ad-video-card=""
      className="overflow-hidden rounded-2xl border border-slangtag-creator/50 bg-surface/60 shadow-[0_0_0_1px_var(--slangtag-creator)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slangtag-creator/30 bg-slangtag-creator/10 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-slangtag-creator">
          {de ? "GESPONSERT · VIDEO" : "SPONSORED · VIDEO"}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground">#{position}</span>
      </div>

      <button
        type="button"
        onClick={restart}
        aria-label={de ? "Werbevideo abspielen" : "Play video ad"}
        className="relative block w-full bg-black"
      >
        <img
          src={ad.poster}
          alt=""
          className={
            ad.aspect === "9/16"
              ? "mx-auto aspect-[9/16] max-h-[38vh] w-auto object-contain"
              : "aspect-[16/9] max-h-[38vh] w-full object-cover"
          }
        />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-primary/50 bg-primary/20 text-primary shadow-glow backdrop-blur-md">
            <Play className="h-5 w-5" />
          </span>
        </span>
      </button>

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

      {open ? (
        <FeedVideoAdOverlay
          ad={ad}
          anchor={cardRef.current}
          lang={lang}
          onEnded={() => {
            setOpen(false);
            onEvent("ad_skip");
            onDismiss();
          }}
          onSkip={() => {
            setOpen(false);
            onEvent("ad_skip");
            onDismiss();
          }}
        />
      ) : null}
    </article>
  );
}
