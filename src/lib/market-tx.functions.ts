/**
 * Y-Dude Market – Kaufabwicklung (Server Functions).
 *
 * Die Oberfläche ruft ausschließlich diese Datei auf. Rechte werden im Handler
 * geprüft; Zahlungsdaten verlassen niemals den Zahlungsanbieter.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const envSchema = z.enum(["sandbox", "live"]);
const uuid = z.string().uuid();

/** Kauf starten: reserviert den Artikel atomar und friert den Preis ein. */
export const startMarketTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        itemId: uuid,
        fulfillment: z.enum(["pickup", "shipping"]),
        offerId: uuid.nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    try {
      return await api.startTransaction(context.userId, {
        itemId: data.itemId,
        fulfillment: data.fulfillment,
        offerId: data.offerId ?? null,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "start_failed" } as const;
    }
  });

/** Zahlungssitzung für eine bestehende Transaktion. */
export const createMarketCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        transactionId: uuid,
        environment: envSchema,
        returnUrl: z.string().url().max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    try {
      return await api.createCheckoutSession(context.userId, data);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "checkout_failed" } as const;
    }
  });

/** Eine Transaktion mit Verlauf, Versand und Abholcode (rollenabhängig). */
export const getMarketTransaction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ transactionId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    return api.getTransaction(context.supabase, context.userId, data.transactionId);
  });

/** Käufe bzw. Verkäufe seitenweise (Keyset). */
export const listMarketTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        role: z.enum(["buyer", "seller"]),
        cursor: z.object({ createdAt: z.number(), id: uuid }).nullish(),
        limit: z.number().int().min(1).max(40).default(20),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    return api.listTransactions(
      context.supabase,
      context.userId,
      data.role,
      data.cursor ?? null,
      data.limit,
    );
  });

/** Verkäufer meldet den Versand (optional mit Sendungsnummer). */
export const markMarketShipped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        transactionId: uuid,
        carrier: z.string().max(60).nullish(),
        trackingNumber: z.string().max(80).nullish(),
        method: z.string().max(60).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    try {
      return await api.markShipped(context.userId, data);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "ship_failed" } as const;
    }
  });

/** Käufer bestätigt den Erhalt. */
export const confirmMarketDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ transactionId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    try {
      return await api.confirmDelivery(context.userId, data.transactionId);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "confirm_failed" } as const;
    }
  });

/** Verkäufer bestätigt die Abholung mit dem Code des Käufers. */
export const confirmMarketPickup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ transactionId: uuid, code: z.string().min(4).max(12) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    try {
      return await api.confirmPickup(context.userId, data.transactionId, data.code);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "code_invalid" } as const;
    }
  });

/** Storno vor Zahlung (Artikel wird wieder freigegeben). */
export const cancelMarketTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ transactionId: uuid, reason: z.string().max(300).nullish() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    try {
      return await api.cancelTransaction(context.userId, data.transactionId, data.reason ?? null);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "cancel_failed" } as const;
    }
  });

/** Rückerstattung anfragen (Prüfung durch die Moderation). */
export const requestMarketRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ transactionId: uuid, reason: z.string().max(500).nullish() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    try {
      return await api.requestRefund(context.userId, data.transactionId, data.reason ?? null);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "refund_failed" } as const;
    }
  });

/** Konfliktfall melden. */
export const openMarketDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        transactionId: uuid,
        reasonCode: z.enum(["not_received", "not_as_described", "damaged", "other"]),
        details: z.string().max(1000).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    try {
      return await api.openDispute(
        context.userId,
        data.transactionId,
        data.reasonCode,
        data.details ?? null,
      );
    } catch (error) {
      return { error: error instanceof Error ? error.message : "dispute_failed" } as const;
    }
  });

/* ---------------------------------- Admin ---------------------------------- */

export const adminListMarketTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        status: z.string().nullish(),
        limit: z.number().int().min(1).max(100).default(30),
        offset: z.number().int().min(0).default(0),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    return api.adminListTransactions(context.supabase, context.userId, {
      status: (data.status ?? null) as never,
      limit: data.limit,
      offset: data.offset,
    });
  });

export const adminListMarketCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const api = await import("./market-tx.server");
    return api.adminOpenCases(context.supabase, context.userId);
  });

export const adminDecideMarketRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        refundId: uuid,
        status: z.enum(["processing", "completed", "failed"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    return api.adminSetRefundStatus(context.supabase, context.userId, data.refundId, data.status);
  });

export const adminDecideMarketDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        disputeId: uuid,
        status: z.enum(["in_review", "resolved", "rejected"]),
        resolution: z.string().max(1000).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    return api.adminSetDisputeStatus(
      context.supabase,
      context.userId,
      data.disputeId,
      data.status,
      data.resolution ?? null,
    );
  });

export const getMarketFeeSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const api = await import("./market-tx.server");
    return api.getFeeSettings(context.supabase, context.userId);
  });

export const adminSetMarketFeeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        platformFeeBps: z.number().int().min(0).max(2000),
        platformFeeFixedCents: z.number().int().min(0).max(10000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    return api.adminSetFeeSettings(context.supabase, context.userId, data);
  });
