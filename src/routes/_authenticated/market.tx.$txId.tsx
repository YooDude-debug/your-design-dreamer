/**
 * Y-Dude Market – Vorgangsseite (Käufer und Verkäufer).
 *
 * Zeigt Status, Verlauf, Versand bzw. Abholcode und die jeweils erlaubten
 * Aktionen. Alle Statuswechsel laufen über Server-Functions; die Oberfläche
 * entscheidet nichts allein.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CreditCard, Loader2, PackageCheck, Truck } from "lucide-react";

import { useLang } from "@/lib/lang-context";
import { formatMarketPrice } from "@/lib/i18n-market";
import { marketTxTexts } from "@/lib/i18n-market-tx";
import type { getTransaction } from "@/lib/market-tx.server";
import {
  cancelMarketTransaction,
  confirmMarketDelivery,
  confirmMarketPickup,
  getMarketTransaction,
  markMarketShipped,
  openMarketDispute,
  requestMarketRefund,
} from "@/lib/market-tx.functions";

export const Route = createFileRoute("/_authenticated/market/tx/$txId")({
  head: () => ({
    meta: [
      { title: "Vorgang — Y-Dude Market" },
      { name: "description", content: "Status, Versand und Übergabe eines Market-Kaufs." },
      { property: "og:title", content: "Vorgang — Y-Dude Market" },
      { property: "og:description", content: "Kaufabwicklung bei Y-Dude Market." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => <p className="p-6 text-sm text-muted-foreground">—</p>,
  notFoundComponent: () => <p className="p-6 text-sm text-muted-foreground">—</p>,
  component: TxPage,
});

function TxPage() {
  const { txId } = Route.useParams();
  const { lang } = useLang();
  const t = marketTxTexts[lang];
  const navigate = useNavigate();
  const qc = useQueryClient();

  const load = useServerFn(getMarketTransaction);
  const ship = useServerFn(markMarketShipped);
  const deliver = useServerFn(confirmMarketDelivery);
  const pickup = useServerFn(confirmMarketPickup);
  const cancel = useServerFn(cancelMarketTransaction);
  const refund = useServerFn(requestMarketRefund);
  const dispute = useServerFn(openMarketDispute);

  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["market-tx", txId],
    queryFn: () =>
      load({ data: { transactionId: txId } }) as Promise<
        Awaited<ReturnType<typeof getTransaction>>
      >,
  });

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      const res = (await fn()) as { error?: string } | undefined;
      if (res && "error" in res && res.error) throw new Error(res.error);
      toast.success(t.saved);
      await qc.invalidateQueries({ queryKey: ["market-tx", txId] });
    } catch {
      toast.error(t.failed);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tx = data.transaction;
  const isBuyer = data.role === "buyer";
  const unpaid = tx.paymentStatus !== "paid";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <button
        type="button"
        onClick={() => navigate({ to: "/market/orders" })}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.backToOrders}
      </button>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <p className="text-xs text-muted-foreground">
          {t.reference} · {tx.reference}
        </p>
        <Link
          to="/market/$itemId"
          params={{ itemId: tx.itemId }}
          className="mt-1 block text-lg font-semibold text-foreground"
        >
          {tx.itemTitle}
        </Link>
        <p className="mt-1 text-sm">
          <span className="font-semibold text-brand">{formatMarketPrice(tx.totalCents, lang)}</span>{" "}
          <span className="text-muted-foreground">
            · {t.status}: {t.statusLabels[tx.status] ?? tx.status} ·{" "}
            {tx.fulfillmentType === "pickup" ? t.pickup : t.shipping}
          </span>
        </p>
        {tx.platformFeeCents > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t.platformFee}: {formatMarketPrice(tx.platformFeeCents, lang)}
          </p>
        )}
      </div>

      {/* Zahlung */}
      {isBuyer && unpaid && tx.status !== "cancelled" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/market/checkout/$txId"
            params={{ txId }}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
          >
            <CreditCard className="h-4 w-4" />
            {t.checkout}
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => cancel({ data: { transactionId: txId, reason: null } }))}
            className="rounded-full border border-border/60 px-4 py-2 text-sm"
          >
            {t.cancel}
          </button>
        </div>
      )}

      {/* Abholcode */}
      {data.pickupCode && (
        <div className="mt-3 rounded-2xl border border-brand/40 bg-brand/10 p-4">
          <p className="text-xs text-muted-foreground">{t.pickupCode}</p>
          <p className="text-2xl font-bold tracking-[0.3em] text-brand">{data.pickupCode}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.pickupCodeHint}</p>
        </div>
      )}

      {/* Verkäufer: Abholung bestätigen */}
      {!isBuyer &&
        tx.fulfillmentType === "pickup" &&
        tx.paymentStatus === "paid" &&
        tx.status !== "completed" && (
          <div className="mt-3 rounded-2xl border border-border/60 bg-card/60 p-4">
            <label className="text-xs text-muted-foreground">{t.enterPickupCode}</label>
            <div className="mt-2 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={12}
                className="min-w-0 flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy || code.length < 4}
                onClick={() => run(() => pickup({ data: { transactionId: txId, code } }))}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
              >
                {t.confirmPickup}
              </button>
            </div>
          </div>
        )}

      {/* Verkäufer: Versand melden */}
      {!isBuyer &&
        tx.fulfillmentType === "shipping" &&
        tx.paymentStatus === "paid" &&
        tx.status === "processing" && (
          <div className="mt-3 rounded-2xl border border-border/60 bg-card/60 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="h-4 w-4" /> {t.markShipped}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder={t.carrier}
                className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder={t.tracking}
                className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() =>
                  ship({
                    data: {
                      transactionId: txId,
                      carrier: carrier || null,
                      trackingNumber: tracking || null,
                      method: null,
                    },
                  }),
                )
              }
              className="mt-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
            >
              {t.markShipped}
            </button>
          </div>
        )}

      {/* Käufer: Erhalt bestätigen */}
      {isBuyer && tx.paymentStatus === "paid" && tx.status === "shipped" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => deliver({ data: { transactionId: txId } }))}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
        >
          <PackageCheck className="h-4 w-4" />
          {t.confirmDelivery}
        </button>
      )}

      {/* Versanddaten */}
      {data.shipping?.trackingNumber && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t.tracking}: {data.shipping.trackingNumber}
          {data.shipping.carrier ? ` · ${data.shipping.carrier}` : ""}
        </p>
      )}

      {/* Rückerstattung / Konflikt */}
      {tx.paymentStatus === "paid" && tx.status !== "refunded" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => refund({ data: { transactionId: txId, reason: null } }))}
            className="rounded-full border border-border/60 px-4 py-2 text-sm"
          >
            {t.refund}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                dispute({ data: { transactionId: txId, reasonCode: "other", details: null } }),
              )
            }
            className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm"
          >
            <AlertTriangle className="h-4 w-4" />
            {t.dispute}
          </button>
        </div>
      )}

      {/* Verlauf */}
      <div className="mt-6">
        <p className="text-sm font-semibold">{t.history}</p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {data.events.map((e) => (
            <li key={e.id}>
              {new Date(e.createdAt).toLocaleString(lang)} · {e.type}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
