/**
 * Hervorhebung kaufen.
 *
 * Ablauf: Paket wählen → Zahlung im gesicherten Feld des Anbieters. Die
 * Hervorhebung startet erst, wenn die Zahlung bestätigt gemeldet wurde –
 * niemals allein durch das Öffnen der Erfolgsseite.
 */

import { CloseButton } from "@/components/ui/nav-buttons";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { listMarketPromotionPlans } from "@/lib/market.functions";
import { createPromotionCheckout } from "@/lib/billing.functions";
import { getStripe, getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { formatMarketPrice, marketTexts } from "@/lib/i18n-market";
import type { Lang } from "@/lib/i18n-dict";

const copy: Record<Lang, { pay: string; hint: string; notConfigured: string; testMode: string }> = {
  de: {
    pay: "Jetzt bezahlen",
    hint: "Die Hervorhebung startet sofort nach bestätigter Zahlung und endet automatisch.",
    notConfigured: "Die Zahlungsfunktion ist für diesen Build nicht konfiguriert.",
    testMode: "Zahlungen in der Vorschau laufen im Testmodus.",
  },
  en: {
    pay: "Pay now",
    hint: "Featuring starts right after the payment is confirmed and ends automatically.",
    notConfigured: "Payments are not configured for this build.",
    testMode: "Payments in the preview run in test mode.",
  },
  el: {
    pay: "Πληρωμή τώρα",
    hint: "Η προβολή ξεκινά μόλις επιβεβαιωθεί η πληρωμή και λήγει αυτόματα.",
    notConfigured: "Οι πληρωμές δεν έχουν ρυθμιστεί για αυτήν την έκδοση.",
    testMode: "Οι πληρωμές στην προεπισκόπηση γίνονται σε δοκιμαστική λειτουργία.",
  },
};

export function PromoteItemDialog({
  itemId,
  lang,
  open,
  onClose,
}: {
  itemId: string;
  lang: Lang;
  open: boolean;
  onClose: () => void;
}) {
  const m = marketTexts[lang];
  const c = copy[lang];
  const loadPlans = useServerFn(listMarketPromotionPlans);
  const startCheckout = useServerFn(createPromotionCheckout);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const configured = paymentsConfigured();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["market-promotion-plans"],
    queryFn: () => loadPlans(),
    enabled: open,
    staleTime: 300_000,
  });

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    if (!planCode) throw new Error("no_plan");
    const result = await startCheckout({
      data: {
        itemId,
        planCode,
        radiusKm: null,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/market/${itemId}`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("no_client_secret");
    return result.clientSecret;
  }, [itemId, planCode, startCheckout]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-semibold text-foreground">{m.promoteHeading}</h2>
          <CloseButton onClick={onClose} label={m.cancel} className="ml-auto" />
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{m.promoteHint}</p>

        {!configured ? (
          <p className="py-4 text-sm text-muted-foreground">{c.notConfigured}</p>
        ) : planCode ? (
          <>
            {getStripeEnvironment() === "sandbox" && (
              <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {c.testMode}
              </p>
            )}
            <div className="overflow-hidden rounded-xl border border-border/60">
              <EmbeddedCheckoutProvider key={planCode} stripe={getStripe()} options={options}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
            <button
              type="button"
              onClick={() => setPlanCode(null)}
              className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"
            >
              {m.cancel}
            </button>
          </>
        ) : isLoading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {m.loading}
          </p>
        ) : (
          <ul className="space-y-2">
            {plans.map((plan) => (
              <li key={plan.code}>
                <button
                  onClick={() => {
                    if (!plan.priceCents) {
                      toast.error(m.promoteFailed);
                      return;
                    }
                    setPlanCode(plan.code);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2 text-left transition-colors hover:border-brand/60"
                >
                  <span className="text-sm font-medium text-foreground">
                    {plan.durationDays} {m.promoteDays}
                  </span>
                  <span className="ml-auto text-sm font-bold text-brand">
                    {formatMarketPrice(plan.priceCents, lang)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
