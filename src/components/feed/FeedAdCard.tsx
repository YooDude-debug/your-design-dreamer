import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AdSlangTag } from "@/components/ads/AdSlangTag";
import type { SponsoredAd } from "@/lib/ad-demo";
import type { AdTestKind } from "@/lib/live-test.shared";
import {
  isAutoPlayVisible,
  isOwnerPlaying,
  playExclusive,
  stopOwner,
  useAutoPlay,
} from "@/lib/autoplay";

/**
 * Werbekarte im Hauptfeed (Testmodus).
 *
 * Sie fügt sich optisch wie ein Feed-Beitrag ein, ist aber eindeutig als
 * GESPONSERT gekennzeichnet und trägt einen blauen Werbe-SlangTag. Der
 * Werbe-SlangTag ist kein Datensatz in `slang_tags`: er verändert keine
 * Owner-scoped-Logik und fließt in keine echten SlangTag-Zahlen ein.
 */
export function FeedAdCard({
  ad,
  position,
  lang = "de",
  onEvent,
  onDismiss,
}: {
  ad: SponsoredAd;
  position: number;
  lang?: string;
  onEvent: (kind: AdTestKind) => void;
  onDismiss: () => void;
}) {
  const de = lang !== "en";
  const cardRef = useRef<HTMLElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const reported = useRef(false);
  /** Werbe-SlangTags nutzen denselben Autoplay-Schalter wie Beitrags-SlangTags. */
  const { autoPlay } = useAutoPlay();
  const owner = `ad:${ad.id}`;

  // Eigene Werbe-Impression, sobald die Karte tatsächlich sichtbar war.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || reported.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !reported.current) {
            reported.current = true;
            onEvent("ad_impression");
            io.disconnect();
          }
        }
      },
      { threshold: [0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onEvent]);

  useEffect(() => () => stopOwner(owner), [owner]);

  /**
   * AutoPlay: der Werbe-SlangTag startet, sobald die Karte sichtbar ist, und
   * stoppt beim Verlassen. Exklusiv über den gemeinsamen Audio-Bus – es spielt
   * nie mehr als ein SlangTag gleichzeitig.
   */
  useEffect(() => {
    const el = cardRef.current;
    if (!autoPlay || !el || !ad.slangDrop.audio) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (isAutoPlayVisible(entry)) {
          if (!isOwnerPlaying(owner)) {
            playExclusive(owner, ad.slangDrop.audio, () => setPlaying(false));
            setPlaying(true);
            onEvent("ad_slangtag_play");
          }
        } else if (isOwnerPlaying(owner)) {
          stopOwner(owner);
          setPlaying(false);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      stopOwner(owner);
      setPlaying(false);
    };
  }, [autoPlay, ad.slangDrop.audio, owner, onEvent]);

  const toggle = () => {
    if (playing || isOwnerPlaying(owner)) {
      stopOwner(owner);
      setPlaying(false);
      return;
    }
    playExclusive(owner, ad.slangDrop.audio, () => setPlaying(false));
    setPlaying(true);
    onEvent("ad_slangtag_play");
  };

  return (
    <article
      ref={cardRef}
      data-ad-test-card=""
      className="overflow-hidden rounded-2xl border border-slangtag-creator/50 bg-surface/60 shadow-[0_0_0_1px_var(--slangtag-creator)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slangtag-creator/30 bg-slangtag-creator/10 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-slangtag-creator">
          {de ? "GESPONSERT" : "SPONSORED"}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {de ? "Position" : "Position"} {position}
          </span>
          <CloseButton
            onClick={() => {
              onEvent("ad_skip");
              onDismiss();
            }}
            label={de ? "Werbung überspringen" : "Skip ad"}
          />
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 pt-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slangtag-creator/15 text-[11px] font-bold text-slangtag-creator">
          {ad.logo}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {ad.company}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{ad.location}</span>
        </span>
      </div>

      <div className="relative mt-2 overflow-hidden">
        <img
          src={ad.image}
          alt={ad.headline}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
        {/* Blauer Werbe-SlangTag – gemeinsame Positionierung relativ zum Bild. */}
        <AdSlangTag name={ad.slangDrop.name} playing={playing} onToggle={toggle} size="lg" badge />
      </div>

      <div className="space-y-2 px-3 py-3">
        <h4 className="text-sm font-bold text-foreground">{ad.headline}</h4>
        <p className="text-[12px] leading-relaxed text-muted-foreground">{ad.body}</p>
        <a
          href={ad.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onEvent("ad_click")}
          className="inline-flex items-center gap-1.5 rounded-full bg-slangtag-creator/15 px-4 py-1.5 text-[12px] font-semibold text-slangtag-creator transition-colors hover:bg-slangtag-creator/25"
        >
          {ad.cta} <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <p className="text-[10px] text-muted-foreground">
          {de
            ? "Testmodus – keine echte Kampagne, keine Abrechnung."
            : "Test mode — no real campaign, no billing."}
        </p>
      </div>
    </article>
  );
}
