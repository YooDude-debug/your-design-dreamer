/**
 * Y-Dude Market – Startseite (Phase 1).
 *
 * Enthält Suche, Kategorienleiste, Basisfilter (Preis, nur mit Bild), eigene
 * Artikel und die seitenweise Ergebnisliste. Alle Daten kommen aus den
 * bestehenden Market-Server-Functions; es gibt keine parallele Datenhaltung.
 */

import { BackButton, CloseButton } from "@/components/ui/nav-buttons";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BellRing,
  Check,
  ChevronDown,
  Filter,
  Hash,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
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
import { FeaturedMarketItems } from "@/components/market/FeaturedMarketItems";
import { MyMarketItems } from "@/components/market/MyMarketItems";
import { MarketVoiceSearch } from "@/components/market/MarketVoiceSearch";
import { signPaths, variantPath } from "@/lib/media";
import { DropdownPortal } from "@/components/DropdownPortal";

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
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const categoryBtnRef = useRef<HTMLButtonElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [withImageOnly, setWithImageOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [geo, setGeo] = useState<{ lat: number; lon: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [savedHint, setSavedHint] = useState(false);

  const loadCategories = useServerFn(listMarketCategories);
  const search = useServerFn(searchMarketEverything);
  const saveSearch = useServerFn(saveMarketSearch);
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ["market-categories"],
    queryFn: () => loadCategories(),
    staleTime: 10 * 60_000,
  });

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );

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

  /** Standort nur auf ausdrücklichen Wunsch – nie automatisch. */
  const useMyLocation = () => {
    if (geo) {
      setGeo(null);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError(m.locationDenied);
      return;
    }
    setGeoBusy(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoBusy(false);
      },
      () => {
        setGeoError(m.locationDenied);
        setGeoBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  };

  const request = useMemo(
    () => ({
      q: term,
      categoryId,
      priceMinCents,
      priceMaxCents,
      withImageOnly,
      lat: geo?.lat ?? null,
      lon: geo?.lon ?? null,
      radiusKm: geo ? radiusKm : null,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    [term, categoryId, priceMinCents, priceMaxCents, withImageOnly, geo, radiusKm],
  );

  const filterKey = JSON.stringify(request);

  useEffect(() => {
    setVisible(PAGE_SIZE);
    setSavedHint(false);
  }, [filterKey]);

  const { data, isLoading } = useQuery({
    queryKey: ["market-search", filterKey],
    queryFn: () => search({ data: request }),
    staleTime: 30_000,
  });

  const items: MarketItemSummary[] = data?.items ?? [];
  const shown = items.slice(0, visible);
  const covers = useCoverUrls(shown);
  const hasMore = items.length > visible;
  const chips = data?.parsed.chips ?? [];

  const onSaveSearch = async () => {
    await saveSearch({ data: { ...request, label: null } });
    await queryClient.invalidateQueries({ queryKey: ["market-saved-searches"] });
    setSavedHint(true);
  };

  const resetFilters = () => {
    setPriceFrom("");
    setPriceTo("");
    setWithImageOnly(false);
    setCategoryId(null);
    setGeo(null);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-24 pt-3 sm:px-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <BackButton onClick={() => goBackOr(router, "/dev")} label={m.back} />
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
            <CloseButton onClick={() => setQ("")} label={m.resetFilters} size="sm" className="absolute right-2 top-1/2 -translate-y-1/2" />
          )}
        </div>
        <MarketVoiceSearch lang={lang} onText={(text) => setQ(text)} />
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

      {(chips.length > 0 || term) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span
              key={`${chip.kind}-${chip.label}`}
              className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] text-brand"
            >
              {chip.label}
            </span>
          ))}
          {term && (
            <button
              onClick={() => void onSaveSearch()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:border-brand/50 hover:text-brand"
            >
              <BellRing className="h-3.5 w-3.5" />
              {savedHint ? m.searchSaved : m.saveSearch}
            </button>
          )}
        </div>
      )}

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
            <button
              onClick={useMyLocation}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                geo
                  ? "border-brand/60 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/50"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              {geoBusy ? m.locating : m.nearMe}
            </button>
            {geo && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {m.radiusLabel}
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="rounded-full border border-border bg-background/60 px-2 py-1 text-xs text-foreground outline-none focus:border-brand/60"
                >
                  {[5, 10, 25, 50, 100, 250].map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </select>
              </label>
            )}
            {geoError && <span className="text-xs text-muted-foreground">{geoError}</span>}

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

      <div className="mb-4 flex items-center gap-2">
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

        <div className="relative">
          <button
            ref={categoryBtnRef}
            onClick={() => setCatMenuOpen((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              categoryId !== null
                ? "border-brand/60 bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:border-brand/50"
            }`}
          >
            {selectedCategory ? marketCategoryLabel(selectedCategory, lang) : m.categories}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          <DropdownPortal
            anchorRef={categoryBtnRef}
            open={catMenuOpen}
            onClose={() => setCatMenuOpen(false)}
            align="left"
            width={220}
          >
            <div className="space-y-0.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(cat.id);
                    setCatMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    categoryId === cat.id
                      ? "bg-brand/10 text-brand"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cat.icon ? <span className="text-sm">{cat.icon}</span> : null}
                  <span className="flex-1 truncate">{marketCategoryLabel(cat, lang)}</span>
                  {categoryId === cat.id && <Check className="h-3.5 w-3.5 text-brand" />}
                </button>
              ))}
            </div>
          </DropdownPortal>
        </div>
      </div>

      <MyMarketItems lang={lang} />

      <FeaturedMarketItems lang={lang} categoryId={categoryId} />

      {isLoading && shown.length === 0 ? (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {m.loading}
        </p>
      ) : shown.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">{m.noResults}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((item) => (
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
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:border-brand/50 hover:text-brand"
              >
                {m.loadMore}
              </button>
            </div>
          )}
        </>
      )}

      {(data?.channels.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-foreground">{m.matchingChannels}</h2>
          <div className="flex flex-wrap gap-2">
            {data!.channels.map((c) => (
              <Link
                key={c.id}
                to="/channels/$channelId"
                params={{ channelId: c.id }}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-brand/50 hover:text-brand"
              >
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {(data?.slangTags.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-foreground">{m.matchingSlangTags}</h2>
          <div className="flex flex-wrap gap-2">
            {data!.slangTags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                <Hash className="h-3 w-3 text-brand" />
                {t.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
