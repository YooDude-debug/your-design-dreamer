/**
 * „Meine Artikel“ auf der Market-Startseite.
 *
 * Zeigt ausschliesslich die eigenen Market-Artikel des angemeldeten Nutzers
 * (bestehende Server-Function `searchMarketItems` mit `mine: true`) und
 * unterscheidet sie nach Verkaufsstatus. Die Auswahl (Alle / Nicht verkauft /
 * Verkauft) wird vom Elternteil gesteuert, damit sie oben in der kompakten
 * Auswahlkarte sitzt. Es gibt keine zweite Datenhaltung: „Verkauft“ folgt
 * allein `item.status === "sold"`.
 *
 * Zusätzlich meldet die Komponente die IDs der hier gerenderten Artikel nach
 * oben, damit die allgemeine Market-Liste denselben Datensatz nicht ein
 * zweites Mal anzeigt.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";

import { searchMarketItems } from "@/lib/market.functions";
import type { MarketItemSummary } from "@/lib/market.server";
import { marketTexts } from "@/lib/i18n-market";
import type { Lang } from "@/lib/i18n-dict";
import { MarketItemCard } from "@/components/market/MarketItemCard";
import { signPaths, variantPath } from "@/lib/media";

export type MineTab = "all" | "unsold" | "sold";

export type MineMeta = {
  counts: Record<MineTab, number>;
  /** IDs der aktuell sichtbaren eigenen Artikel (für Dedupe der Hauptliste). */
  shownIds: string[];
};

/** Signierte Titelbilder – gleiche Varianten-Kette wie in der Übersicht. */
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

export function MyMarketItems({
  lang,
  tab,
  onMeta,
}: {
  lang: Lang;
  tab: MineTab;
  onMeta?: (meta: MineMeta) => void;
}) {
  const m = marketTexts[lang];

  const search = useServerFn(searchMarketItems);
  const { data, isLoading } = useQuery({
    queryKey: ["market-mine-items-inline"],
    queryFn: () => search({ data: { mine: true, limit: 40 } }),
    staleTime: 30_000,
  });

  const own = data?.items ?? [];
  const shown = useMemo(() => {
    const list =
      tab === "all"
        ? own
        : own.filter((i) => (tab === "sold" ? i.status === "sold" : i.status !== "sold"));
    // Sicherheitsnetz: identische IDs können nie doppelt gerendert werden.
    const seen = new Set<string>();
    return list.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own, tab]);

  const covers = useCoverUrls(shown);

  const countsKey = own.map((i) => `${i.id}:${i.status}`).join("|");
  const shownKey = shown.map((i) => i.id).join("|");
  useEffect(() => {
    onMeta?.({
      counts: {
        all: own.length,
        unsold: own.filter((i) => i.status !== "sold").length,
        sold: own.filter((i) => i.status === "sold").length,
      },
      shownIds: shown.map((i) => i.id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsKey, shownKey]);

  const emptyText =
    tab === "sold"
      ? m.myItemsEmptySold
      : tab === "unsold"
        ? m.myItemsEmptyUnsold
        : m.myItemsEmptyAll;

  return (
    <section className="mb-6">
      {isLoading ? (
        <p className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {m.loading}
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => {
            const sold = item.status === "sold";
            return (
              <div key={item.id} className="relative">
                <div className={sold ? "opacity-60 saturate-50" : undefined}>
                  <MarketItemCard item={item} lang={lang} imageUrl={covers[item.id] ?? null} />
                </div>
                <span
                  className={`pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    sold
                      ? "bg-foreground/85 text-background"
                      : "border border-brand/50 bg-background/85 text-brand"
                  }`}
                >
                  {sold && <CheckCircle2 className="h-3 w-3" />}
                  {sold ? m.statusSold : m.statusAvailable}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
