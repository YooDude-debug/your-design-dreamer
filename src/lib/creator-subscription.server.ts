/**
 * Creator-Abo (serverseitig).
 *
 * Grundsätze (identisch zur bestehenden Abrechnung):
 * - Freigeschaltet wird ausschließlich nach signaturgeprüfter Zahlungsmeldung.
 * - Jede Verarbeitung ist idempotent.
 * - Es werden nur Anbieter-Referenzen gespeichert, keine Zahlungsmitteldaten.
 * - Keine zweite Payment-Architektur: Kunde, Stripe-Client, Fehlertexte und
 *   Webhook-Weg stammen aus `billing.server.ts`.
 *
 * Abgrenzung: Das bestehende Business-Abo (`subscriptions`) bleibt vollständig
 * unberührt. Creator-Abos liegen in `creator_subscriptions`.
 */

import type Stripe from "stripe";
import {
  admin,
  isoFromUnix,
  resolveOrCreateCustomer,
  stripeFor,
  stripeMessage,
  userEmail,
  type StripeEnv,
} from "./billing.server";

/** Preisrahmen für Creator-Abos: 2,99 € bis 99,99 € pro Monat. */
export const CREATOR_SUBSCRIPTION_MIN_CENTS = 299;
export const CREATOR_SUBSCRIPTION_MAX_CENTS = 9999;

export type CreatorPrice = { priceCents: number; currency: string; active: boolean } | null;

export type CreatorSubscriptionView = {
  active: boolean;
  status: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
} | null;

export async function getCreatorPrice(creatorId: string): Promise<CreatorPrice> {
  const db = await admin();
  const { data } = await db
    .from("creator_subscription_prices")
    .select("price_cents,currency,active")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (!data) return null;
  return { priceCents: data.price_cents, currency: data.currency, active: data.active };
}

export async function getCreatorSubscription(
  subscriberId: string,
  creatorId: string,
  environment: StripeEnv,
): Promise<CreatorSubscriptionView> {
  const db = await admin();
  const { data } = await db
    .from("creator_subscriptions")
    .select("status,current_period_end,cancel_at_period_end")
    .eq("subscriber_id", subscriberId)
    .eq("creator_id", creatorId)
    .eq("environment", environment)
    .maybeSingle();
  if (!data) return null;
  const end = data.current_period_end ? new Date(data.current_period_end).getTime() : null;
  const active =
    (["active", "trialing", "past_due"].includes(data.status) &&
      (end === null || end > Date.now())) ||
    (data.status === "canceled" && end !== null && end > Date.now());
  return {
    active,
    status: data.status,
    currentPeriodEnd: end,
    cancelAtPeriodEnd: !!data.cancel_at_period_end,
  };
}

/** Zahlungssitzung für ein Creator-Abo (monatlich, Preis des Creators). */
export async function createCreatorSubscriptionCheckout(
  subscriberId: string,
  input: { creatorId: string; environment: StripeEnv; returnUrl: string },
): Promise<{ clientSecret: string }> {
  if (subscriberId === input.creatorId) throw new Error("self_subscription");

  const price = await getCreatorPrice(input.creatorId);
  if (!price || !price.active) throw new Error("creator_price_missing");
  if (price.priceCents < CREATOR_SUBSCRIPTION_MIN_CENTS) throw new Error("price_below_minimum");
  if (price.priceCents > CREATOR_SUBSCRIPTION_MAX_CENTS) throw new Error("price_above_maximum");

  const existing = await getCreatorSubscription(subscriberId, input.creatorId, input.environment);
  if (existing?.active && !existing.cancelAtPeriodEnd) throw new Error("already_subscribed");

  const db = await admin();
  const { data: creator } = await db
    .from("profiles")
    .select("username,display_name")
    .eq("id", input.creatorId)
    .maybeSingle();
  const creatorName =
    (creator as { username?: string | null; display_name?: string | null } | null)?.display_name ||
    (creator as { username?: string | null } | null)?.username ||
    "Creator";

  try {
    const stripe = await stripeFor(input.environment);
    const email = await userEmail(db, subscriberId);
    const customerId = await resolveOrCreateCustomer(stripe, { userId: subscriberId, email });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: input.returnUrl,
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: price.currency,
            unit_amount: price.priceCents,
            recurring: { interval: "month" },
            product_data: { name: `Creator-Abo · ${creatorName}` },
          },
        },
      ],
      managed_payments: { enabled: true },
      metadata: {
        kind: "creator_subscription",
        userId: subscriberId,
        creatorId: input.creatorId,
      },
      subscription_data: {
        metadata: {
          kind: "creator_subscription",
          userId: subscriberId,
          creatorId: input.creatorId,
        },
      },
    } as Stripe.Checkout.SessionCreateParams);

    return { clientSecret: session.client_secret ?? "" };
  } catch (error) {
    throw new Error(await stripeMessage(error));
  }
}

/** Kündigung zum Periodenende – bereits übernommene SlangTags bleiben. */
export async function cancelCreatorSubscription(
  subscriberId: string,
  input: { creatorId: string; environment: StripeEnv; resume?: boolean },
): Promise<{ cancelAtPeriodEnd: boolean }> {
  const db = await admin();
  const { data } = await db
    .from("creator_subscriptions")
    .select("stripe_subscription_id")
    .eq("subscriber_id", subscriberId)
    .eq("creator_id", input.creatorId)
    .eq("environment", input.environment)
    .maybeSingle();
  const subscriptionId = (data as { stripe_subscription_id?: string | null } | null)
    ?.stripe_subscription_id;
  if (!subscriptionId) throw new Error("no_subscription");

  try {
    const stripe = await stripeFor(input.environment);
    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: !input.resume,
    });
    await db
      .from("creator_subscriptions")
      .update({ cancel_at_period_end: !input.resume })
      .eq("stripe_subscription_id", subscriptionId);
    return { cancelAtPeriodEnd: updated.cancel_at_period_end ?? !input.resume };
  } catch (error) {
    throw new Error(await stripeMessage(error));
  }
}

type SubscriptionEvent = {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{
      current_period_end?: number;
      price?: { unit_amount?: number | null; currency?: string | null };
    }>;
  };
};

/** Abostatus aus der geprüften Zahlungsmeldung übernehmen (idempotent). */
export async function syncCreatorSubscriptionFromWebhook(
  subscription: SubscriptionEvent,
  environment: StripeEnv,
  deleted = false,
): Promise<{ handled: boolean }> {
  const db = await admin();
  const subscriberId = subscription.metadata?.["userId"] ?? null;
  const creatorId = subscription.metadata?.["creatorId"] ?? null;
  if (!subscriberId || !creatorId) return { handled: false };

  const item = subscription.items?.data?.[0];
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const { error } = await db.from("creator_subscriptions").upsert(
    {
      subscriber_id: subscriberId,
      creator_id: creatorId,
      status: deleted ? "canceled" : subscription.status,
      price_cents: item?.price?.unit_amount ?? null,
      currency: item?.price?.currency ?? "eur",
      current_period_end: isoFromUnix(periodEnd),
      cancel_at_period_end: deleted ? false : !!subscription.cancel_at_period_end,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      environment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "subscriber_id,creator_id,environment" },
  );
  if (error) throw new Error(error.message);
  return { handled: true };
}
