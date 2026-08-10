import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import type { VideoAd } from "@/lib/ad-video-demo";
import type { AdTestKind } from "@/lib/live-test.shared";
import { FeedVideoAdOverlay } from "@/components/feed/FeedVideoAdOverlay";

/**
 * Videowerbung im normalen Feed.
 *
 * Die Karte ist der Einstiegspunkt: sobald der Clip aktiv startet (Autoplay
 * nach den bestehenden Feed-Regeln oder per Tap), uebernimmt das Vollbild-
 * Overlay. Der Feed wird dabei eingefroren und laeuft nach „Ueberspringen“
 * oder Videoende exakt an der vorherigen Position weiter – ohne Reload.
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
  const reported = useRef(false);
  const started = useRef(false);
  const [open, setOpen] = useState(false);

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setOpen(true);
  }, []);

  // Sichtbarkeit: Impression + Autoplay nach den bestehenden Feed-Regeln.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const on = entry.isIntersecting && entry.intersectionRatio >= 0.5;
          if (on && !reported.current) {
            reported.current = true;
            onEvent("ad_impression");
          }
          if (on && autoPlay) start();
        }
      },
      { threshold: [0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [autoPlay, onEvent, start]);

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

      <button
        type="button"
        onClick={() => {
          started.current = false;
          start();
        }}
        aria-label={de ? "Werbevideo abspielen" : "Play video ad"}
        className="relative block w-full bg-black"
      >
        <img
          src={ad.poster}
          alt=""
          className={
            ad.aspect === "9/16"
              ? "mx-auto aspect-[9/16] max-h-[70vh] w-auto object-contain"
              : "aspect-[16/9] w-full object-cover"
          }
        />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-primary/50 bg-primary/20 text-primary shadow-glow backdrop-blur-md">
            <Play className="h-6 w-6" />
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
