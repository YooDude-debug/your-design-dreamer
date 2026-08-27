import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  Pause,
  Settings,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdSlangTag } from "@/components/ads/AdSlangTag";
import { AdFeedPanel } from "@/components/AdFeed";
import { QuickBar } from "@/components/QuickBar";

import { SPONSORED_ADS, type SponsoredAd } from "@/lib/ad-demo";
import { useLang } from "@/lib/lang-context";
import { useAdPause, useAdsEnabled } from "@/lib/ad-pause";
import { filterAdEntries } from "@/lib/ads/ad-targeting.shared";
import { useAdTargeting } from "@/lib/ads/use-ad-targeting";
import { useData } from "@/lib/data-context";
import markUrl from "@/assets/ydude-mark.png";

const COPY = {
  de: {
    sponsored: "Gesponsert",
    more: "Mehr erfahren",
    copied: "Link kopiert",
    close: "Schließen",
    ad: "Werbung",
    settings: "Werbefeed-Einstellungen",
    paused: "Werbepause",
  },
  en: {
    sponsored: "Sponsored",
    more: "Learn more",
    copied: "Link copied",
    close: "Close",
    ad: "Ad",
    settings: "Ad feed settings",
    paused: "Ad break",
  },
  el: {
    sponsored: "Χορηγούμενο",
    more: "Μάθε περισσότερα",
    copied: "Ο σύνδεσμος αντιγράφηκε",
    close: "Κλείσιμο",
    ad: "Διαφήμιση",
    settings: "Ρυθμίσεις ροής διαφημίσεων",
    paused: "Διαφημιστικό διάλειμμα",
  },
} as const;

type AdCopy = {
  sponsored: string;
  more: string;
  copied: string;
  close: string;
  ad: string;
  settings: string;
  paused: string;
};

const INTERVAL = 7000;

/**
 * Werbefeed.
 *
 * `dock`  – schmale Leiste unter dem Profil. Sie traegt ausschliesslich das
 *           Y-Dude Zeichen und die Werbefeed-Einstellungen und dient als
 *           Pull-down-/Dock-Bereich. Bewusst OHNE Werbung: Werbung wird
 *           ausschliesslich im Feed ausgespielt.
 * `feed`  – die bestehende horizontale Werbekarte mit Carousel, Bild,
 *           Unternehmen, GESPONSERT, SlangTag/Audio und Detailansicht
 *           (Like, Speichern, Teilen). Identisch fuer alle Konten.
 */
