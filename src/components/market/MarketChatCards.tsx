/**
 * Market-Karten im bestehenden Messenger: Artikelkontext und Preisangebot.
 *
 * Beide Karten verweisen immer auf den originalen Market-Artikel; es werden
 * keine Artikelkopien erzeugt. Die Angebotsaktionen laufen ueber die
 * Server-Functions (Rechte werden zusaetzlich in der Datenbank geprueft).
 */

import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ImageOff, Loader2, MapPin, ShoppingBag, Tag } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { formatMarketPrice, marketTexts } from "@/lib/i18n-market";
import type { MarketChatItem, MarketOffer } from "@/lib/market-chat.server";

export function MarketContextCard({
  item,
  coverUrl,
  compact = false,
}: {
  item: MarketChatItem;
  coverUrl?: string | null;
  compact?: boolean;
}) {
  const { lang } = useLang();
  const m = marketTexts[lang];
  return (
    <Link
      to="/market/$itemId"
      params={{ itemId: item.id }}
      className={`flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-2.5 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted/30">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageOff className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShoppingBag className="h-3 w-3" />
          {m.marketTitle}
        </span>
        <span className="block truncate font-semibold text-foreground">{item.title}</span>
        <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-brand">
            {formatMarketPrice(item.priceCents, lang)}
          </span>
          {item.place && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {item.place}
            </span>
          )}
          {item.status === "sold" && (
            <span className="rounded-full bg-muted/50 px-2 py-0.5">{m.itemSoldNotice}</span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-[11px] text-brand">{m.viewItem} →</span>
    </Link>
  );
}

export function MarketOfferCard({
  offer,
  isSeller,
  onRespond,
}: {
  offer: MarketOffer;
  isSeller: boolean;
  onRespond: (action: "accept" | "decline" | "withdraw") => Promise<void>;
}) {
  const { lang } = useLang();
  const m = marketTexts[lang];
  const [busy, setBusy] = useState(false);

  const statusLabel =
    offer.status === "accepted"
      ? m.offerAccepted
      : offer.status === "declined"
        ? m.offerDeclined
        : offer.status === "withdrawn"
          ? m.offerWithdrawn
          : m.offerOpen;
  const statusDot =
    offer.status === "accepted"
      ? "bg-emerald-500"
      : offer.status === "declined"
        ? "bg-red-500"
        : offer.status === "withdrawn"
          ? "bg-muted-foreground"
          : "bg-amber-400";

  const act = async (action: "accept" | "decline" | "withdraw") => {
    setBusy(true);
    try {
      await onRespond(action);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[16rem] rounded-2xl border border-border/60 bg-card/70 p-3">
      <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Tag className="h-3 w-3" />
        {isSeller ? m.offerReceived : m.offerHeading}
      </p>
      <p className="mt-1 text-lg font-bold text-foreground">
        {formatMarketPrice(offer.amountCents, lang)}
      </p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${statusDot}`} />
        {statusLabel}
      </p>

      {offer.status === "open" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {isSeller ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("accept")}
                className="min-h-9 rounded-full bg-brand px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : m.offerAccept}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("decline")}
                className="min-h-9 rounded-full border border-border px-3 text-xs text-muted-foreground disabled:opacity-60"
              >
                {m.offerDecline}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("withdraw")}
              className="min-h-9 rounded-full border border-border px-3 text-xs text-muted-foreground disabled:opacity-60"
            >
              {m.offerWithdraw}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
