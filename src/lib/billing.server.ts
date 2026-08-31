/**
 * Y-Dude – Abrechnung (serverseitig).
 *
 * Grundsätze:
 * - Eine Leistung (Hervorhebung, Business-Abo) wird ausschließlich nach einer
 *   signaturgeprüften Zahlungsmeldung freigeschaltet – niemals durch den
 *   Aufruf einer Erfolgsseite.
 * - Jede Verarbeitung ist idempotent: doppelt zugestellte Meldungen ändern
 *   nichts und lösen keine zweite Abbuchung aus.
 * - Vom Anbieter werden nur Referenzen gespeichert, keine Zahlungsmitteldaten.
 * - Die bestehende Market-/Verkäuferlogik bleibt unberührt; Business-Rechte
 *   werden ausschließlich zusätzlich abgefragt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type { Database } from "@/integrations/supabase/types";

import {
  BUSINESS_PLANS,
  PROMOTION_PRICE_IDS,
  isUpgrade,
  isSubscriptionActive,
  planByPriceId,
  tierForPriceId,
  type BillingTier,
} from "./billing-plans";

export type DB = SupabaseClient<Database>;
export type StripeEnv = "sandbox" | "live";

export async function admin(): Promise<DB> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as DB;
}

export async function stripeFor(env: StripeEnv): Promise<Stripe> {
  const { createStripeClient } = await import("./stripe.server");
  return createStripeClient(env);
}

export async function stripeMessage(error: unknown): Promise<string> {
  const { getStripeErrorMessage } = await import("./stripe.server");
  return getStripeErrorMessage(error);
}

/* ------------------------------- Kunden --------------------------------- */

/**
 * Kundenkonto beim Anbieter auflösen oder anlegen. Die Nutzerkennung liegt
 * dabei immer am Kundenobjekt, damit spätere Abfragen zuverlässig funktionieren.
 */
export async function resolveOrCreateCustomer(
  stripe: Stripe,
  options: { email?: string | undefined; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("invalid_user");

  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length && found.data[0]) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      if (customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email ? { email: options.email } : {}),
    metadata: { userId: options.userId },
  });
  return created.id;
}

export async function userEmail(db: DB, userId: string): Promise<string | undefined> {
  try {
    const auth = (
      db as unknown as {
        auth: {
          admin: {
            getUserById: (
              id: string,
            ) => Promise<{ data: { user: { email?: string | null } | null } }>;
          };
        };
      }
    ).auth;
    const { data } = await auth.admin.getUserById(userId);
    return data.user?.email ?? undefined;
  } catch {
    return undefined;
  }
}

async function priceByLookupKey(stripe: Stripe, lookupKey: string): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const price = prices.data[0];
  if (!price) throw new Error("price_not_found");
  return price;
}

/* -------------------------- Hervorhebung bezahlen ------------------------ */

export type PromotionCheckout = { clientSecret: string; promotionId: string };

/**
 * Legt eine Hervorhebung als unbezahlte Vormerkung an und öffnet die
 * Zahlungssitzung. Aktiv wird sie erst über die bestätigte Zahlungsmeldung.
 */
export async function createPromotionCheckout(
  userId: string,
  input: {
    itemId: string;
    planCode: string;
    radiusKm: number | null;
    environment: StripeEnv;
    returnUrl: string;
  },
): Promise<PromotionCheckout> {
  const db = await admin();

  const { data: item, error: itemError } = await db
    .from("market_items")
    .select("id,seller_id,status,title")
    .eq("id", input.itemId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item || item.seller_id !== userId) throw new Error("not_owner");
  if (item.status !== "active") throw new Error("item_not_active");

  const { data: plan, error: planError } = await db
    .from("market_promotion_plans")
    .select("code,promotion_type,duration_days,price_cents,currency")
    .eq("code", input.planCode)
    .eq("active", true)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) throw new Error("unknown_plan");

  const priceId = PROMOTION_PRICE_IDS[plan.code];
  if (!priceId) throw new Error("plan_not_purchasable");

  const { data: promotion, error: insertError } = await db
    .from("market_promotions")
    .insert({
      item_id: input.itemId,
      seller_id: userId,
      plan_code: plan.code,
      promotion_type: plan.promotion_type,
      duration_days: plan.duration_days,
      price_cents: plan.price_cents,
      currency: plan.currency,
      status: "requested",
      radius_km: input.radiusKm,
      payment_status: "unpaid",
      environment: input.environment,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  try {
    const stripe = await stripeFor(input.environment);
    const price = await priceByLookupKey(stripe, priceId);
    const email = await userEmail(db, userId);
    const customerId = await resolveOrCreateCustomer(stripe, { userId, email });

    const productId = typeof price.product === "string" ? price.product : price.product.id;
    const product = await stripe.products.retrieve(productId);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: input.returnUrl,
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      payment_intent_data: { description: `${product.name} · ${item.title}` },
      managed_payments: { enabled: true },
      metadata: {
        kind: "market_promotion",
        promotionId: promotion.id,
        itemId: input.itemId,
        userId,
      },
    } as Stripe.Checkout.SessionCreateParams);

    await db
      .from("market_promotions")
      .update({ provider_session_id: session.id })
      .eq("id", promotion.id);

    return { clientSecret: session.client_secret ?? "", promotionId: promotion.id };
  } catch (error) {
    await db.from("market_promotions").delete().eq("id", promotion.id).eq("status", "requested");
    throw new Error(await stripeMessage(error));
  }
}

