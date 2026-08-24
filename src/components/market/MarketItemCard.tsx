/**
 * Artikelkarte für Y-Dude Market (Listen, Suche, eigene Artikel).
 *
 * Bildquelle folgt der bestehenden Varianten-Kette (P-01): Medium zuerst,
 * Thumbnail als Notnagel, Original nur, wenn keine Variante existiert.
 */

import { Link } from "@tanstack/react-router";
import { ImageOff, MapPin } from "lucide-react";

import type { MarketItemSummary } from "@/lib/market.server";
import { formatMarketPrice, marketTexts } from "@/lib/i18n-market";
import type { Lang } from "@/lib/i18n-dict";
import { relativeTime } from "@/lib/types";

export function MarketItemCard({
  item,
  lang,
  imageUrl,
}: {
  item: MarketItemSummary;
  lang: Lang;
  imageUrl: string | null;
}) {
  const m = marketTexts[lang];
  const statusLabel =
    item.status === "sold"
      ? m.statusSold
      : item.status === "reserved"
        ? m.statusReserved
        : item.status === "disabled"
          ? m.statusDisabled
          : null;

  return (
    <Link
      to="/market/$itemId"
      params={{ itemId: item.id }}
      className="group overflow-hidden rounded-2xl border border-border/60 bg-card/60 transition-colors hover:border-brand/50"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted/30">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        {statusLabel && (
          <span className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur">
            {statusLabel}
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        <p className="text-sm font-bold text-brand">{formatMarketPrice(item.priceCents, lang)}</p>
        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          {item.place && (
            <>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.place}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>{relativeTime(item.createdAt)}</span>
        </p>
      </div>
    </Link>
  );
}
