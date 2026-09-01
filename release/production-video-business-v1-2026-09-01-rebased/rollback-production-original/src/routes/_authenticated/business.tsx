/**
 * Y-Dude Business – Abo für gewerbliche Verkäufer.
 *
 * Grundsätze:
 * - Freischaltung ausschließlich nach bestätigter Zahlung (Anbieter-Meldung).
 * - Kündigung wirkt zum Ende des bezahlten Zeitraums, niemals sofort.
 * - Upgrade wirkt sofort (anteilige Abrechnung), Downgrade zum Periodenstart.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { BadgeCheck, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useLang } from "@/lib/lang-context";
import { BusinessCampaignsSection } from "@/components/business/BusinessCampaignsSection";
import type { Lang } from "@/lib/i18n-dict";
import { getStripe, getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { BUSINESS_PLANS, TIER_LIMITS, type BusinessPlan } from "@/lib/billing-plans";
import {
  changeSubscriptionPlan,
  createBillingPortalSession,
  createSubscriptionCheckout,
  getMySubscription,
  setSubscriptionCancellation,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({
    meta: [
      { title: "Y-Dude Business — Verkäufer-Abo" },
      {
        name: "description",
        content:
          "Business-Abo für gewerbliche Verkäufer im Y-Dude Market: mehr Anzeigen, Verkäuferprofil und volle Statistik.",
      },
      { property: "og:title", content: "Y-Dude Business — Verkäufer-Abo" },
      { property: "og:description", content: "Mehr Anzeigen, Verkäuferprofil und Statistik." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BusinessPage,
});

const copy: Record<
  Lang,
  Record<
    | "title"
    | "subtitle"
    | "current"
    | "none"
    | "renews"
    | "endsAt"
    | "cancel"
    | "resume"
    | "portal"
    | "upgradeNow"
    | "downgradeLater"
    | "choose"
    | "month"
    | "year"
    | "pending"
    | "testMode"
    | "notConfigured"
    | "listings"
    | "featured"
    | "immediate"
    | "periodEnd"
    | "failed"
    | "cancelled"
    | "back",
    string
  >
> = {
  de: {
    title: "Y-Dude Business",
    subtitle: "Gewerblich verkaufen: mehr Anzeigen, Verkäuferprofil, volle Statistik.",
    current: "Aktuelles Abo",
    none: "Kein aktives Abo",
    renews: "Verlängert sich am",
    endsAt: "Läuft aus am",
    cancel: "Kündigen",
    resume: "Kündigung zurücknehmen",
    portal: "Rechnungen & Zahlungsmittel",
    upgradeNow: "Upgrade (sofort)",
    downgradeLater: "Downgrade (nächste Periode)",
    choose: "Auswählen",
    month: "pro Monat",
    year: "pro Jahr",
    pending: "Vorgemerkter Wechsel",
    testMode: "Zahlungen in der Vorschau laufen im Testmodus.",
    notConfigured: "Die Zahlungsfunktion ist für diesen Build nicht konfiguriert.",
    listings: "aktive Anzeigen",
    featured: "Hervorhebungs-Plätze",
    immediate: "Upgrade ist sofort aktiv.",
    periodEnd: "Downgrade gilt ab der nächsten Abrechnungsperiode.",
    failed: "Aktion nicht möglich.",
    cancelled: "Kündigung vorgemerkt – Zugang bleibt bis Periodenende.",
    back: "Zurück zur Auswahl",
  },
  en: {
    title: "Y-Dude Business",
    subtitle: "Sell commercially: more listings, seller profile, full statistics.",
    current: "Current plan",
    none: "No active plan",
    renews: "Renews on",
    endsAt: "Ends on",
    cancel: "Cancel",
    resume: "Resume subscription",
    portal: "Invoices & payment methods",
    upgradeNow: "Upgrade (immediate)",
    downgradeLater: "Downgrade (next period)",
    choose: "Select",
    month: "per month",
    year: "per year",
    pending: "Scheduled change",
    testMode: "Payments in the preview run in test mode.",
    notConfigured: "Payments are not configured for this build.",
    listings: "active listings",
    featured: "featured slots",
    immediate: "Upgrade is active immediately.",
    periodEnd: "Downgrade applies from the next billing period.",
    failed: "Action not possible.",
    cancelled: "Cancellation scheduled – access stays until period end.",
    back: "Back to plans",
  },
  el: {
    title: "Y-Dude Business",
    subtitle: "Επαγγελματικές πωλήσεις: περισσότερες αγγελίες, προφίλ, στατιστικά.",
    current: "Τρέχον πακέτο",
    none: "Καμία ενεργή συνδρομή",
    renews: "Ανανεώνεται στις",
    endsAt: "Λήγει στις",
    cancel: "Ακύρωση",
    resume: "Επαναφορά συνδρομής",
    portal: "Τιμολόγια & τρόποι πληρωμής",
    upgradeNow: "Αναβάθμιση (άμεσα)",
    downgradeLater: "Υποβάθμιση (επόμενη περίοδος)",
    choose: "Επιλογή",
    month: "τον μήνα",
    year: "τον χρόνο",
    pending: "Προγραμματισμένη αλλαγή",
    testMode: "Οι πληρωμές στην προεπισκόπηση γίνονται σε δοκιμαστική λειτουργία.",
    notConfigured: "Οι πληρωμές δεν έχουν ρυθμιστεί για αυτήν την έκδοση.",
    listings: "ενεργές αγγελίες",
    featured: "θέσεις προβολής",
    immediate: "Η αναβάθμιση ισχύει άμεσα.",
    periodEnd: "Η υποβάθμιση ισχύει από την επόμενη περίοδο.",
    failed: "Η ενέργεια δεν είναι δυνατή.",
    cancelled: "Η ακύρωση καταχωρήθηκε – πρόσβαση έως το τέλος της περιόδου.",
    back: "Πίσω στα πακέτα",
  },
};

const PLAN_NAMES: Record<string, string> = {
  business: "Business",
  business_pro: "Business Pro",
};

function money(amountCents: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : lang === "el" ? "el-GR" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function BusinessPage() {
  const { lang } = useLang();
  const c = copy[lang];
  const environment = paymentsConfigured() ? getStripeEnvironment() : null;
  const queryClient = useQueryClient();

  const loadSubscription = useServerFn(getMySubscription);
  const startCheckout = useServerFn(createSubscriptionCheckout);
  const changePlan = useServerFn(changeSubscriptionPlan);
  const setCancellation = useServerFn(setSubscriptionCancellation);
  const openPortal = useServerFn(createBillingPortalSession);

  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-subscription", environment],
    enabled: environment !== null,
    queryFn: async () => {
      const result = await loadSubscription({ data: { environment: environment! } });
      if ("error" in result) throw new Error(result.error);
      return result.subscription;
    },
  });

  const subscription = data ?? null;
  const activePriceId = subscription?.active ? subscription.priceId : null;

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    if (!checkoutPriceId || !environment) throw new Error("no_plan");
    const result = await startCheckout({
      data: {
        priceId: checkoutPriceId,
        environment,
        returnUrl: `${window.location.origin}/business`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("no_client_secret");
    return result.clientSecret;
  }, [checkoutPriceId, environment, startCheckout]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  const change = useMutation({
    mutationFn: async (priceId: string) => {
      const result = await changePlan({ data: { priceId, environment: environment! } });
      if ("error" in result) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      toast.success(result.applied === "immediate" ? c.immediate : c.periodEnd);
      void queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
    },
    onError: () => toast.error(c.failed),
  });

  const cancellation = useMutation({
    mutationFn: async (resume: boolean) => {
      const result = await setCancellation({ data: { environment: environment!, resume } });
      if ("error" in result) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      toast.success(result.cancelAtPeriodEnd ? c.cancelled : c.resume);
      void queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
    },
    onError: () => toast.error(c.failed),
  });

  async function portal() {
    if (!environment) return;
    const result = await openPortal({
      data: { environment, returnUrl: `${window.location.origin}/business` },
    });
    if ("error" in result) {
      toast.error(c.failed);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  if (!environment) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="text-lg font-semibold">{c.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{c.notConfigured}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <BadgeCheck className="h-5 w-5 text-brand" />
        {c.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{c.subtitle}</p>

      {environment === "sandbox" && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {c.testMode}
        </p>
      )}

      <section className="mt-4 rounded-2xl border border-border/60 bg-card/60 p-4">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">{c.current}</h2>
        {isLoading ? (
          <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : subscription?.active ? (
          <>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {PLAN_NAMES[subscription.tier] ?? subscription.tier}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {subscription.status}
              </span>
            </p>
            {subscription.currentPeriodEnd && (
              <p className="mt-1 text-xs text-muted-foreground">
                {subscription.cancelAtPeriodEnd ? c.endsAt : c.renews}{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
            {subscription.pendingPriceId && (
              <p className="mt-1 text-xs text-brand">
                {c.pending}: {subscription.pendingPriceId}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => cancellation.mutate(subscription.cancelAtPeriodEnd)}
                disabled={cancellation.isPending}
                className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {subscription.cancelAtPeriodEnd ? c.resume : c.cancel}
              </button>
              <button
                type="button"
                onClick={() => void portal()}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {c.portal}
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{c.none}</p>
        )}
      </section>

      {checkoutPriceId ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-2">
          <EmbeddedCheckoutProvider key={checkoutPriceId} stripe={getStripe()} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
          <button
            type="button"
            onClick={() => setCheckoutPriceId(null)}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"
          >
            {c.back}
          </button>
        </section>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {BUSINESS_PLANS.map((plan: BusinessPlan) => {
            const limits = TIER_LIMITS[plan.tier];
            const isCurrent = activePriceId === plan.priceId;
            return (
              <li key={plan.priceId} className="rounded-2xl border border-border/60 bg-card/60 p-4">
                <p className="text-sm font-semibold text-foreground">{PLAN_NAMES[plan.tier]}</p>
                <p className="mt-1 text-lg font-bold text-brand">
                  {money(plan.amountCents, lang)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {plan.interval === "month" ? c.month : c.year}
                  </span>
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>
                    {limits.activeListings} {c.listings}
                  </li>
                  <li>
                    {limits.featuredSlots} {c.featured}
                  </li>
                </ul>
                <button
                  type="button"
                  disabled={isCurrent || change.isPending}
                  onClick={() => {
                    if (subscription?.active) change.mutate(plan.priceId);
                    else setCheckoutPriceId(plan.priceId);
                  }}
                  className="mt-3 w-full rounded-xl border border-brand/50 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand disabled:opacity-50"
                >
                  {isCurrent ? c.current : subscription?.active ? c.choose : c.choose}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <BusinessCampaignsSection />

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
        {c.immediate} {c.periodEnd}
      </p>
    </div>
  );
}