/**
 * Hervorhebung nach bestätigter Zahlung aktivieren. Idempotent: ein zweiter
 * Aufruf verändert Laufzeit und Zahlungsdaten nicht.
 */
export async function activatePromotionFromWebhook(input: {
  promotionId: string | null;
  sessionId: string | null;
  paymentIntentId: string | null;
  amountCents: number | null;
  environment: StripeEnv;
  failed: boolean;
}): Promise<{ handled: boolean }> {
  const db = await admin();

  let query = db
    .from("market_promotions")
    .select("id,item_id,duration_days,promotion_type,radius_km,payment_status,currency");
  query = input.promotionId
    ? query.eq("id", input.promotionId)
    : query.eq("provider_session_id", input.sessionId ?? "");
  const { data: promo, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!promo) return { handled: false };

  if (input.failed) {
    await db
      .from("market_promotions")
      .update({ payment_status: "failed", status: "cancelled" })
      .eq("id", promo.id)
      .neq("payment_status", "paid");
    return { handled: true };
  }

  if (promo.payment_status === "paid") return { handled: true };

  const now = new Date();
  const ends = new Date(now.getTime() + promo.duration_days * 86_400_000);

  const { data: updated, error: promoError } = await db
    .from("market_promotions")
    .update({
      status: "active",
      payment_status: "paid",
      paid_at: now.toISOString(),
      paid_amount_cents: input.amountCents,
      provider_payment_intent_id: input.paymentIntentId,
      provider_session_id: input.sessionId,
      starts_at: now.toISOString(),
      ends_at: ends.toISOString(),
      environment: input.environment,
    })
    .eq("id", promo.id)
    .neq("payment_status", "paid")
    .select("id,seller_id")
    .maybeSingle();
  if (promoError) throw new Error(promoError.message);
  if (!updated) return { handled: true }; // parallel bereits verarbeitet

  const { error: itemError } = await db
    .from("market_items")
    .update({
      promoted_until: ends.toISOString(),
      promotion_type: promo.promotion_type,
      promotion_created_at: now.toISOString(),
      promotion_radius_km: promo.radius_km,
      promotion_disabled_at: null,
      promotion_disabled_by: null,
    })
    .eq("id", promo.item_id);
  if (itemError) throw new Error(itemError.message);

  await db.rpc("push_notify", {
    p_user: updated.seller_id,
    p_actor: updated.seller_id,
    p_type: "market_promotion_active",
    p_title: "Hervorhebung aktiv",
    p_body: `Läuft bis ${ends.toLocaleDateString("de-DE")}`,
    p_entity_type: "market_item",
    p_entity_id: promo.item_id,
    p_link: `/market/${promo.item_id}`,
  });

  return { handled: true };
}

/* ------------------------------- Abos ----------------------------------- */

export type SubscriptionView = {
  priceId: string;
  tier: BillingTier;
  status: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  active: boolean;
  pendingPriceId: string | null;
};

type SubRow = {
  price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_subscription_id: string;
  stripe_customer_id: string;
};

async function latestSubscriptionRow(
  db: DB,
  userId: string,
  environment: StripeEnv,
): Promise<SubRow | null> {
  const { data, error } = await db
    .from("subscriptions")
    .select(
      "price_id,status,current_period_end,cancel_at_period_end,stripe_subscription_id,stripe_customer_id",
    )
    .eq("user_id", userId)
    .eq("environment", environment)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubRow | null) ?? null;
}