export function AdSlider({
  variant = "dock",
  onEvent,
}: {
  variant?: "dock" | "feed";
  onEvent?: (kind: "ad_impression" | "ad_click" | "ad_slangtag_play") => void;
} = {}) {
  const { lang } = useLang();
  const c: AdCopy = COPY[lang as keyof typeof COPY] ?? COPY.de;
  const { user: viewer } = useData();
  // Werbefeed-Einstellung als Allowed-Filter; leere Auswahl = alles zulaessig.
  const targeting = useAdTargeting(viewer?.id);
  const ads = useMemo(() => filterAdEntries(SPONSORED_ADS, targeting), [targeting]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [detail, setDetail] = useState<SponsoredAd | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const touchX = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user, isAdmin } = useData();
  const pause = useAdPause(user?.id);
  const adsState = useAdsEnabled(user?.id, isAdmin);
  const adBreak = pause.active || adsState.disabled;

  const go = useCallback(
    (dir: 1 | -1) => {
      setPlaying(null);
      setIndex((i) => (i + dir + ads.length) % ads.length);
    },
    [ads.length],
  );

  // Automatischer Wechsel – pausiert bei Hover, Audio, offenem Detail oder Werbepause
  useEffect(() => {
    if (paused || playing || detail || adBreak) return;
    const id = window.setInterval(() => go(1), INTERVAL);
    return () => window.clearInterval(id);
  }, [paused, playing, detail, adBreak, go]);

  // Während der Werbepause keine Wiedergabe und kein geöffnetes Detail
  useEffect(() => {
    if (!adBreak) return;
    setPlaying(null);
    setDetail(null);
  }, [adBreak]);

  // Wiedergabe des SlangTags
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.currentTime = 0;
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, [playing]);

  const ad = ads[index] ?? ads[0];

  // Werbe-Impression melden, sobald eine Karte im Feed sichtbar wird.
  useEffect(() => {
    if (variant !== "feed" || !ad || adBreak) return;
    onEvent?.("ad_impression");
  }, [variant, ad, adBreak, onEvent]);

  // Dock-Leiste unter dem Profil: Schnellzugriff auf Messenger und Market.
  // Werbung laeuft ausschliesslich im Feed; Werbefeed-Einstellungen sind
  // weiterhin ueber das Hamburger-Menue erreichbar.
  if (variant === "dock") return <QuickBar />;

  if (!ad) return null;

  // Werbepause im Feed: schwarze Flaeche mit Y-Dude Logo, gleiche Breite.
  if (adBreak) {
    return (
      <div
        style={{ maxHeight: "2.18rem" }}
        className="overflow-hidden transition-[max-height] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      >
        <section
          aria-label={c.paused}
          className="relative overflow-hidden rounded-2xl border border-border bg-background"
        >
          <div className="animate-fade-in flex h-[2.05rem] items-center justify-center bg-background p-1.5">
            <img
              src={markUrl}
              alt="Y-Dude"
              width={120}
              height={120}
              decoding="async"
              className="h-[1.44rem] w-auto opacity-95"
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      style={{ maxHeight: "6.72rem" }}
      className="overflow-hidden transition-[max-height] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
      <section
        aria-label={c.ad}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null) return;
          if (Math.abs(end - start) > 40) go(end < start ? 1 : -1);
        }}
        tabIndex={0}
        className="group relative overflow-hidden rounded-2xl border border-border bg-background outline-none transition-colors focus-visible:border-brand/60"
      >
        <div
          key={ad.id}
          className="animate-fade-in flex cursor-pointer items-stretch gap-2 p-1.5"
          onClick={() => {
            onEvent?.("ad_click");
            setDetail(ad);
          }}
        >
          {/* Werbebild mit SlangTag-Overlay */}
          <div className="relative h-[4.32rem] w-[5.04rem] shrink-0 overflow-hidden rounded-xl bg-surface sm:w-[5.76rem]">
            <img
              src={ad.image}
              alt={`${ad.company} – ${ad.headline}`}
              width={320}
              height={200}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {/* Blauer Werbe-SlangTag direkt auf dem Bild (gemeinsame Positionierung) */}
            <AdSlangTag
              name={ad.slangDrop.name}
              playing={playing === ad.id}
              onToggle={() => {
                if (playing !== ad.id) onEvent?.("ad_slangtag_play");
                setPlaying((p) => (p === ad.id ? null : ad.id));
              }}
              size="lg"
              duration={ad.slangDrop.duration}
              scaleRefWidth={512}
            />
          </div>

          {/* Text */}
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-brand/40 bg-brand/10 text-[9px] font-black text-brand">
                  {ad.logo}
                </span>
                <span className="truncate text-[11px] font-bold">{ad.company}</span>
                <span className="shrink-0 rounded-full border border-border bg-surface px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  {c.sponsored}
                </span>
              </div>
              <h3 className="mt-1 truncate text-[13px] font-bold leading-snug">{ad.headline}</h3>
              <p className="line-clamp-2 text-[11px] text-muted-foreground">{ad.body}</p>
            </div>

            <span className="mt-1 hidden w-fit shrink-0 rounded-full bg-gradient-brand px-3 py-1 text-[10px] font-semibold text-primary-foreground sm:inline-block">
              {ad.cta || c.more}
            </span>
          </div>
        </div>

        {/* Nur der aktuelle SlangTag wird geladen */}
        <audio ref={audioRef} src={ad.slangDrop.audio} preload="none" className="hidden" />

        {/* Steuerung – Pfeile und Punkte nur, wenn es mehr als eine Anzeige gibt */}
        {ads.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Prev"
              className="absolute left-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-brand group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-brand group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {ads.length > 1 && (
          <div className="flex items-center justify-center gap-1 pb-1">
            {ads.map((a, i) => (
              <button
                key={a.id}
                type="button"
                aria-label={`${i + 1}`}
                onClick={() => {
                  setPlaying(null);
                  setIndex(i);
                }}
                className={`h-1 rounded-full transition-all ${
                  i === index ? "w-4 bg-brand" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
        )}

        {/* Einstellungen-Button in der oberen rechten Ecke – bewusst NICHT
            vertikal zentriert, sonst liegt er exakt hinter/über dem
            "Weiter"-Pfeil und wirkt wie eine doppelte Schaltflaeche. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSettingsOpen(true);
          }}
          aria-label={c.settings}
          title={c.settings}
          className="absolute right-1 top-1 z-20 grid h-6 w-6 place-items-center rounded-full border border-border bg-background/60 text-muted-foreground/80 backdrop-blur transition-colors hover:border-brand/60 hover:bg-background/90 hover:text-brand"
        >
          <Settings className="h-3 w-3" />
        </button>

        {detail && <AdDetail ad={detail} copy={c} onClose={() => setDetail(null)} />}
        {settingsOpen && (
          <AdFeedPanel
            onClose={() => {
              setSettingsOpen(false);
              void pause.refresh();
            }}
          />
        )}
      </section>
    </div>
  );
}

function AdDetail({ ad, copy, onClose }: { ad: SponsoredAd; copy: AdCopy; onClose: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const share = () => {
    void navigator.clipboard?.writeText(ad.url).then(
      () => toast.success(copy.copied),
      () => undefined,
    );
  };
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.currentTime = 0;
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-background/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <article
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface"
      >
        <header className="flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-brand/40 bg-brand/10 text-[11px] font-black text-brand">
            {ad.logo}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{ad.company}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {ad.location} · {ad.category} · {copy.sponsored}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          <img
            src={ad.image}
            alt={`${ad.company} – ${ad.headline}`}
            className="h-full w-full object-cover"
          />
          {/* Werbe-SlangTag als Overlay auf dem Bild – gleiche Logik wie im Feed */}
          <AdSlangTag
            name={ad.slangDrop.name}
            playing={playing}
            onToggle={() => setPlaying((v) => !v)}
            size="lg"
            duration={ad.slangDrop.duration}
          />
        </div>
        <div className="space-y-3 p-4">
          <h2 className="text-base font-bold leading-snug">{ad.headline}</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{ad.body}</p>

          {/* Aktionen – nur in der geöffneten Werbeansicht */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLiked((v) => !v)}
              aria-label="Like"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border ${
                liked ? "text-brand" : "text-muted-foreground hover:text-brand"
              }`}
            >
              <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setSaved((v) => !v)}
              aria-label="Save"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border ${
                saved ? "text-brand" : "text-muted-foreground hover:text-brand"
              }`}
            >
              <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              onClick={share}
              aria-label="Share"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-brand"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
          <a
            href={ad.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-full bg-gradient-brand px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
          >
            {ad.cta || copy.more}
          </a>
          <audio ref={audioRef} src={ad.slangDrop.audio} preload="none" className="hidden" />
        </div>
      </article>
    </div>,
    document.body,
  );
}
