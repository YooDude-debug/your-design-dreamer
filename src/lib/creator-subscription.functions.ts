/**
 * Creator-Abo und dauerhafte SlangTag-Bibliothek (Server Functions).
 *
 * Alle Rechte werden serverseitig bzw. in der Datenbank geprüft:
 * - Freischaltung nur über `claim_creator_slang_tag` (SECURITY DEFINER),
 *   das ein aktives Creator-Abo bzw. die Follower-Bindung verlangt.
 * - Der Bibliothekseintrag ist dauerhaft: es existieren bewusst keine
 *   Änderungs- oder Löschrechte, auch nicht für den Creator.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const envSchema = z.enum(["sandbox", "live"]);

export const CREATOR_MIN_PRICE_CENTS = 299;
export const CREATOR_MAX_PRICE_CENTS = 9999;

export type CreatorSubscriptionInfo = {
  creatorId: string;
  priceCents: number | null;
  currency: string;
  priceActive: boolean;
  minPriceCents: number;
  maxPriceCents: number;
  subscribed: boolean;
  status: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
};

/** Preis und eigener Abostatus zu einem Creator. */
export const getCreatorSubscriptionInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ creatorId: z.string().uuid(), environment: envSchema }).parse(data),
  )
  .handler(async ({ data, context }): Promise<CreatorSubscriptionInfo> => {
    const api = await import("./creator-subscription.server");
    const price = await api.getCreatorPrice(data.creatorId);
    const sub =
      data.creatorId === context.userId
        ? null
        : await api.getCreatorSubscription(context.userId, data.creatorId, data.environment);
    return {
      creatorId: data.creatorId,
      priceCents: price?.priceCents ?? null,
      currency: price?.currency ?? "eur",
      priceActive: price?.active ?? false,
      minPriceCents: CREATOR_MIN_PRICE_CENTS,
      maxPriceCents: CREATOR_MAX_PRICE_CENTS,
      subscribed: sub?.active ?? false,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    };
  });

/** Eigenen Abopreis festlegen (Mindestbetrag serverseitig und in der DB). */
export const setCreatorSubscriptionPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        priceCents: z.number().int().min(CREATOR_MIN_PRICE_CENTS).max(CREATOR_MAX_PRICE_CENTS),
        active: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Creator-Abo ist eine Creator-only Funktion: die Unternehmerrolle
    // berechtigt hier ausdrücklich NICHT (Rollentrennung).
    const { requireCreatorRole } = await import("./role-guard.server");
    try {
      await requireCreatorRole(context.supabase, context.userId);
    } catch {
      return { error: "creator_role_required" } as const;
    }
    // Schreibrecht wird zusätzlich über die RLS-Policy `creator_prices_*_own` erzwungen.
    const { error } = await context.supabase.from("creator_subscription_prices").upsert(
      {
        creator_id: context.userId,
        price_cents: data.priceCents,
        active: data.active,
      },
      { onConflict: "creator_id" },
    );
    if (error) return { error: error.message } as const;
    return { ok: true, priceCents: data.priceCents } as const;
  });

/** Zahlungssitzung für ein Creator-Abo. */
export const startCreatorSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        creatorId: z.string().uuid(),
        environment: envSchema,
        returnUrl: z.string().url().max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./creator-subscription.server");
    try {
      return await api.createCreatorSubscriptionCheckout(context.userId, data);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "checkout_failed" } as const;
    }
  });

/** Creator-Abo kündigen bzw. Kündigung zurücknehmen. */
export const setCreatorSubscriptionCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        creatorId: z.string().uuid(),
        environment: envSchema,
        resume: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./creator-subscription.server");
    try {
      return await api.cancelCreatorSubscription(context.userId, data);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "cancel_failed" } as const;
    }
  });

/**
 * SlangTag dauerhaft in die eigene Bibliothek übernehmen.
 * Die Berechtigung entscheidet ausschließlich die Datenbank-Funktion.
 */
export const claimCreatorSlangTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ tagId: z.string().uuid(), environment: envSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: claimed, error } = await context.supabase.rpc("claim_creator_slang_tag", {
      _tag_id: data.tagId,
      _environment: data.environment,
    });
    if (error) return { error: error.message } as const;
    return { ok: claimed === true } as const;
  });

/**
 * Exclusive SlangDrop eines eigenen Creator-SlangTags konfigurieren.
 * Die Schreibrechte erzwingt die RLS-Policy `drops_*_own`; ein fremder
 * `creatorId` ist dadurch nicht setzbar.
 */
export const setCreatorSlangTagDrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        tagId: z.string().uuid(),
        active: z.boolean().default(true),
        maxClaims: z.number().int().positive().max(1_000_000).nullable().default(null),
        endsAt: z.string().datetime().nullable().default(null),
        remove: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.remove) {
      const { error } = await context.supabase
        .from("slang_tag_drops")
        .delete()
        .eq("tag_id", data.tagId)
        .eq("creator_id", context.userId);
      if (error) return { error: error.message } as const;
      return { ok: true } as const;
    }
    const { error } = await context.supabase.from("slang_tag_drops").upsert(
      {
        tag_id: data.tagId,
        creator_id: context.userId,
        active: data.active,
        max_claims: data.maxClaims,
        ends_at: data.endsAt,
      },
      { onConflict: "tag_id" },
    );
    if (error) return { error: error.message } as const;
    return { ok: true } as const;
  });