function toView(row: SubRow, pendingPriceId: string | null): SubscriptionView {
  const currentPeriodEnd = row.current_period_end
    ? new Date(row.current_period_end).getTime()
    : null;
  const active = isSubscriptionActive({ status: row.status, currentPeriodEnd });
  return {
    priceId: row.price_id,
    tier: active ? tierForPriceId(row.price_id) : "free",
    status: row.status,
    currentPeriodEnd,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
    active,
    pendingPriceId,
  };
}

/** Aktueller Abostatus des Nutzers (Quelle: bestätigte Zahlungsmeldungen). */
export async function getSubscription(
  db: DB,
  userId: string,
  environment: StripeEnv,
): Promise<SubscriptionView | null> {
  const row = await latestSubscriptionRow(db, userId, environment);
  if (!row) return null;
  let pending: string | null = null;
  try {
    const stripe = await stripeFor(environment);
    const schedules = await stripe.subscriptionSchedules.list({
      customer: row.stripe_customer_id,
      limit: 5,
    });
    const schedule = schedules.data.find(
      (s) => s.subscription === row.stripe_subscription_id && s.status === "active",
    );
    const lastPhase = schedule?.phases?.[schedule.phases.length - 1];
    const item = lastPhase?.items?.[0];
    if (item && typeof item.price === "string") {
      const price = await stripe.prices.retrieve(item.price);
      const key = price.lookup_key ?? null;
      if (key && key !== row.price_id) pending = key;
    }
  } catch {
    pending = null; // Vorgemerkter Wechsel ist rein informativ.
  }
  return toView(row, pending);
}

/** Serverseitige Rechteprüfung – niemals nur im Browser entscheiden. */
export async function requireBusinessTier(
  db: DB,
  userId: string,
  environment: StripeEnv,
  minimum: Exclude<BillingTier, "free"> = "business",
): Promise<BillingTier> {
  const sub = await getSubscription(db, userId, environment);
  const tier = sub?.active ? sub.tier : "free";
  const rank: Record<BillingTier, number> = { free: 0, business: 1, business_pro: 2 };
  if (rank[tier] < rank[minimum]) throw new Error("subscription_required");
  return tier;
}

/** Zahlungssitzung für ein neues Business-Abo. */
export async function createSubscriptionCheckout(
  userId: string,
  input: { priceId: string; environment: StripeEnv; returnUrl: string },
): Promise<{ clientSecret: string }> {
  if (!planByPriceId(input.priceId)) throw new Error("unknown_plan");
  const db = await admin();

  const existing = await latestSubscriptionRow(db, userId, input.environment);
  if (existing) {
    const view = toView(existing, null);
    if (view.active && !view.cancelAtPeriodEnd) throw new Error("already_subscribed");
  }

  try {
    const stripe = await stripeFor(input.environment);
    const price = await priceByLookupKey(stripe, input.priceId);
    const email = await userEmail(db, userId);
    const customerId = await resolveOrCreateCustomer(stripe, { userId, email });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: input.returnUrl,
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      managed_payments: { enabled: true },
      metadata: { kind: "business_subscription", userId, priceId: input.priceId },
      subscription_data: { metadata: { userId, priceId: input.priceId } },
    } as Stripe.Checkout.SessionCreateParams);

    return { clientSecret: session.client_secret ?? "" };
  } catch (error) {
    throw new Error(await stripeMessage(error));
  }
}

/**
 * Stufenwechsel: Upgrade wirkt sofort (Preisdifferenz wird anteilig
 * abgerechnet), Downgrade erst zum Beginn des nächsten Abrechnungszeitraums.
 */
