/**
 * Market-Feed im Feed-Bereich: neue Angebote, die zu den bereits vorhandenen
 * gespeicherten Suchen („Suche speichern“) des Nutzers passen.
 *
 * Es entsteht keine zweite Speicherung und keine zweite Suchlogik – die Daten
 * kommen aus `listMarketFeed` (bestehende Market-Suche + `market_searches`).
 * „Neu“ vs. „bereits gesehen“ wird rein lokal über den Zeitpunkt des letzten
 * Besuchs bestimmt (kein Datenbank- oder Rechte-Eingriff).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, Search, Sparkles } from "lucide-react";

import { listMarketFeed } from "@/lib/market.functions";
import { MarketItemCard } from "@/components/market/MarketItemCard";
import type { MarketItemSummary } from "@/lib/market.server";
import { signPaths, variantPath } from "@/lib/media";
import { useLang } from "@/lib/lang-context";

type FeedItem = MarketItemSummary & { matchedLabels: string[] };

const TEXTS = {
  de: {
    loading: "Wird geladen…",
    empty: "Noch keine passenden Angebote zu deinen gespeicherten Suchen.",
    noSearches:
      "Du hast noch keine Suche gespeichert. Suche im Market und tippe auf „Suche speichern“.",
    toMarket: "Zum Market",
    isNew: "Neu",
    seen: "Bereits gesehen",
    newHits: "Neu für dich",
  },
  en: {
    loading: "Loading…",
    empty: "No matching offers for your saved searches yet.",
    noSearches: "You have no saved search yet. Search the market and tap “Save search”.",
    toMarket: "Go to market",
    isNew: "New",
    seen: "Already seen",
    newHits: "New for you",
  },
  el: {
    loading: "Φορτώνει…",
    empty: "Δεν υπάρχουν ακόμη αγγελίες για τις αποθηκευμένες αναζητήσεις σου.",
    noSearches:
      "Δεν έχεις αποθηκευμένη αναζήτηση. Ψάξε στο Market και πάτησε «Αποθήκευση αναζήτησης».",
    toMarket: "Στο Market",
    isNew: "Νέο",
    seen: "Ήδη είδες",
    newHits: "Νέα για σένα",
  },
} as const;

const SEEN_KEY = "yd:market-feed:last-seen";

function readLastSeen(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(SEEN_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

/** Signierte Titelbilder – identische Varianten-Kette wie im Market. */
function useCoverUrls(items: MarketItemSummary[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = items.map((i) => i.coverPath ?? "").join("|");

  useEffect(() => {
    let alive = true;
    const paths = items.flatMap((i) =>
      i.coverPath
        ? [variantPath(i.coverPath, "medium"), variantPath(i.coverPath, "thumb"), i.coverPath]
        : [],
    );
    if (paths.length === 0) {
      setUrls({});
      return;
    }
    void signPaths(paths).then((map) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      for (const item of items) {
        const p = item.coverPath;
        if (!p) continue;
        const medium = variantPath(p, "medium");
        const thumb = variantPath(p, "thumb");
        const url = (medium && map[medium]) ?? (thumb && map[thumb]) ?? map[p];
        if (url) next[item.id] = url;
      }
      setUrls(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

export function MarketFeedList() {
  const { lang } = useLang();
  const t = TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.de;
  const fetchFeed = useServerFn(listMarketFeed);

  const { data, isLoading } = useQuery({
    queryKey: ["market-feed"],
    queryFn: () => fetchFeed({ data: { limit: 30 } }),
    staleTime: 60_000,
  });

  const items = useMemo(() => (data?.items ?? []) as FeedItem[], [data]);
  const covers = useCoverUrls(items);

  /** Stand des letzten Besuchs einmal einfrieren, damit Marker sichtbar bleiben. */
  const lastSeen = useRef<number | null>(null);
  if (lastSeen.current === null && typeof window !== "undefined") {
    lastSeen.current = readLastSeen();
  }

  // Besuch merken – erst beim Verlassen, damit „Neu“ während der Sitzung bleibt.
  useEffect(() => {
    return () => {
      try {
        window.localStorage.setItem(SEEN_KEY, String(Date.now()));
      } catch {
        /* Speicher nicht verfügbar – reine Anzeigehilfe. */
      }
    };
  }, []);

  if (isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.loading}
      </p>
    );
  }

  const hasSearches = (data?.searches.length ?? 0) > 0;
  if (!hasSearches || items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background/40 px-4 py-10 text-center">
        <Search className="mx-auto h-5 w-5 text-brand" />
        <p className="mt-2 text-sm text-muted-foreground">{hasSearches ? t.empty : t.noSearches}</p>
        <Link
          to="/market"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          {t.toMarket}
        </Link>
      </div>
    );
  }

  const since = lastSeen.current ?? 0;
  const fresh = items.filter((i) => i.createdAt > since);
  const older = items.filter((i) => i.createdAt <= since);

  const grid = (list: FeedItem[], priority: boolean) => (
    <div className="grid grid-cols-2 gap-3 px-2 sm:grid-cols-3 sm:px-0">
      {list.map((item, i) => (
        <div key={item.id} className="relative">
          <MarketItemCard
            item={item}
            lang={lang}
            imageUrl={covers[item.id] ?? null}
            priority={priority && i < 4}
          />
          {item.matchedLabels.length > 0 && (
            <span
              title={item.matchedLabels.join(", ")}
              className="pointer-events-none absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur"
            >
              {item.matchedLabels[0]}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      {fresh.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-wider text-brand sm:px-0">
            <Sparkles className="h-3.5 w-3.5" />
            {t.newHits} · {fresh.length}
          </h2>
          {grid(fresh, true)}
        </section>
      )}
      {older.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:px-0">
            {t.seen}
          </h2>
          {grid(older, fresh.length === 0)}
        </section>
      )}
    </div>
  );
}
