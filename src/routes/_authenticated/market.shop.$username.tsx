import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Loader2, PackageOpen, ShoppingBag } from "lucide-react";

import { AvatarGlowRing } from "@/components/AvatarGlow";
import { MarketItemCard } from "@/components/market/MarketItemCard";
import { MarketSketchBackground } from "@/components/market/MarketSketchBackground";
import { goBackOr } from "@/lib/back-nav";
import { useData } from "@/lib/data-context";
import { marketTexts } from "@/lib/i18n-market";
import { useLang } from "@/lib/lang-context";
import { getMarketSellerShop } from "@/lib/market.functions";
import type { MarketItemSummary } from "@/lib/market.server";
import { signPaths, variantPath } from "@/lib/media";

export const Route = createFileRoute("/_authenticated/market/shop/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} Shop — Y-Dude Market` },
      {
        name: "description",
        content: `Aktive Market-Angebote von @${params.username} auf Y-Dude.`,
      },
      { property: "og:title", content: `@${params.username} Shop — Y-Dude Market` },
      {
        property: "og:description",
        content: `Aktive Market-Angebote von @${params.username}.`,
      },
      { property: "og:type", content: "profile" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ShopError,
  notFoundComponent: ShopError,
  component: MarketShopPage,
});

function ShopError() {
  const { lang } = useLang();
  return <p className="p-6 text-sm text-muted-foreground">{marketTexts[lang].shopNotFound}</p>;
}

function useShopImages(items: MarketItemSummary[], avatarPath: string | null) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = `${avatarPath ?? ""}|${items.map((item) => `${item.id}:${item.coverPath ?? ""}`).join("|")}`;

  useEffect(() => {
    let alive = true;
    const paths = [
      avatarPath,
      variantPath(avatarPath, "thumb"),
      ...items.flatMap((item) => [
        variantPath(item.coverPath, "medium"),
        variantPath(item.coverPath, "thumb"),
        item.coverPath,
      ]),
    ];
    void signPaths(paths).then((next) => {
      if (alive) setUrls(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

function MarketShopPage() {
  const { username } = Route.useParams();
  const { lang } = useLang();
  const m = marketTexts[lang];
  const router = useRouter();
  const { user } = useData();
  const loadShop = useServerFn(getMarketSellerShop);
  const { data: shop, isLoading } = useQuery({
    queryKey: ["market-shop", username.toLowerCase()],
    queryFn: () => loadShop({ data: { username } }),
    staleTime: 30_000,
  });
  const items = shop?.items ?? [];
  const urls = useShopImages(items, shop?.seller.avatarPath ?? null);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {m.loading}
      </p>
    );
  }
  if (!shop) return <ShopError />;

  const avatarVariant = variantPath(shop.seller.avatarPath, "thumb");
  const avatarUrl =
    (avatarVariant ? urls[avatarVariant] : undefined) ??
    (shop.seller.avatarPath ? urls[shop.seller.avatarPath] : undefined) ??
    null;
  const isOwner = user?.id === shop.seller.id;

  return (
    <main className="market-page relative isolate mx-auto w-full max-w-5xl px-3 pb-24 pt-3 sm:px-4">
      <MarketSketchBackground />
      <BackButton onClick={() => goBackOr(router, "/market")} label={m.back} className="mb-3" />

      <header className="relative mb-5 overflow-hidden rounded-xl border border-border/80 bg-card/80 p-4 shadow-subtle sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <AvatarGlowRing userId={shop.seller.id} size="lg" borderOpacity="60">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={shop.seller.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl font-black text-primary-foreground">
                {(shop.seller.displayName || shop.seller.username).slice(0, 1).toUpperCase()}
              </span>
            )}
          </AvatarGlowRing>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase text-brand">Y-Dude Market</p>
            <h1 className="mt-1 flex min-w-0 items-center gap-1.5 text-xl font-bold text-foreground sm:text-2xl">
              <span className="truncate">{shop.seller.displayName}</span>
              {shop.seller.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-brand" />}
            </h1>
            <Link
              to="/profile/$username"
              params={{ username: shop.seller.username }}
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-brand"
            >
              @{shop.seller.username}
            </Link>
          </div>
        </div>
        {isOwner && (
          <Link
            to="/market/mine"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand/50 px-3 text-xs font-bold text-brand transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <PackageOpen className="h-4 w-4" />
            {m.manageMyItems}
          </Link>
        )}
      </header>

      <section aria-labelledby="shop-offers">
        <h2
          id="shop-offers"
          className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-foreground"
        >
          <ShoppingBag className="h-4 w-4 text-brand" />
          {m.shopOffers}
          <span className="text-xs font-medium text-muted-foreground">{items.length}</span>
        </h2>
        {items.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card/60 px-4 py-10 text-center">
            <PackageOpen className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{m.shopEmpty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => {
              const medium = variantPath(item.coverPath, "medium");
              const thumb = variantPath(item.coverPath, "thumb");
              const imageUrl =
                (medium ? urls[medium] : undefined) ??
                (thumb ? urls[thumb] : undefined) ??
                (item.coverPath ? urls[item.coverPath] : undefined) ??
                null;
              return (
                <MarketItemCard
                  key={item.id}
                  item={item}
                  lang={lang}
                  imageUrl={imageUrl}
                  priority={index < 2}
                />
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