export async function changeSubscriptionPlan(
  userId: string,
  input: { priceId: string; environment: StripeEnv },
): Promise<{ applied: "immediate" | "period_end" }> {
  const plan = planByPriceId(input.priceId);
  if (!plan) throw new Error("unknown_plan");

  const db = await admin();
  const row = await latestSubscriptionRow(db, userId, input.environment);
  if (!row) throw new Error("no_subscription");
  const view = toView(row, null);
  if (!view.active) throw new Error("no_active_subscription");
  if (view.priceId === input.priceId) throw new Error("same_plan");

  try {
    const stripe = await stripeFor(input.environment);
    const price = await priceByLookupKey(stripe, input.priceId);
    const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    const item = subscription.items.data[0];
    if (!item) throw new Error("no_subscription_item");

    if (isUpgrade(view.priceId, input.priceId)) {
      await stripe.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: price.id, quantity: 1 }],
        proration_behavior: "always_invoice",
        cancel_at_period_end: false,
        metadata: { ...subscription.metadata, userId, priceId: input.priceId },
      });
      return { applied: "immediate" };
    }

    // Downgrade: neue Stufe erst ab der nächsten Periode.
    const schedules = await stripe.subscriptionSchedules.list({
      customer: row.stripe_customer_id,
      limit: 10,
    });
    const existingSchedule = schedules.data.find(
      (s) => s.subscription === subscription.id && s.status === "active",
    );
    const schedule =
      existingSchedule ??
      (await stripe.subscriptionSchedules.create({ from_subscription: subscription.id }));

    const currentPhase = schedule.phases[0];
    if (!currentPhase) throw new Error("schedule_incomplete");

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: currentPhase.items.map((i) => ({
            price: typeof i.price === "string" ? i.price : i.price.id,
            quantity: i.quantity ?? 1,
          })),
          start_date: currentPhase.start_date,
          end_date: currentPhase.end_date,
        },
        {
          items: [{ price: price.id, quantity: 1 }],
          metadata: { userId, priceId: input.priceId },
        },
      ],
    });
    return { applied: "period_end" };
  } catch (error) {
    throw new Error(await stripeMessage(error));
  }
}

/** Kündigung: Zugang bleibt bis zum Ende des bezahlten Zeitraums bestehen. */
export async function cancelSubscriptionAtPeriodEnd(
  userId: string,
  environment: StripeEnv,
  resume = false,
): Promise<{ cancelAtPeriodEnd: boolean }> {
  const db = await admin();
  const row = await latestSubscriptionRow(db, userId, environment);
  if (!row) throw new Error("no_subscription");

  try {
    const stripe = await stripeFor(environment);
    const updated = await stripe.subscriptions.update(row.stripe_subscription_id, {
      cancel_at_period_end: !resume,
    });
    await db
      .from("subscriptions")
      .update({ cancel_at_period_end: !resume })
      .eq("stripe_subscription_id", row.stripe_subscription_id)
      .eq("environment", environment);
    return { cancelAtPeriodEnd: updated.cancel_at_period_end ?? !resume };
  } catch (error) {
    throw new Error(await stripeMessage(error));
  }
}

/** Verwaltungsportal des Anbieters (Zahlungsmittel, Rechnungen, Kündigung). */
export async function createPortalSession(
  userId: string,
  input: { environment: StripeEnv; returnUrl: string },
): Promise<{ url: string }> {
  const db = await admin();
  const row = await latestSubscriptionRow(db, userId, input.environment);
  if (!row?.stripe_customer_id) throw new Error("no_subscription");
  try {
    const stripe = await stripeFor(input.environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: input.returnUrl,
    });
    return { url: portal.url };
  } catch (error) {
    throw new Error(await stripeMessage(error));
  }
}

/* ------------------------ Abo-Meldungen verarbeiten ---------------------- */

type SubscriptionEvent = {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{
      current_period_start?: number;
      current_period_end?: number;
      price?: {
        id?: string;
        lookup_key?: string | null;
        product?: string | { id?: string };
        metadata?: Record<string, string> | null;
      };
    }>;
  };
};

export function isoFromUnix(value: number | undefined | null): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}

/** Abostatus aus der geprüften Meldung übernehmen (idempotent). */
export async function syncSubscriptionFromWebhook(
  subscription: SubscriptionEvent,
  environment: StripeEnv,
  deleted = false,
): Promise<{ handled: boolean }> {
  const db = await admin();
  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key ??
    item?.price?.metadata?.["lovable_external_id"] ??
    item?.price?.id ??
    null;
  const productId =
    typeof item?.price?.product === "string"
      ? item.price.product
      : (item?.price?.product?.id ?? null);
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  let userId = subscription.metadata?.["userId"] ?? null;
  if (!userId) {
    const { data } = await db
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    userId = (data as { user_id?: string } | null)?.user_id ?? null;
  }
  if (!userId || !priceId) return { handled: false };

  const { error } = await db.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      product_id: productId,
      price_id: priceId,
      status: deleted ? "canceled" : subscription.status,
      current_period_start: isoFromUnix(periodStart),
      current_period_end: isoFromUnix(periodEnd),
      cancel_at_period_end: deleted ? false : !!subscription.cancel_at_period_end,
      environment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw new Error(error.message);
  return { handled: true };
}

/** Nur Meldungen mit bekannten Abo-Preisen betreffen Business-Rechte. */
export function isBusinessPriceId(priceId: string | null | undefined): boolean {
  return BUSINESS_PLANS.some((p) => p.priceId === priceId);
}
