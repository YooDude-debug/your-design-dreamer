/**
 * Y-Dude – Abrechnung (Server Functions).
 *
 * Die Oberfläche ruft ausschließlich diese Datei auf. Rechte werden im
 * Handler geprüft; Freischaltungen passieren nie hier, sondern erst über die
 * signaturgeprüfte Zahlungsmeldung.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const envSchema = z.enum(["sandbox", "live"]);
const priceSchema = z.string().regex(/^[a-z0-9_]{3,60}$/);

/** Zahlungssitzung für die Hervorhebung eines eigenen Artikels. */
export const createPromotionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        itemId: z.string().uuid(),
        planCode: z.string().max(40),
        radiusKm: z.number().int().min(1).max(200).nullish(),
        environment: envSchema,
        returnUrl: z.string().url().max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./billing.server");
    try {
      return await api.createPromotionCheckout(context.userId, {
        itemId: data.itemId,
        planCode: data.planCode,
        radiusKm: data.radiusKm ?? null,
        environment: data.environment,
        returnUrl: data.returnUrl,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "checkout_failed" } as const;
    }
  });

/** Aktueller Abostatus des angemeldeten Nutzers. */
export const getMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ environment: envSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./billing.server");
    try {
      return {
        subscription: await api.getSubscription(context.supabase, context.userId, data.environment),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "load_failed" } as const;
    }
  });

/** Zahlungssitzung für ein neues Business-Abo. */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        priceId: priceSchema,
        environment: envSchema,
        returnUrl: z.string().url().max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./billing.server");
    try {
      return await api.createSubscriptionCheckout(context.userId, data);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "checkout_failed" } as const;
    }
  });

/** Stufenwechsel: Upgrade sofort, Downgrade zum Periodenende. */
export const changeSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ priceId: priceSchema, environment: envSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./billing.server");
    try {
      return await api.changeSubscriptionPlan(context.userId, data);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "change_failed" } as const;
    }
  });

/** Kündigen bzw. Kündigung zurücknehmen – Zugang bleibt bis Periodenende. */
export const setSubscriptionCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ environment: envSchema, resume: z.boolean().default(false) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./billing.server");
    try {
      return await api.cancelSubscriptionAtPeriodEnd(context.userId, data.environment, data.resume);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "cancel_failed" } as const;
    }
  });

/** Verwaltungsportal des Zahlungsanbieters. */
export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ environment: envSchema, returnUrl: z.string().url().max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./billing.server");
    try {
      return await api.createPortalSession(context.userId, data);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "portal_failed" } as const;
    }
  });
