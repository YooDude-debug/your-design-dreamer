/**
 * Creator abonnieren – Zahlung im gesicherten Feld des Anbieters.
 *
 * Das Abo wird ausschließlich über die signaturgeprüfte Zahlungsmeldung
 * aktiv, niemals durch das Öffnen dieser Ansicht.
 */

import { useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { CloseButton } from "@/components/ui/nav-buttons";
import { getStripe, getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { startCreatorSubscriptionCheckout } from "@/lib/creator-subscription.functions";

const TXT = {
  de: {
    title: "Creator abonnieren",
    hint: "Monatliches Abo. Übernommene SlangTags bleiben dauerhaft in deiner Bibliothek – auch nach einer Kündigung.",
    notConfigured: "Die Zahlungsfunktion ist für diesen Build nicht konfiguriert.",
    testMode: "Zahlungen laufen in dieser Umgebung im Testmodus.",
    close: "Schließen",
  },
  en: {
    title: "Subscribe to creator",
    hint: "Monthly subscription. Claimed SlangTags stay in your library permanently – even after cancelling.",
    notConfigured: "Payments are not configured for this build.",
    testMode: "Payments run in test mode in this environment.",
    close: "Close",
  },
  el: {
    title: "Συνδρομή στον creator",
    hint: "Μηνιαία συνδρομή. Τα SlangTags που αποκτάς μένουν μόνιμα στη βιβλιοθήκη σου.",
    notConfigured: "Οι πληρωμές δεν έχουν ρυθμιστεί για αυτήν την έκδοση.",
    testMode: "Οι πληρωμές γίνονται σε δοκιμαστική λειτουργία.",
    close: "Κλείσιμο",
  },
} as const;

export function CreatorSubscribeDialog({
  creatorId,
  lang,
  onClose,
}: {
  creatorId: string;
  lang: keyof typeof TXT;
  onClose: () => void;
}) {
  const txt = TXT[lang] ?? TXT.de;
  const start = useServerFn(startCreatorSubscriptionCheckout);
  const configured = paymentsConfigured();

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const result = await start({
      data: {
        creatorId,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/profile`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("no_client_secret");
    return result.clientSecret;
  }, [creatorId, start]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <div
      className="fixed inset-0 z-[10001] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={txt.title}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <h2 className="flex-1 text-sm font-black text-foreground">{txt.title}</h2>
          <CloseButton onClick={onClose} label={txt.close} />
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{txt.hint}</p>

        {!configured ? (
          <p className="py-4 text-sm text-muted-foreground">{txt.notConfigured}</p>
        ) : (
          <>
            {getStripeEnvironment() === "sandbox" && (
              <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {txt.testMode}
              </p>
            )}
            <div className="overflow-hidden rounded-xl border border-border/60">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
