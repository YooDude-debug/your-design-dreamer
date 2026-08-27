import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  ExternalLink,
  Heart,
  MapPin,
  MessageCircle,
  Search,
  Send,
  Share2,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { AdSlangTag } from "@/components/ads/AdSlangTag";
import { AD_FILTERS, SPONSORED_ADS, type AdFilter, type SponsoredAd } from "@/lib/ad-demo";
import { useDemoInventoryAllowed } from "@/lib/ads/demo-inventory";
import { useLang } from "@/lib/lang-context";
import { useData } from "@/lib/data-context";
import { filterAdEntries } from "@/lib/ads/ad-targeting.shared";
import { useAdTargeting } from "@/lib/ads/use-ad-targeting";

const COPY = {
  de: {
    sponsored: "Gesponsert",
    search: "Unternehmen oder Kategorie suchen",
    noResults: "Keine Anzeigen gefunden.",
    slangDrop: "SlangDrop",
    translation: "Übersetzung",
    comments: "Kommentare",
    commentPh: "Kommentar schreiben …",
    nearby: "In deiner Nähe",
    useLocation: "Standort verwenden",
    locationOn: "Regionale Angebote bevorzugt",
    locationDenied: "Standort nicht freigegeben.",
    copied: "Link kopiert",
    clicks: "Klicks",
    filters: {
      all: "Alle",
      travel: "Reisen",
      hotels: "Hotels",
      food: "Essen",
      events: "Events",
      language: "Sprache",
      shopping: "Shopping",
    },
  },
  en: {
    sponsored: "Sponsored",
    search: "Search company or category",
    noResults: "No ads found.",
    slangDrop: "SlangDrop",
    translation: "Translation",
    comments: "Comments",
    commentPh: "Write a comment …",
    nearby: "Near you",
    useLocation: "Use location",
    locationOn: "Regional offers prioritised",
    locationDenied: "Location not shared.",
    copied: "Link copied",
    clicks: "clicks",
    filters: {
      all: "All",
      travel: "Travel",
      hotels: "Hotels",
      food: "Food",
      events: "Events",
      language: "Language",
      shopping: "Shopping",
    },
  },
  el: {
    sponsored: "Χορηγούμενο",
    search: "Αναζήτηση επιχείρησης ή κατηγορίας",
    noResults: "Δεν βρέθηκαν διαφημίσεις.",
    slangDrop: "SlangDrop",
    translation: "Μετάφραση",
    comments: "Σχόλια",
    commentPh: "Γράψε ένα σχόλιο …",
    nearby: "Κοντά σου",
    useLocation: "Χρήση τοποθεσίας",
    locationOn: "Προτεραιότητα σε τοπικές προσφορές",
    locationDenied: "Η τοποθεσία δεν κοινοποιήθηκε.",
    copied: "Ο σύνδεσμος αντιγράφηκε",
    clicks: "κλικ",
    filters: {
      all: "Όλα",
      travel: "Ταξίδια",
      hotels: "Ξενοδοχεία",
      food: "Φαγητό",
      events: "Εκδηλώσεις",
      language: "Γλώσσα",
      shopping: "Αγορές",
    },
  },
};

type AdCopy = typeof COPY.de;

/** Grobe Zuordnung Zeitzone → Land für regionale Empfehlungen (ohne Fremddienste). */
function guessRegion(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    const map: Record<string, string> = {
      "Europe/Berlin": "DE",
      "Europe/Vienna": "DE",
      "Europe/Zurich": "DE",
      "Europe/Athens": "GR",
      "Europe/Paris": "FR",
      "Europe/London": "GB",
      "Europe/Madrid": "ES",
      "Asia/Tokyo": "JP",
    };
    return map[tz] ?? null;
  } catch {
    return null;
  }
}

type Interaction = { liked: boolean; saved: boolean; clicks: number; comments: string[] };

