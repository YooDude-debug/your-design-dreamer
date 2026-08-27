/**
 * „Ähnliche Artikel“ auf der Market-Detailseite (Phase 3).
 * Regelbasiert über die bestehende Suchschicht, kein KI-Modell.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getSimilarMarketItems } from "@/lib/market.functions";
import { MarketItemCard } from "@/components/market/MarketItemCard";
import { marketTexts } from "@/lib/i18n-market";
import type { Lang } from "@/lib/i18n-dict";
import { signPaths, variantPath } from "@/lib/media";

export function MarketSimilarItems({ itemId, lang }: { itemId: string; lang: Lang }) {
  const m = marketTexts[lang];
  const load = useServerFn(getSimilarMarketItems);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const { data: items = [] } = useQuery({
    queryKey: ["market-similar", itemId],
    queryFn: () => load({ data: { itemId } }),
    staleTime: 60_000,
  });

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
        const url =
          map[variantPath(p, "medium") ?? p] ?? map[variantPath(p, "thumb") ?? p] ?? map[p];
        if (url) next[item.id] = url;
      }
      setUrls(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{m.similarItems}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <MarketItemCard key={item.id} item={item} lang={lang} imageUrl={urls[item.id] ?? null} />
        ))}
      </div>
    </section>
  );
}
