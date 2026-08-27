/**
 * „Mein Market“ – eigene Artikel nach Status, Favoriten und Angebote.
 *
 * Die Seite benutzt ausschliesslich bestehende Market-Server-Functions; es
 * gibt keine zweite Datenhaltung und keine eigenen Berechtigungsregeln.
 */

import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Loader2, ShoppingBag, Tag } from "lucide-react";

import { goBackOr } from "@/lib/back-nav";
import { useLang } from "@/lib/lang-context";
import { formatMarketPrice, marketTexts } from "@/lib/i18n-market";
import { marketTxTexts } from "@/lib/i18n-market-tx";
import {
  listMarketFavorites,
  listMyOffers,
  searchMarketItems,
  respondMarketOffer,
} from "@/lib/market.functions";
import type { MarketItemSummary } from "@/lib/market.server";
import { MarketItemCard } from "@/components/market/MarketItemCard";
import { SavedSearchList } from "@/components/market/SavedSearchList";
import { MarketSellerDashboard } from "@/components/market/MarketSellerDashboard";
import { signPaths, variantPath } from "@/lib/media";

export const Route = createFileRoute("/_authenticated/market/mine")({
  head: () => ({
    meta: [
      { title: "Mein Market — Y-Dude" },
      {
        name: "description",
        content: "Eigene Artikel, gemerkte Angebote und Preisangebote in Y-Dude Market verwalten.",
      },
      { property: "og:title", content: "Mein Market — Y-Dude" },
      { property: "og:description", content: "Artikel, Favoriten und Angebote verwalten." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => <Notice />,
  notFoundComponent: () => <Notice />,
  component: MarketMine,
});

function Notice() {
  const { lang } = useLang();
  return <p className="p-6 text-sm text-muted-foreground">{marketTexts[lang].loadFailed}</p>;
}

/** Signierte Titelbilder (Varianten-Kette wie in der Market-Übersicht). */
function useCoverUrls(items: MarketItemSummary[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = items.map((i) => `${i.id}:${i.coverPath ?? ""}`).join("|");

  useEffect(() => {
    const withCover = items.filter((i) => i.coverPath);
    if (withCover.length === 0) {
      setUrls({});
      return;
    }
    let alive = true;
    const paths = withCover.flatMap((i) => [
      variantPath(i.coverPath!, "medium"),
      variantPath(i.coverPath!, "thumb"),
      i.coverPath!,
    ]);
    void signPaths(paths).then((map) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      for (const i of withCover) {
        const medium = variantPath(i.coverPath!, "medium");
        const thumb = variantPath(i.coverPath!, "thumb");
        const url = (medium && map[medium]) ?? (thumb && map[thumb]) ?? map[i.coverPath!];
        if (url) next[i.id] = url;
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

type Tab =
  | "active"
  | "reserved"
  | "sold"
  | "favorites"
  | "myOffers"
  | "receivedOffers"
  | "savedSearches"
  | "stats";

function MarketMine() {
  const { lang } = useLang();
  const m = marketTexts[lang];
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");

  const search = useServerFn(searchMarketItems);
  const favorites = useServerFn(listMarketFavorites);
  const offers = useServerFn(listMyOffers);
  const answer = useServerFn(respondMarketOffer);

  const itemsQuery = useQuery({
    queryKey: ["market-mine-items"],
    queryFn: () => search({ data: { mine: true, limit: 40 } }),
  });
  const favQuery = useQuery({
    queryKey: ["market-mine-favorites"],
    queryFn: () => favorites(),
    enabled: tab === "favorites",
  });
  const role = tab === "receivedOffers" ? "seller" : "buyer";
  const offerQuery = useQuery({
    queryKey: ["market-mine-offers", role],
    queryFn: () => offers({ data: { role } }),
    enabled: tab === "myOffers" || tab === "receivedOffers",
  });

  const own = itemsQuery.data?.items ?? [];
  const statusItems = own.filter((i) =>
    tab === "active"
      ? i.status === "active" || i.status === "disabled"
      : tab === "reserved"
        ? i.status === "reserved"
        : i.status === "sold",
  );
  const shown =
    tab === "favorites" ? (favQuery.data ?? []) : tab.endsWith("Offers") ? [] : statusItems;
  const covers = useCoverUrls(shown);

  const isSeller = role === "seller";
  const offerItems = new Map((offerQuery.data?.items ?? []).map((i) => [i.id, i]));
  const offerRows = offerQuery.data?.offers ?? [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "active", label: m.tabActive },
    { id: "reserved", label: m.tabReserved },
    { id: "sold", label: m.tabSold },
    { id: "favorites", label: m.tabFavorites },
    { id: "myOffers", label: m.tabMyOffers },
    { id: "receivedOffers", label: m.tabReceivedOffers },
    { id: "savedSearches", label: m.tabSavedSearches },
    { id: "stats", label: m.myStats },
  ];

  const busy =
    itemsQuery.isLoading ||
    (tab === "favorites" && favQuery.isLoading) ||
    (tab.endsWith("Offers") && offerQuery.isLoading);

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4">
      <header className="mb-3 flex items-center gap-2">
        <BackButton onClick={() => goBackOr(router, "/market")} ariaLabel={m.back} />
        <h1 className="inline-flex items-center gap-2 text-lg font-bold text-foreground">
          <ShoppingBag className="h-5 w-5 text-brand" />
          {m.mineTitle}
        </h1>
        <Link to="/market/orders" className="ml-auto text-xs font-semibold text-brand">
          {marketTxTexts[lang].orders}
        </Link>
        <Link to="/market" className="text-xs font-semibold text-brand">
          {m.marketTitle} →
        </Link>
      </header>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              tab === x.id
                ? "border-brand/60 bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:border-brand/50"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {busy && (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {m.loading}
        </p>
      )}

      {tab === "savedSearches" && <SavedSearchList lang={lang} />}

      {tab === "stats" && <MarketSellerDashboard lang={lang} />}

      {!busy && tab !== "savedSearches" && tab !== "stats" && !tab.endsWith("Offers") && (
        <>
          {shown.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {tab === "favorites" ? m.noFavorites : m.noResults}
            </p>
          ) : (
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
          )}
        </>
      )}

      {!busy && tab.endsWith("Offers") && (
        <>
          {offerRows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{m.noOffers}</p>
          ) : (
            <ul className="space-y-2">
              {offerRows.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-3"
                >
                  <Tag className="h-4 w-4 text-brand" />
                  <Link
                    to="/market/$itemId"
                    params={{ itemId: o.itemId }}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-brand"
                  >
                    {offerItems.get(o.itemId)?.title ?? m.viewItem}
                  </Link>
                  <span className="text-sm font-bold text-brand">
                    {formatMarketPrice(o.amountCents, lang)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {o.status === "open"
                      ? m.offerOpen
                      : o.status === "accepted"
                        ? m.offerAccepted
                        : o.status === "declined"
                          ? m.offerDeclined
                          : m.offerWithdrawn}
                  </span>
                  {o.status === "open" && (
                    <div className="flex gap-2">
                      {isSeller ? (
                        <>
                          <button
                            onClick={async () => {
                              await answer({ data: { offerId: o.id, action: "accept" } });
                              await offerQuery.refetch();
                              await itemsQuery.refetch();
                            }}
                            className="rounded-full border border-brand/60 px-3 py-1 text-[11px] font-semibold text-brand"
                          >
                            {m.offerAccept}
                          </button>
                          <button
                            onClick={async () => {
                              await answer({ data: { offerId: o.id, action: "decline" } });
                              await offerQuery.refetch();
                            }}
                            className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground"
                          >
                            {m.offerDecline}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={async () => {
                            await answer({ data: { offerId: o.id, action: "withdraw" } });
                            await offerQuery.refetch();
                          }}
                          className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground"
                        >
                          {m.offerWithdraw}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Heart className="h-3 w-3" />
        {m.claim}
      </p>
    </div>
  );
}