export function SponsoredFeed() {
  const { lang } = useLang();
  const c: AdCopy = COPY[lang as keyof typeof COPY] ?? COPY.de;
  const [filter, setFilter] = useState<AdFilter>("all");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, Interaction>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const { user } = useData();
  const targeting = useAdTargeting(user?.id);

  const get = (id: string): Interaction =>
    state[id] ?? { liked: false, saved: false, clicks: 0, comments: [] };
  const patch = (id: string, next: Partial<Interaction>) =>
    setState((s) => ({ ...s, [id]: { ...get(id), ...next } }));

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(c.locationDenied);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setRegion(guessRegion() ?? "*"),
      () => toast.error(c.locationDenied),
      { timeout: 8000 },
    );
  };

  // Demo-Werbemittel nur mit ausdrücklicher Freigabe (Admin + Testmodus).
  const demoAllowed = useDemoInventoryAllowed();
  const ads = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Erlaubter Pool laut Werbefeed-Einstellung, danach UI-Filter/Suche.
    const allowed = demoAllowed ? filterAdEntries(SPONSORED_ADS, targeting) : [];
    const list = allowed.filter((ad) => {
      const byFilter = filter === "all" || ad.filters.includes(filter);
      const byQuery =
        !q ||
        [ad.company, ad.category, ad.headline, ad.location, ad.slangDrop.name].some((v) =>
          v.toLowerCase().includes(q),
        );
      return byFilter && byQuery;
    });
    if (!region) return list;
    return [...list].sort(
      (a, b) => Number(b.regionCode === region) - Number(a.regionCode === region),
    );
  }, [filter, query, region, targeting, demoAllowed]);

  return (
    <div className="space-y-4">
      {/* Filter + Suche */}
      <div className="space-y-3">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {AD_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                filter === f
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/50 hover:text-brand"
              }`}
            >
              {c.filters[f]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-2 focus-within:border-brand">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={c.search}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
          <button
            type="button"
            onClick={requestLocation}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
              region
                ? "border-brand/50 bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:border-brand/50 hover:text-brand"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            {region ? c.locationOn : c.useLocation}
          </button>
        </div>
      </div>

      {/* Feed */}
      {ads.length === 0 ? (
        <p className="rounded-2xl border border-border bg-background/60 p-6 text-center text-xs text-muted-foreground">
          {c.noResults}
        </p>
      ) : (
        <div className="space-y-4">
          {ads.map((ad) => (
            <SponsoredCard
              key={ad.id}
              ad={ad}
              copy={c}
              nearby={!!region && ad.regionCode === region}
              interaction={get(ad.id)}
              onPatch={(next) => patch(ad.id, next)}
              playing={playing === ad.id}
              onTogglePlay={() => setPlaying((p) => (p === ad.id ? null : ad.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SponsoredCard({
  ad,
  copy,
  nearby,
  interaction,
  onPatch,
  playing,
  onTogglePlay,
}: {
  ad: SponsoredAd;
  copy: AdCopy;
  nearby: boolean;
  interaction: Interaction;
  onPatch: (next: Partial<Interaction>) => void;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [comment, setComment] = useState("");
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

  const openLink = () => {
    onPatch({ clicks: interaction.clicks + 1 });
    window.open(ad.url, "_blank", "noopener,noreferrer");
  };

  const share = () => {
    void navigator.clipboard?.writeText(ad.url).then(
      () => toast.success(copy.copied),
      () => undefined,
    );
  };

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-background/60 transition-all duration-300 hover:border-brand/40 hover:shadow-glow">
      {/* Kopf */}
      <header className="flex items-center gap-3 px-4 pt-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-brand/40 bg-brand/10 text-[11px] font-black tracking-tight text-brand">
          {ad.logo}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={openLink}
              className="truncate text-sm font-bold hover:text-brand"
            >
              {ad.company}
            </button>
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {copy.sponsored}
            </span>
            {nearby && (
              <span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                {copy.nearby}
              </span>
            )}
          </div>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> <span className="truncate">{ad.location}</span>
            <span className="mx-0.5">·</span> {ad.category}
          </p>
        </div>
        <button
          type="button"
          onClick={openLink}
          aria-label={ad.company}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </header>

      {/* Bild */}
      <div className="relative mt-3 aspect-[16/10] w-full overflow-hidden bg-surface">
        <img
          src={ad.image}
          alt={`${ad.company} – ${ad.headline}`}
          width={1024}
          height={640}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
        />
        {ad.rating !== undefined && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-bold text-foreground backdrop-blur">
            <Star className="h-3 w-3 text-brand" /> {ad.rating.toFixed(1)}
            {ad.ratingCount ? (
              <span className="font-normal text-muted-foreground">({ad.ratingCount})</span>
            ) : null}
          </span>
        )}
        {/* Werbe-SlangTag als Overlay auf dem Bild – gleiche Positionierung wie im Feed */}
        <AdSlangTag
          name={ad.slangDrop.name}
          playing={playing}
          onToggle={onTogglePlay}
          size="lg"
          duration={ad.slangDrop.duration}
        />
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h4 className="text-base font-bold leading-snug">{ad.headline}</h4>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {ad.body}
          </p>
        </div>

        {/* SlangDrop-Übersetzung (SlangTag selbst liegt als Overlay auf dem Bild) */}
        <div className="rounded-2xl border border-brand-cyan/30 bg-brand-cyan/5 p-3">
          <button
            type="button"
            onClick={() => setShowTranslation((v) => !v)}
            className="mt-2 text-left text-[11px] text-muted-foreground hover:text-brand"
          >
            „{ad.slangDrop.text}“ · {copy.translation}
          </button>
          {showTranslation && (
            <p className="mt-1 text-[11px] font-semibold text-brand-cyan">
              {ad.slangDrop.translation}
            </p>
          )}
          <audio ref={audioRef} src={ad.slangDrop.audio} preload="none" className="hidden" />
        </div>

        {/* Call to Action */}
        <button
          type="button"
          onClick={openLink}
          className="w-full rounded-full bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform duration-200 active:scale-[0.98]"
        >
          {ad.cta}
        </button>

        {/* Interaktionen */}
        <div className="flex items-center gap-1 border-t border-border pt-3 text-muted-foreground">
          <button
            type="button"
            onClick={() => onPatch({ liked: !interaction.liked })}
            aria-label="Like"
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              interaction.liked ? "text-brand" : "hover:text-brand"
            }`}
          >
            <Heart className={`h-4 w-4 ${interaction.liked ? "fill-current" : ""}`} />
            {interaction.liked ? 1 : 0}
          </button>
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold hover:text-brand"
          >
            <MessageCircle className="h-4 w-4" />
            {interaction.comments.length}
          </button>
          <button
            type="button"
            onClick={share}
            aria-label="Share"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold hover:text-brand"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onPatch({ saved: !interaction.saved })}
            aria-label="Save"
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              interaction.saved ? "text-brand" : "hover:text-brand"
            }`}
          >
            <Bookmark className={`h-4 w-4 ${interaction.saved ? "fill-current" : ""}`} />
          </button>
          <span className="ml-auto text-[10px] uppercase tracking-widest">
            {interaction.clicks} {copy.clicks}
          </span>
        </div>

        {showComments && (
          <div className="space-y-2 rounded-2xl border border-border bg-surface/60 p-3">
            {interaction.comments.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{copy.comments}</p>
            ) : (
              <ul className="space-y-1.5">
                {interaction.comments.map((t, i) => (
                  <li key={i} className="text-[11px] leading-relaxed text-foreground">
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = comment.trim().slice(0, 240);
                if (!value) return;
                onPatch({ comments: [...interaction.comments, value] });
                setComment("");
              }}
              className="flex gap-2"
            >
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={copy.commentPh}
                maxLength={240}
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-brand"
              />
              <button
                type="submit"
                aria-label="Send"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-brand text-primary-foreground"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
