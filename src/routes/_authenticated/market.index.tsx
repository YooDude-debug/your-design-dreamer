/**
 * Y-Dude Market – Startseite (Phase 1).
 *
 * Enthält Suche, Kategorienleiste, Basisfilter (Preis, nur mit Bild), eigene
 * Artikel und die seitenweise Ergebnisliste. Alle Daten kommen aus den
 * bestehenden Market-Server-Functions; es gibt keine parallele Datenhaltung.
 */

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BellRing,
  Filter,
  Hash,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";

import { goBackOr } from "@/lib/back-nav";
import { useLang } from "@/lib/lang-context";
import { marketCategoryLabel, marketTexts } from "@/lib/i18n-market";
import {
  listMarketCategories,
  saveMarketSearch,
  searchMarketEverything,
} from "@/lib/market.functions";
import type { MarketItemSummary } from "@/lib/market.server";
import { MarketItemCard } from "@/components/market/MarketItemCard";
import { MarketVoiceSearch } from "@/components/market/MarketVoiceSearch";
import { signPaths, variantPath } from "@/lib/media";


export const Route = createFileRoute("/_authenticated/market/")({
  head: () => ({
    meta: [
      { title: "Y-Dude Market — Buy. Sell. Speak Local." },
      {
        name: "description",
        content:
          "Y-Dude Market: Artikel lokal kaufen und verkaufen – mit Kategorien, Suche, Standort und direktem Kontakt über den Y-Dude Messenger.",
      },
      { property: "og:title", content: "Y-Dude Market — Buy. Sell. Speak Local." },
      {
        property: "og:description",
        content: "Lokal kaufen und verkaufen, direkt in Y-Dude.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => <RouteNotice kind="error" />,
  notFoundComponent: () => <RouteNotice kind="notFound" />,
  component: MarketHome,
});

function RouteNotice({ kind }: { kind: "error" | "notFound" }) {
  const { lang } = useLang();
  const m = marketTexts[lang];
  return (
    <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
      {kind === "error" ? m.loadFailed : m.notFound}
    </div>
  );
}

const PAGE_SIZE = 20;

/** Signierte URLs für die Titelbilder der aktuellen Seite. */
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

function MarketHome() {
  const { lang } = useLang();
  const m = marketTexts[lang];
  const router = useRouter();

  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [withImageOnly, setWithImageOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [collected, setCollected] = useState<MarketItemSummary[]>([]);

  const loadCategories = useServerFn(listMarketCategories);
  const search = useServerFn(searchMarketItems);

  const { data: categories = [] } = useQuery({
    queryKey: ["market-categories"],
    queryFn: () => loadCategories(),
    staleTime: 10 * 60_000,
  });

  // Sucheingabe entprellen (300 ms) – gleiche Logik wie in der Channel-Suche.
  useEffect(() => {
    const id = window.setTimeout(() => setTerm(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const priceMinCents = useMemo(() => {
    const v = Number(priceFrom.replace(",", "."));
    return priceFrom.trim() && Number.isFinite(v) ? Math.round(v * 100) : null;
  }, [priceFrom]);
  const priceMaxCents = useMemo(() => {
    const v = Number(priceTo.replace(",", "."));
    return priceTo.trim() && Number.isFinite(v) ? Math.round(v * 100) : null;
  }, [priceTo]);

  const filterKey = [term, categoryId, priceMinCents, priceMaxCents, withImageOnly, mine].join("~");

  // Neue Filter starten immer auf Seite 0 mit leerer Sammelliste.
  useEffect(() => {
    setPage(0);
    setCollected([]);
  }, [filterKey]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["market-items", filterKey, page],
    queryFn: () =>
      search({
        data: {
          q: term,
          categoryId,
          priceMinCents,
          priceMaxCents,
          withImageOnly,
          mine,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      }),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!data) return;
    setCollected((prev) => {
      if (page === 0) return data.items;
      const seen = new Set(prev.map((i) => i.id));
      return [...prev, ...data.items.filter((i) => !seen.has(i.id))];
    });
  }, [data, page]);

  const covers = useCoverUrls(collected);
  const hasMore = !!data?.hasMore;

  const resetFilters = () => {
    setPriceFrom("");
    setPriceTo("");
    setWithImageOnly(false);
    setCategoryId(null);
    setMine(false);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-24 pt-3 sm:px-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => goBackOr(router, "/dev")}
          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" />
          {m.back}
        </button>
        <Link
          to="/market/new"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-primary-foreground active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          {m.createItem}
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <ShoppingBag className="h-6 w-6 text-brand" />
          Y-Dude {m.marketTitle}
        </h1>
        <p className="mt-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {m.claim}
        </p>
      </header>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={m.searchPlaceholder}
            className="w-full rounded-full border border-border bg-card/60 py-2 pl-9 pr-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand/60"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              aria-label={m.resetFilters}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-brand"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label={m.filters}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-muted-foreground transition-colors ${
            filtersOpen ? "border-brand/60 text-brand" : "border-border hover:border-brand/60"
          }`}
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {filtersOpen && (
        <div className="mb-3 space-y-3 rounded-2xl border border-border/60 bg-card/50 p-3">
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-muted-foreground">
              {m.priceFrom}
              <input
                value={priceFrom}
                onChange={(e) => setPriceFrom(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-brand/60"
              />
            </label>
            <label className="flex-1 text-xs text-muted-foreground">
              {m.priceTo}
              <input
                value={priceTo}
                onChange={(e) => setPriceTo(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-brand/60"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={withImageOnly}
                onChange={(e) => setWithImageOnly(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--brand))]"
              />
              {m.onlyWithImages}
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => setMine(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--brand))]"
              />
              {m.myItems}
            </label>
            <Link
              to="/market/mine"
              className="rounded-full border border-brand/50 px-3 py-1.5 text-xs font-semibold text-brand"
            >
              {m.mineTitle}
            </Link>
            <button
              onClick={resetFilters}
              className="ml-auto rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-brand/50 hover:text-brand"
            >
              {m.resetFilters}
            </button>
          </div>
        </div>
      )}

      <div className="-mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        <button
          onClick={() => setCategoryId(null)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
            categoryId === null
              ? "border-brand/60 bg-brand/10 text-brand"
              : "border-border text-muted-foreground hover:border-brand/50"
          }`}
        >
          {m.allCategories}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoryId(cat.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              categoryId === cat.id
                ? "border-brand/60 bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:border-brand/50"
            }`}
          >
            {marketCategoryLabel(cat, lang)}
          </button>
        ))}
      </div>

      {isLoading && collected.length === 0 ? (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {m.loading}
        </p>
      ) : collected.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">{m.noResults}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {collected.map((item) => (
              <MarketItemCard
                key={item.id}
                item={item}
                lang={lang}
                imageUrl={covers[item.id] ?? null}
              />
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:border-brand/50 hover:text-brand disabled:opacity-50"
              >
                {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {m.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
