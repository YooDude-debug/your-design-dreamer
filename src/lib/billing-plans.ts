/**
 * Y-Dude – Preis-Katalog (browser- und serverseitig nutzbar).
 *
 * Die Kennungen entsprechen exakt den Preis-Kennungen beim Zahlungsanbieter.
 * Sie sind in Test- und Live-Umgebung identisch und dienen als einzige
 * Wahrheitsquelle für Zuordnung, Stufen und Rechte.
 */

export type BillingTier = "free" | "business" | "business_pro";
export type BillingInterval = "month" | "year";

export type BusinessPlan = {
  priceId: string;
  tier: Exclude<BillingTier, "free">;
  interval: BillingInterval;
  amountCents: number;
  currency: string;
};

/** Business-Abos (Rangfolge = Reihenfolge im Array). */
export const BUSINESS_PLANS: BusinessPlan[] = [
  {
    priceId: "business_monthly",
    tier: "business",
    interval: "month",
    amountCents: 1490,
    currency: "eur",
  },
  {
    priceId: "business_yearly",
    tier: "business",
    interval: "year",
    amountCents: 14900,
    currency: "eur",
  },
  {
    priceId: "business_pro_monthly",
    tier: "business_pro",
    interval: "month",
    amountCents: 3900,
    currency: "eur",
  },
  {
    priceId: "business_pro_yearly",
    tier: "business_pro",
    interval: "year",
    amountCents: 39000,
    currency: "eur",
  },
];

/** Hervorhebungs-Pakete: Paketcode der Datenbank → Preis-Kennung des Anbieters. */
export const PROMOTION_PRICE_IDS: Record<string, string> = {
  featured_3: "promo_featured_3",
  featured_7: "promo_featured_7",
  featured_30: "promo_featured_30",
};

const TIER_RANK: Record<BillingTier, number> = { free: 0, business: 1, business_pro: 2 };

export function planByPriceId(priceId: string | null | undefined): BusinessPlan | null {
  if (!priceId) return null;
  return BUSINESS_PLANS.find((p) => p.priceId === priceId) ?? null;
}

export function tierForPriceId(priceId: string | null | undefined): BillingTier {
  return planByPriceId(priceId)?.tier ?? "free";
}

export function tierRank(tier: BillingTier): number {
  return TIER_RANK[tier];
}

/** Höherwertige Stufe = Upgrade (sofort wirksam), sonst Downgrade (Periodenende). */
export function isUpgrade(currentPriceId: string | null, nextPriceId: string): boolean {
  const current = planByPriceId(currentPriceId);
  const next = planByPriceId(nextPriceId);
  if (!current || !next) return true;
  if (tierRank(next.tier) !== tierRank(current.tier)) {
    return tierRank(next.tier) > tierRank(current.tier);
  }
  // Gleiche Stufe: Wechsel auf das längere Intervall gilt als Upgrade.
  return next.interval === "year" && current.interval === "month";
}

/** Anzeigelimits je Stufe – wird nur dort verwendet, wo Business-Rechte zählen. */
export const TIER_LIMITS: Record<BillingTier, { activeListings: number; featuredSlots: number }> = {
  free: { activeListings: 10, featuredSlots: 0 },
  business: { activeListings: 100, featuredSlots: 3 },
  business_pro: { activeListings: 1000, featuredSlots: 10 },
};

/** Ein Abo gilt nur bei bestätigter, gültiger Zahlung als aktiv. */
export function isSubscriptionActive(sub: {
  status: string;
  currentPeriodEnd: number | null;
}): boolean {
  const future = sub.currentPeriodEnd === null || sub.currentPeriodEnd > Date.now();
  if (["active", "trialing", "past_due"].includes(sub.status)) return future;
  if (sub.status === "canceled")
    return sub.currentPeriodEnd !== null && sub.currentPeriodEnd > Date.now();
  return false;
}
