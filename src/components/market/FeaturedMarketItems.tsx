/**
 * „Hervorgehobene Angebote“ – klar abgegrenzter Bereich auf der
 * Market-Startseite. Bewusst als eigener Block statt vermischt mit der
 * normalen Liste, damit bezahlte Sichtbarkeit erkennbar bleibt.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";

import { listFeaturedMarketItems } from "@/lib/market.functions";
import type { MarketItemSummary } from "@/lib/market.server";
import { marketTexts } from "@/lib/i18n-market";
import type { Lang } from "@/lib/i18n-dict";
import { signPaths, variantPath } from "@/lib/media";
import { MarketItemCard } from "./MarketItemCard";

export function FeaturedMarketItems({
  lang,
  categoryId,
  onIds,
}: {
  lang: Lang;
  categoryId: string | null;
  /** Meldet gerenderte IDs nach oben, damit die Hauptliste nicht doppelt zeigt. */
  onIds?: (ids: string[]) => void;
}) {
  const m = marketTexts[lang];
  const load = useServerFn(listFeaturedMarketItems);
  const { data } = useQuery({
    queryKey: ["market-featured", categoryId],
    queryFn: () => load({ data: { categoryId } }),
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    return ((data ?? []) as MarketItemSummary[]).filter((i) =>
      seen.has(i.id) ? false : (seen.add(i.id), true),
    );
  }, [data]);
  const covers = useCovers(items);

  const idsKey = items.map((i) => i.id).join("|");
  useEffect(() => {
    onIds?.(idsKey ? idsKey.split("|") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (items.length === 0) return null;

  return (
    <section className="mb-5">
      <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-brand" />
        {m.featuredHeading}
      </h2>
      <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        {items.map((item) => (
          <div key={item.id} className="w-40 shrink-0 sm:w-48">
            <MarketItemCard item={item} lang={lang} imageUrl={covers[item.id] ?? null} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Titelbilder über die bestehende Varianten-Kette signieren (P-01). */
function useCovers(items: MarketItemSummary[]) {
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
