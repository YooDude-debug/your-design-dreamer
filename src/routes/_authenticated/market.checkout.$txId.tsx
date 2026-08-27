/**
 * Y-Dude Market – Bezahlseite (eingebettete Zahlung).
 *
 * Die Zahlungsdaten werden ausschließlich im gesicherten Feld des Anbieters
 * erfasst; Y-Dude sieht und speichert keine Karten- oder Bankdaten.
 */

import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

import { useLang } from "@/lib/lang-context";
import { formatMarketPrice } from "@/lib/i18n-market";
import { marketTxTexts } from "@/lib/i18n-market-tx";
import { getStripe, getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { createMarketCheckout, getMarketTransaction } from "@/lib/market-tx.functions";
import type { getTransaction } from "@/lib/market-tx.server";

export const Route = createFileRoute("/_authenticated/market/checkout/$txId")({
  head: () => ({
    meta: [
      { title: "Bezahlen — Y-Dude Market" },
      { name: "description", content: "Sichere Bezahlung eines Market-Kaufs bei Y-Dude." },
      { property: "og:title", content: "Bezahlen — Y-Dude Market" },
      { property: "og:description", content: "Kauf sicher abschließen." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => <p className="p-6 text-sm text-muted-foreground">—</p>,
  notFoundComponent: () => <p className="p-6 text-sm text-muted-foreground">—</p>,
  component: CheckoutPage,
});

function CheckoutPage() {
  const { txId } = Route.useParams();
  const { lang } = useLang();
  const t = marketTxTexts[lang];
  const navigate = useNavigate();
  const loadTx = useServerFn(getMarketTransaction);
  const createCheckout = useServerFn(createMarketCheckout);

  const { data, isLoading } = useQuery({
    queryKey: ["market-tx", txId],
    queryFn: () =>
      loadTx({ data: { transactionId: txId } }) as Promise<
        Awaited<ReturnType<typeof getTransaction>>
      >,
  });

  const configured = paymentsConfigured();

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const result = await createCheckout({
      data: {
        transactionId: txId,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/market/tx/${txId}`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("no_client_secret");
    return result.clientSecret;
  }, [createCheckout, txId]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <BackButton
        onClick={() => navigate({ to: "/market/tx/$txId", params: { txId } })}
        label={t.reference}
        className="mb-4"
      />

      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck className="h-5 w-5 text-brand" />
        {t.checkoutTitle}
      </h1>

      {data?.transaction && (
        <p className="mt-1 text-sm text-muted-foreground">
          {data.transaction.itemTitle} ·{" "}
          <span className="font-semibold text-brand">
            {formatMarketPrice(data.transaction.totalCents, lang)}
          </span>
        </p>
      )}

      {configured && getStripeEnvironment() === "sandbox" && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {t.testMode}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-2">
        {!configured ? (
          <p className="p-6 text-sm text-muted-foreground">{t.notConfigured}</p>
        ) : isLoading ? (
          <div className="grid place-items-center p-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </div>
    </div>
  );
}
