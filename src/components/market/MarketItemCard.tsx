/**
 * Artikelkarte für Y-Dude Market (Listen, Suche, eigene Artikel).
 *
 * Bildquelle folgt der bestehenden Varianten-Kette (P-01): Medium zuerst,
 * Thumbnail als Notnagel, Original nur, wenn keine Variante existiert.
 */

import { Link } from "@tanstack/react-router";
import { Clock3, ImageOff, MapPin, Sparkles } from "lucide-react";

import type { MarketItemSummary } from "@/lib/market.server";
import { formatMarketPrice, marketTexts } from "@/lib/i18n-market";
import type { Lang } from "@/lib/i18n-dict";
import { relativeTime } from "@/lib/types";

export function MarketItemCard({
  item,
  lang,
  imageUrl,
  priority = false,
}: {
  item: MarketItemSummary;
  lang: Lang;
  imageUrl: string | null;
  /** Nur für die ersten sichtbaren Karten: Bild sofort und bevorzugt laden. */
  priority?: boolean;
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
  const conditionLabel =
    item.condition === "new"
      ? m.condNew
      : item.condition === "like_new"
        ? m.condLikeNew
        : item.condition === "good"
          ? m.condGood
          : m.condUsed;
  const unavailable = item.status !== "active";

  return (
    <Link
      to="/market/$itemId"
      params={{ itemId: item.id }}
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-subtle transition-[border-color,box-shadow,transform] duration-200 hover:border-brand/45 hover:shadow-glow-subtle focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50 active:scale-[0.99]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted/30">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.title}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className={`h-full w-full object-cover transition-[transform,filter,opacity] duration-300 group-hover:scale-[1.025] ${
              unavailable ? "opacity-60 saturate-50" : ""
            }`}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        {item.promotedUntil && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm bg-brand px-2 py-1 text-[9px] font-bold uppercase text-primary-foreground shadow-glow-subtle">
            <Sparkles className="h-3 w-3" />
            {m.promoted}
          </span>
        )}
        {statusLabel && (
          <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-sm border border-foreground/30 bg-background/90 px-2 py-1 text-[9px] font-bold uppercase text-foreground backdrop-blur-sm">
            {statusLabel}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground">
          {item.title}
        </p>
        <p className="mt-0.5 truncate text-lg font-bold leading-6 text-brand">
          {formatMarketPrice(item.priceCents, lang)}
        </p>
        <div className="mt-2 border-t border-border/70 pt-2 text-[10px] leading-4 text-muted-foreground">
          <p className="truncate font-medium uppercase text-muted-foreground">{conditionLabel}</p>
          <div className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
            {item.place ? (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.place}</span>
              </span>
            ) : (
              <span aria-hidden />
            )}
            <span className="flex shrink-0 items-center gap-1">
              <Clock3 className="h-3 w-3 shrink-0" />
              <span>{relativeTime(item.createdAt)}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
