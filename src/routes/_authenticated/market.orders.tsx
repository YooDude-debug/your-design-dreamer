/**
 * Y-Dude Market – Käufe und Verkäufe (Übersicht).
 *
 * Seitenweises Laden per Keyset-Cursor; es werden nur die für die Liste
 * benötigten Felder geladen.
 */

import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, ShoppingBag } from "lucide-react";

import { useLang } from "@/lib/lang-context";
import { formatMarketPrice } from "@/lib/i18n-market";
import { marketTxTexts } from "@/lib/i18n-market-tx";
import { listMarketTransactions } from "@/lib/market-tx.functions";
import type { MarketTransaction } from "@/lib/market-tx.server";

export const Route = createFileRoute("/_authenticated/market/orders")({
  head: () => ({
    meta: [
      { title: "Käufe & Verkäufe — Y-Dude Market" },
      {
        name: "description",
        content: "Alle laufenden und abgeschlossenen Market-Vorgänge auf einen Blick.",
      },
      { property: "og:title", content: "Käufe & Verkäufe — Y-Dude Market" },
      { property: "og:description", content: "Kaufabwicklung bei Y-Dude Market." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => <p className="p-6 text-sm text-muted-foreground">—</p>,
  notFoundComponent: () => <p className="p-6 text-sm text-muted-foreground">—</p>,
  component: OrdersPage,
});

function OrdersPage() {
  const { lang } = useLang();
  const t = marketTxTexts[lang];
  const navigate = useNavigate();
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const list = useServerFn(listMarketTransactions);

  const { data, isLoading } = useQuery({
    queryKey: ["market-orders", role],
    queryFn: () => list({ data: { role, limit: 20 } }),
  });

  const items: MarketTransaction[] = data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <BackButton onClick={() => navigate({ to: "/market" })} label={t.orders} className="mb-4" />

      <div className="flex gap-2">
        {(["buyer", "seller"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              role === r
                ? "bg-brand text-brand-foreground font-semibold"
                : "border border-border/60 text-muted-foreground"
            }`}
          >
            {r === "buyer" ? t.purchases : t.sales}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <div className="grid place-items-center p-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t.none}</p>
        ) : (
          items.map((tx) => (
            <Link
              key={tx.id}
              to="/market/tx/$txId"
              params={{ txId: tx.id }}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted/30">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{tx.itemTitle}</span>
                <span className="text-xs text-muted-foreground">
                  {tx.reference} · {t.statusLabels[tx.status] ?? tx.status}
                </span>
              </span>
              <span className="text-sm font-semibold text-brand">
                {formatMarketPrice(tx.totalCents, lang)}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
