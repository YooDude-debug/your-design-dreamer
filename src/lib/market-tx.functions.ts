/**
 * Y-Dude Market – Abwicklung von Abholvorgängen (Server Functions).
 *
 * Der Market ist bewusst einfach gehalten: Standard ist Abholung, Y-Dude
 * wickelt weder Zahlung noch Versand ab. Rechte werden im Handler geprüft.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

/** Abholung anfragen: reserviert den Artikel atomar und friert den Preis ein. */
export const startMarketTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        itemId: uuid,
        offerId: uuid.nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-tx.server");
    try {
      return await api.startTransaction(context.userId, {
        itemId: data.itemId,
        offerId: data.offerId ?? null,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "start_failed" } as const;
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

/* Versand wickelt Y-Dude nicht ab: Versandart, Kosten, Adresse und Zeitpunkt
   vereinbaren Käufer und Verkäufer direkt. Deshalb gibt es hier keine
   Versand- oder Liefer-Meldungen mehr. */

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

/* Rückerstattungen laufen nicht über Y-Dude: Zahlung findet direkt zwischen
   Käufer und Verkäufer statt. Bestehende Vorgänge bleiben in der Verwaltung
   sichtbar. */

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
