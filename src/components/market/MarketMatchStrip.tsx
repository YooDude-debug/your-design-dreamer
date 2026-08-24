/**
 * „Passend dazu“ – kompakter, horizontal scrollbarer Streifen mit
 * Market-Angeboten zu einem suchaehnlichen Beitragstext.
 *
 * Regelbasiert (keine KI), begrenzte Trefferzahl und nur bei erkannter
 * Kaufabsicht sichtbar. Nutzt die bestehende Market-Suche und Thumbnails.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageOff, ShoppingBag } from "lucide-react";
import { matchMarketForText } from "@/lib/market.functions";
import { signPaths, variantPath } from "@/lib/media";
import { useLang } from "@/lib/lang-context";
import { formatMarketPrice, marketTexts } from "@/lib/i18n-market";

export function MarketMatchStrip({ text, limit = 6 }: { text: string; limit?: number }) {
  const { lang } = useLang();
  const m = marketTexts[lang];
  const match = useServerFn(matchMarketForText);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["market-match", text.slice(0, 200), limit],
    queryFn: () => match({ data: { text: text.slice(0, 400), limit } }),
    enabled: text.trim().length >= 8,
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  const key = items.map((i) => i.coverPath ?? "").join("|");

  useEffect(() => {
    const paths = items.map((i) => i.coverPath).filter(Boolean) as string[];
    if (paths.length === 0) {
      setUrls({});
      return;
    }
    let alive = true;
    const all = paths.flatMap((p) => [variantPath(p, "thumb"), p]);
    void signPaths(all).then((map) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      for (const p of paths) {
        const thumb = variantPath(p, "thumb");
        const url = (thumb && map[thumb]) ?? map[p];
        if (url) next[p] = url;
      }
      setUrls(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!data?.intent || items.length === 0) return null;

  return (
    <section className="mt-2 rounded-2xl border border-border/50 bg-card/40 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <ShoppingBag className="h-3.5 w-3.5" />
          {m.marketMatchTitle}
        </p>
        <Link to="/market" search={{ q: data.query }} className="text-[11px] text-brand">
          {m.showAllOffers} →
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => (
          <Link
            key={item.id}
            to="/market/$itemId"
            params={{ itemId: item.id }}
            className="w-32 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background/60"
          >
            <span className="grid aspect-square w-full place-items-center bg-muted/30">
              {item.coverPath && urls[item.coverPath] ? (
                <img
                  src={urls[item.coverPath]}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageOff className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <span className="block p-2">
              <span className="block truncate text-[11px] font-medium text-foreground">
                {item.title}
              </span>
              <span className="block text-[11px] font-semibold text-brand">
                {formatMarketPrice(item.priceCents, lang)}
              </span>
              {item.place && (
                <span className="block truncate text-[10px] text-muted-foreground">
                  {item.place}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
