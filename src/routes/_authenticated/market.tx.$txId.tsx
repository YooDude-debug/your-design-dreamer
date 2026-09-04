/**
 * Y-Dude Market – Vorgangsseite (Käufer und Verkäufer).
 *
 * Vereinfachter Market: Standard ist Abholung. Y-Dude wickelt weder Zahlung
 * noch Versand ab. Die Seite zeigt Status, Abholcode, Verlauf und die jeweils
 * erlaubten Aktionen; alle Statuswechsel laufen über Server-Functions.
 */

import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

import { useLang } from "@/lib/lang-context";
import { formatMarketPrice } from "@/lib/i18n-market";
import { marketTxTexts } from "@/lib/i18n-market-tx";
import type { getTransaction } from "@/lib/market-tx.server";
import {
  cancelMarketTransaction,
  confirmMarketPickup,
  getMarketTransaction,
  openMarketDispute,
} from "@/lib/market-tx.functions";

export const Route = createFileRoute("/_authenticated/market/tx/$txId")({
  head: () => ({
    meta: [
      { title: "Vorgang — Y-Dude Market" },
      { name: "description", content: "Status und Übergabe einer Market-Abholung." },
      { property: "og:title", content: "Vorgang — Y-Dude Market" },
      { property: "og:description", content: "Abholung bei Y-Dude Market." },
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
  const pickup = useServerFn(confirmMarketPickup);
  const cancel = useServerFn(cancelMarketTransaction);
  const dispute = useServerFn(openMarketDispute);

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
  const open = tx.status !== "completed" && tx.status !== "cancelled";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <BackButton
        onClick={() => navigate({ to: "/market/orders" })}
        label={t.backToOrders}
        className="mb-4"
      />

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
        <p className="mt-2 text-xs text-muted-foreground">{t.settlementPrivateHint}</p>
      </div>

      {/* Abholcode */}
      {data.pickupCode && (
        <div className="mt-3 rounded-2xl border border-brand/40 bg-brand/10 p-4">
          <p className="text-xs text-muted-foreground">{t.pickupCode}</p>
          <p className="text-2xl font-bold tracking-[0.3em] text-brand">{data.pickupCode}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.pickupCodeHint}</p>
        </div>
      )}

      {/* Verkäufer: Übergabe bestätigen */}
      {!isBuyer && tx.fulfillmentType === "pickup" && open && (
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

      {/* Storno und Problemmeldung */}
      {open && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => cancel({ data: { transactionId: txId, reason: null } }))}
            className="rounded-full border border-border/60 px-4 py-2 text-sm"
          >
            {t.cancel}
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
