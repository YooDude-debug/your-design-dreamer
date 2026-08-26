/**
 * Y-Dude Market – Phase 5: Kaufabwicklung (serverseitig).
 *
 * Grundsätze:
 * - Statuswechsel passieren ausschließlich hier bzw. in Datenbankfunktionen.
 * - Preise sind Snapshots: eine bestehende Transaktion ändert sich nie,
 *   wenn der Verkäufer den Artikel später bearbeitet.
 * - Vom Zahlungsanbieter werden nur Referenzen gespeichert (Sitzung,
 *   Zahlungs-ID, Ereignis-ID) – niemals Zahlungsmitteldaten.
 * - Jede Zustandsänderung landet unveränderlich im Ereignisprotokoll.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type DB = SupabaseClient<Database>;
type AdminDB = SupabaseClient<Database>;

export type TxStatus = Database["public"]["Enums"]["market_transaction_status"];
export type PaymentStatus = Database["public"]["Enums"]["market_payment_status"];
export type ShippingStatus = Database["public"]["Enums"]["market_shipping_status"];
export type FulfillmentType = Database["public"]["Enums"]["market_fulfillment_type"];

export type MarketTransaction = {
  id: string;
  reference: string;
  itemId: string;
  itemTitle: string;
  coverPath: string | null;
  offerId: string | null;
  sellerId: string;
  buyerId: string;
  quantity: number;
  currency: string;
  itemPriceCents: number;
  shippingPriceCents: number;
  platformFeeCents: number;
  paymentFeeCents: number;
  sellerAmountCents: number;
  totalCents: number;
  fulfillmentType: FulfillmentType;
  status: TxStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  createdAt: number;
  updatedAt: number;
  paidAt: number | null;
  completedAt: number | null;
};

export type TxEvent = {
  id: string;
  type: string;
  actorId: string | null;
  createdAt: number;
  meta: Record<string, string | number | boolean | null>;
};

export type TxShipping = {
  method: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  costCents: number;
  shippedAt: number | null;
  deliveredAt: number | null;
};

export type TxRefund = {
  id: string;
  amountCents: number;
  reason: string | null;
  status: Database["public"]["Enums"]["market_refund_status"];
  createdAt: number;
};

export type TxDispute = {
  id: string;
  reasonCode: string;
  details: string | null;
  status: Database["public"]["Enums"]["market_dispute_status"];
  createdAt: number;
};

const TX_COLUMNS =
  "id,reference,item_id,offer_id,seller_id,buyer_id,quantity,currency,item_price_cents,shipping_price_cents,platform_fee_cents,payment_fee_cents,seller_amount_cents,total_cents,fulfillment_type,status,payment_status,shipping_status,paid_at,completed_at,created_at,updated_at";

type TxRow = Database["public"]["Tables"]["market_transactions"]["Row"];

function mapTx(r: TxRow, title: string, cover: string | null): MarketTransaction {
  return {
    id: r.id,
    reference: r.reference,
    itemId: r.item_id,
    itemTitle: title,
    coverPath: cover,
    offerId: r.offer_id,
    sellerId: r.seller_id,
    buyerId: r.buyer_id,
    quantity: r.quantity,
    currency: r.currency,
    itemPriceCents: r.item_price_cents,
    shippingPriceCents: r.shipping_price_cents,
    platformFeeCents: r.platform_fee_cents,
    paymentFeeCents: r.payment_fee_cents,
    sellerAmountCents: r.seller_amount_cents,
    totalCents: r.total_cents,
    fulfillmentType: r.fulfillment_type,
    status: r.status,
    paymentStatus: r.payment_status,
    shippingStatus: r.shipping_status,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
    paidAt: r.paid_at ? new Date(r.paid_at).getTime() : null,
    completedAt: r.completed_at ? new Date(r.completed_at).getTime() : null,
  };
}

async function itemMeta(db: DB, itemIds: string[]) {
  const ids = Array.from(new Set(itemIds)).filter(Boolean);
  const titles = new Map<string, string>();
  const covers = new Map<string, string>();
  if (ids.length === 0) return { titles, covers };
  const { data: items } = await db.from("market_items").select("id,title").in("id", ids);
  for (const i of items ?? []) titles.set(i.id, i.title);
  const { data: imgs } = await db
    .from("market_images")
    .select("item_id,path,sort_order,is_primary")
    .in("item_id", ids)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  for (const i of imgs ?? []) if (!covers.has(i.item_id)) covers.set(i.item_id, i.path);
  return { titles, covers };
}

async function admin(): Promise<AdminDB> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AdminDB;
}

async function logEvent(
  db: AdminDB,
  transactionId: string,
  eventType: string,
  actorId: string | null,
  meta: Record<string, unknown> = {},
) {
  await db.from("market_transaction_events").insert({
    transaction_id: transactionId,
    event_type: eventType,
    actor_id: actorId,
    meta: meta as never,
  });
}

/**
 * Gemeinsame Unterhaltung der beiden Beteiligten. Market-Bezug hat Vorrang:
 * gibt es eine Market-Unterhaltung zum Artikel, landet der Systemhinweis dort
 * und nicht im Connection-Chat.
 */
async function sharedConversation(
  db: AdminDB,
  a: string,
  b: string,
  itemId: string | null,
): Promise<string | null> {
  const { data: mine } = await db
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", a);
  const ids = (mine ?? []).map((m) => m.conversation_id);
  if (ids.length === 0) return null;
  const { data: shared } = await db
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", b)
    .in("conversation_id", ids);
  const candidates = (shared ?? []).map((m) => m.conversation_id);
  if (candidates.length === 0) return null;
  if (itemId) {
    const { data: marketConvs } = await db
      .from("conversations")
      .select("id,last_message_at")
      .in("id", candidates)
      .eq("kind", "market")
      .eq("title", itemId)
      .order("last_message_at", { ascending: false })
      .limit(1);
    if (marketConvs?.[0]?.id) return marketConvs[0].id;
  }
  const { data: convs } = await db
    .from("conversations")
    .select("id,kind,last_message_at")
    .in("id", candidates)
    .eq("kind", "direct")
    .order("last_message_at", { ascending: false })
    .limit(1);
  return convs?.[0]?.id ?? null;
}

/** Systemhinweis im bestehenden Messenger (kein separater Transaktionschat). */
async function postTxMessage(db: AdminDB, tx: TxRow, body: string, senderId: string) {
  const conversationId =
    tx.conversation_id ??
    (await sharedConversation(db, tx.buyer_id, tx.seller_id, tx.item_id ?? null));

  if (!conversationId) return;
  if (!tx.conversation_id) {
    await db.from("market_transactions").update({ conversation_id: conversationId }).eq("id", tx.id);
  }
  await db.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    kind: "text",
    body,
    market_item_id: tx.item_id,
    delivered_at: new Date().toISOString(),
  });
}

function money(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} ${currency === "EUR" ? "€" : currency}`;
}

async function loadTxRow(db: AdminDB, txId: string): Promise<TxRow> {
  const { data, error } = await db
    .from("market_transactions")
    .select("*")
    .eq("id", txId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("transaction_not_found");
  return data as TxRow;
}

/* ------------------------------- Kauf starten ------------------------------ */

/**
 * Startet einen Kauf. Die Artikelreservierung und der Preis-Snapshot passieren
 * atomar in der Datenbankfunktion `market_start_transaction` – zwei gleichzeitige
 * Käufer können deshalb nicht dieselbe Ware kaufen.
 */
export async function startTransaction(
  userId: string,
  input: { itemId: string; fulfillment: FulfillmentType; offerId?: string | null },
): Promise<{ transactionId: string }> {
  const db = await admin();
  const { data, error } = await db.rpc("market_start_transaction", {
    _item_id: input.itemId,
    _buyer_id: userId,
    _fulfillment: input.fulfillment,
    ...(input.offerId ? { _offer_id: input.offerId } : {}),
  });
  if (error) throw new Error(error.message);
  const txId = data as unknown as string;
  const tx = await loadTxRow(db, txId);
  await postTxMessage(
    db,
    tx,
    `🛒 Kauf gestartet · ${money(tx.total_cents, tx.currency)} · ${tx.reference}`,
    userId,
  );
  return { transactionId: txId };
}

/* --------------------------------- Lesen ---------------------------------- */

export async function listTransactions(
  db: DB,
  userId: string,
  role: "buyer" | "seller",
  cursor: { createdAt: number; id: string } | null,
  limit: number,
): Promise<{ items: MarketTransaction[]; nextCursor: { createdAt: number; id: string } | null }> {
  let query = db
    .from("market_transactions")
    .select(TX_COLUMNS)
    .eq(role === "buyer" ? "buyer_id" : "seller_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (cursor) query = query.lt("created_at", new Date(cursor.createdAt).toISOString());
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TxRow[];
  const page = rows.slice(0, limit);
  const { titles, covers } = await itemMeta(
    db,
    page.map((r) => r.item_id),
  );
  const items = page.map((r) => mapTx(r, titles.get(r.item_id) ?? "—", covers.get(r.item_id) ?? null));
  const last = page[page.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last ? { createdAt: new Date(last.created_at).getTime(), id: last.id } : null,
  };
}

export async function getTransaction(
  db: DB,
  userId: string,
  txId: string,
): Promise<{
  transaction: MarketTransaction;
  role: "buyer" | "seller" | "admin";
  events: TxEvent[];
  shipping: TxShipping | null;
  refunds: TxRefund[];
  disputes: TxDispute[];
  pickupCode: string | null;
  counterpart: { id: string; username: string; displayName: string } | null;
}> {
  const { data, error } = await db
    .from("market_transactions")
    .select(TX_COLUMNS)
    .eq("id", txId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("transaction_not_found");
  const row = data as TxRow;
  const { titles, covers } = await itemMeta(db, [row.item_id]);
  const transaction = mapTx(row, titles.get(row.item_id) ?? "—", covers.get(row.item_id) ?? null);
  const role: "buyer" | "seller" | "admin" =
    row.buyer_id === userId ? "buyer" : row.seller_id === userId ? "seller" : "admin";

  const [{ data: evs }, { data: ship }, { data: refunds }, { data: disputes }] = await Promise.all([
    db
      .from("market_transaction_events")
      .select("id,event_type,actor_id,meta,created_at")
      .eq("transaction_id", txId)
      .order("created_at", { ascending: true }),
    db
      .from("market_shipping")
      .select("method,carrier,tracking_number,cost_cents,shipped_at,delivered_at")
      .eq("transaction_id", txId)
      .maybeSingle(),
    db
      .from("market_refunds")
      .select("id,amount_cents,reason,status,created_at")
      .eq("transaction_id", txId)
      .order("created_at", { ascending: false }),
    db
      .from("market_disputes")
      .select("id,reason_code,details,status,created_at")
      .eq("transaction_id", txId)
      .order("created_at", { ascending: false }),
  ]);

  let pickupCode: string | null = null;
  if (role === "buyer" && row.fulfillment_type === "pickup" && row.payment_status === "paid") {
    const { data: secret } = await db
      .from("market_transaction_secrets")
      .select("pickup_code,used_at")
      .eq("transaction_id", txId)
      .maybeSingle();
    if (secret && !secret.used_at) pickupCode = secret.pickup_code;
  }

  const otherId = role === "buyer" ? row.seller_id : row.buyer_id;
  const { data: profile } = await db
    .from("profiles")
    .select("id,username,display_name")
    .eq("id", otherId)
    .maybeSingle();

  return {
    transaction,
    role,
    events: (evs ?? []).map((e) => ({
      id: e.id,
      type: e.event_type,
      actorId: e.actor_id,
      createdAt: new Date(e.created_at).getTime(),
      meta: (e.meta ?? {}) as Record<string, string | number | boolean | null>,
    })),
    shipping: ship
      ? {
          method: ship.method,
          carrier: ship.carrier,
          trackingNumber: ship.tracking_number,
          costCents: ship.cost_cents,
          shippedAt: ship.shipped_at ? new Date(ship.shipped_at).getTime() : null,
          deliveredAt: ship.delivered_at ? new Date(ship.delivered_at).getTime() : null,
        }
      : null,
    refunds: (refunds ?? []).map((r) => ({
      id: r.id,
      amountCents: r.amount_cents,
      reason: r.reason,
      status: r.status,
      createdAt: new Date(r.created_at).getTime(),
    })),
    disputes: (disputes ?? []).map((d) => ({
      id: d.id,
      reasonCode: d.reason_code,
      details: d.details,
      status: d.status,
      createdAt: new Date(d.created_at).getTime(),
    })),
    pickupCode,
    counterpart: profile
      ? { id: profile.id, username: profile.username, displayName: profile.display_name ?? profile.username }
      : null,
  };
}

/* -------------------------------- Bezahlung -------------------------------- */

/** Erzeugt eine Zahlungssitzung beim Anbieter (Betrag = Snapshot der Transaktion). */
export async function createCheckoutSession(
  userId: string,
  input: { transactionId: string; environment: "sandbox" | "live"; returnUrl: string },
): Promise<{ clientSecret: string }> {
  const db = await admin();
  const tx = await loadTxRow(db, input.transactionId);
  if (tx.buyer_id !== userId) throw new Error("not_buyer");
  if (tx.payment_status === "paid") throw new Error("already_paid");
  if (tx.status === "cancelled" || tx.status === "refunded") throw new Error("transaction_closed");

  const { createStripeClient, getStripeErrorMessage } = await import("./stripe.server");
  const { data: item } = await db.from("market_items").select("title").eq("id", tx.item_id).maybeSingle();

  try {
    const stripe = createStripeClient(input.environment);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: input.returnUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: tx.currency.toLowerCase(),
            unit_amount: tx.total_cents,
            product_data: { name: item?.title ?? `Y-Dude Market ${tx.reference}` },
          },
        },
      ],
      payment_intent_data: { description: `${item?.title ?? "Market"} (${tx.reference})` },
      metadata: { transactionId: tx.id, reference: tx.reference, userId },
    });

    await db.from("market_payment_records").insert({
      transaction_id: tx.id,
      provider: "stripe",
      environment: input.environment,
      provider_session_id: session.id,
      amount_cents: tx.total_cents,
      currency: tx.currency,
      status: "created",
    });

    if (tx.status === "pending") {
      await db
        .from("market_transactions")
        .update({ status: "payment_pending", payment_status: "pending" })
        .eq("id", tx.id)
        .eq("status", "pending");
      await logEvent(db, tx.id, "payment_started", userId, { session: session.id });
    }

    return { clientSecret: session.client_secret ?? "" };
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

/**
 * Zahlung bestätigen – ausschließlich aus dem verifizierten Webhook heraus.
 * Idempotent: eine doppelt zugestellte Anbieter-Nachricht ändert nichts.
 */
export async function confirmPaymentFromWebhook(input: {
  eventId: string;
  eventType: string;
  sessionId: string | null;
  paymentIntentId: string | null;
  transactionId: string | null;
  environment: "sandbox" | "live";
  amountCents: number | null;
}): Promise<{ handled: boolean }> {
  const db = await admin();

  const { error: dupError } = await db.from("market_payment_webhook_events").insert({
    provider: "stripe",
    event_id: input.eventId,
    event_type: input.eventType,
    transaction_id: input.transactionId,
  });
  if (dupError) return { handled: false }; // bereits verarbeitet (unique constraint)

  let txId = input.transactionId;
  if (!txId && input.sessionId) {
    const { data } = await db
      .from("market_payment_records")
      .select("transaction_id")
      .eq("provider_session_id", input.sessionId)
      .maybeSingle();
    txId = data?.transaction_id ?? null;
  }
  if (!txId) return { handled: false };

  const tx = await loadTxRow(db, txId);

  await db
    .from("market_payment_records")
    .update({
      status: input.eventType,
      provider_payment_intent_id: input.paymentIntentId,
      amount_cents: input.amountCents ?? tx.total_cents,
    })
    .eq("transaction_id", txId);

  const failed = input.eventType.includes("failed");
  if (failed) {
    await db.from("market_transactions").update({ payment_status: "failed" }).eq("id", txId);
    await logEvent(db, txId, "payment_failed", null, { event: input.eventId });
    return { handled: true };
  }

  if (tx.payment_status === "paid") return { handled: true };

  const { error } = await db
    .from("market_transactions")
    .update({
      payment_status: "paid",
      status: tx.fulfillment_type === "pickup" ? "ready_for_pickup" : "processing",
      shipping_status: tx.fulfillment_type === "shipping" ? "awaiting_shipment" : "not_required",
      paid_at: new Date().toISOString(),
    })
    .eq("id", txId)
    .neq("payment_status", "paid");
  if (error) throw new Error(error.message);

  await logEvent(db, txId, "payment_confirmed", null, { event: input.eventId });
  await logEvent(db, txId, "seller_notified", null, {});
  await db.from("market_items").update({ status: "sold" }).eq("id", tx.item_id);
  await postTxMessage(db, tx, `🟢 Zahlung bestätigt · ${tx.reference}`, tx.buyer_id);
  await db.rpc("push_notify", {
    p_user: tx.seller_id,
    p_actor: tx.buyer_id,
    p_type: "market_transaction_paid",
    p_title: "Zahlung eingegangen",
    p_body: money(tx.total_cents, tx.currency),
    p_entity_type: "market_transaction",
    p_entity_id: tx.id,
    p_link: `/market/tx/${tx.id}`,
  });
  return { handled: true };
}

/* -------------------------------- Erfüllung -------------------------------- */

export async function markShipped(
  userId: string,
  input: { transactionId: string; carrier?: string | null; trackingNumber?: string | null; method?: string | null },
) {
  const db = await admin();
  const tx = await loadTxRow(db, input.transactionId);
  if (tx.seller_id !== userId) throw new Error("not_seller");
  if (tx.fulfillment_type !== "shipping") throw new Error("not_shipping");
  if (tx.payment_status !== "paid") throw new Error("not_paid");

  await db.from("market_shipping").upsert(
    {
      transaction_id: tx.id,
      method: input.method ?? null,
      carrier: input.carrier ?? null,
      tracking_number: input.trackingNumber ?? null,
      cost_cents: tx.shipping_price_cents,
      shipped_at: new Date().toISOString(),
    },
    { onConflict: "transaction_id" },
  );
  await db
    .from("market_transactions")
    .update({ status: "shipped", shipping_status: "shipped" })
    .eq("id", tx.id)
    .eq("payment_status", "paid");
  await logEvent(db, tx.id, "shipped", userId, { carrier: input.carrier ?? null });
  await postTxMessage(db, tx, `📦 Versendet · ${tx.reference}`, userId);
  return { ok: true };
}

export async function confirmDelivery(userId: string, transactionId: string) {
  const db = await admin();
  const tx = await loadTxRow(db, transactionId);
  if (tx.buyer_id !== userId) throw new Error("not_buyer");
  if (tx.payment_status !== "paid") throw new Error("not_paid");
  await db.from("market_shipping").update({ delivered_at: new Date().toISOString() }).eq("transaction_id", tx.id);
  await db
    .from("market_transactions")
    .update({
      status: "completed",
      shipping_status: tx.fulfillment_type === "shipping" ? "delivered" : "not_required",
      completed_at: new Date().toISOString(),
    })
    .eq("id", tx.id)
    .neq("status", "completed");
  await logEvent(db, tx.id, "delivered", userId, {});
  await logEvent(db, tx.id, "completed", userId, {});
  return { ok: true };
}

/** Übergabe bei Abholung: der Verkäufer bestätigt den Code des Käufers. */
export async function confirmPickup(userId: string, transactionId: string, code: string) {
  const db = await admin();
  const tx = await loadTxRow(db, transactionId);
  if (tx.seller_id !== userId) throw new Error("not_seller");
  if (tx.fulfillment_type !== "pickup") throw new Error("not_pickup");
  if (tx.payment_status !== "paid") throw new Error("not_paid");

  const { data: secret } = await db
    .from("market_transaction_secrets")
    .select("pickup_code,used_at")
    .eq("transaction_id", tx.id)
    .maybeSingle();
  if (!secret || secret.used_at) throw new Error("code_invalid");
  if (secret.pickup_code !== code.replace(/\s+/g, "")) throw new Error("code_invalid");

  await db
    .from("market_transaction_secrets")
    .update({ used_at: new Date().toISOString() })
    .eq("transaction_id", tx.id)
    .is("used_at", null);
  await db
    .from("market_transactions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", tx.id)
    .neq("status", "completed");
  await logEvent(db, tx.id, "completed", userId, { via: "pickup_code" });
  await postTxMessage(db, tx, `✅ Übergabe bestätigt · ${tx.reference}`, userId);
  return { ok: true };
}

/* ------------------------- Stornierung / Rückerstattung -------------------- */

export async function cancelTransaction(userId: string, transactionId: string, reason: string | null) {
  const db = await admin();
  const tx = await loadTxRow(db, transactionId);
  if (tx.buyer_id !== userId && tx.seller_id !== userId) throw new Error("forbidden");
  if (tx.payment_status === "paid") throw new Error("already_paid_use_refund");
  if (tx.status === "cancelled") return { ok: true };

  await db
    .from("market_transactions")
    .update({
      status: "cancelled",
      payment_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    })
    .eq("id", tx.id)
    .neq("status", "cancelled");
  await db.from("market_items").update({ status: "active" }).eq("id", tx.item_id).eq("status", "reserved");
  await logEvent(db, tx.id, "cancelled", userId, { reason });
  return { ok: true };
}

export async function requestRefund(userId: string, transactionId: string, reason: string | null) {
  const db = await admin();
  const tx = await loadTxRow(db, transactionId);
  if (tx.buyer_id !== userId && tx.seller_id !== userId) throw new Error("forbidden");
  if (tx.payment_status !== "paid") throw new Error("not_paid");

  const { data: open } = await db
    .from("market_refunds")
    .select("id")
    .eq("transaction_id", tx.id)
    .in("status", ["requested", "processing"])
    .maybeSingle();
  if (open) return { ok: true, refundId: open.id };

  const { data, error } = await db
    .from("market_refunds")
    .insert({
      transaction_id: tx.id,
      amount_cents: tx.total_cents,
      reason,
      requested_by: userId,
      status: "requested",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(db, tx.id, "refund_requested", userId, { reason });
  return { ok: true, refundId: data.id };
}

export async function openDispute(
  userId: string,
  transactionId: string,
  reasonCode: string,
  details: string | null,
) {
  const db = await admin();
  const tx = await loadTxRow(db, transactionId);
  if (tx.buyer_id !== userId && tx.seller_id !== userId) throw new Error("forbidden");

  const { data, error } = await db
    .from("market_disputes")
    .insert({ transaction_id: tx.id, opened_by: userId, reason_code: reasonCode, details })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await db.from("market_transactions").update({ status: "disputed" }).eq("id", tx.id);
  await logEvent(db, tx.id, "disputed", userId, { reason: reasonCode });
  return { ok: true, disputeId: data.id };
}

/* ---------------------------------- Admin ---------------------------------- */

async function assertAdmin(db: DB, userId: string) {
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("forbidden");
}

export async function adminListTransactions(
  db: DB,
  userId: string,
  filter: { status: TxStatus | null; limit: number; offset: number },
) {
  await assertAdmin(db, userId);
  const adb = await admin();
  let query = adb
    .from("market_transactions")
    .select(TX_COLUMNS)
    .order("created_at", { ascending: false })
    .range(filter.offset, filter.offset + filter.limit - 1);
  if (filter.status) query = query.eq("status", filter.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TxRow[];
  const { titles, covers } = await itemMeta(adb, rows.map((r) => r.item_id));
  return rows.map((r) => mapTx(r, titles.get(r.item_id) ?? "—", covers.get(r.item_id) ?? null));
}

/** Offene Rückerstattungs- und Konfliktfälle für die Moderation. */
export async function adminOpenCases(db: DB, userId: string) {
  await assertAdmin(db, userId);
  const adb = await admin();
  const [{ data: refunds }, { data: disputes }] = await Promise.all([
    adb
      .from("market_refunds")
      .select("id,transaction_id,amount_cents,reason,status,created_at")
      .in("status", ["requested", "processing"])
      .order("created_at", { ascending: true })
      .limit(50),
    adb
      .from("market_disputes")
      .select("id,transaction_id,reason_code,details,status,created_at")
      .in("status", ["open", "in_review"])
      .order("created_at", { ascending: true })
      .limit(50),
  ]);
  return {
    refunds: (refunds ?? []).map((r) => ({
      id: r.id,
      transactionId: r.transaction_id,
      amountCents: r.amount_cents,
      reason: r.reason,
      status: r.status,
      createdAt: new Date(r.created_at).getTime(),
    })),
    disputes: (disputes ?? []).map((d) => ({
      id: d.id,
      transactionId: d.transaction_id,
      reasonCode: d.reason_code,
      details: d.details,
      status: d.status,
      createdAt: new Date(d.created_at).getTime(),
    })),
  };
}

export async function adminSetRefundStatus(
  db: DB,
  userId: string,
  refundId: string,
  status: Database["public"]["Enums"]["market_refund_status"],
) {
  await assertAdmin(db, userId);
  const adb = await admin();
  const { data: refund, error } = await adb
    .from("market_refunds")
    .update({ status, decided_by: userId })
    .eq("id", refundId)
    .select("transaction_id,amount_cents")
    .single();
  if (error) throw new Error(error.message);
  if (status === "completed") {
    await adb
      .from("market_transactions")
      .update({ status: "refunded", payment_status: "refunded" })
      .eq("id", refund.transaction_id);
    await logEvent(adb, refund.transaction_id, "refund_completed", userId, {
      amount_cents: refund.amount_cents,
    });
  } else {
    await logEvent(adb, refund.transaction_id, `refund_${status}`, userId, {});
  }
  return { ok: true };
}

export async function adminSetDisputeStatus(
  db: DB,
  userId: string,
  disputeId: string,
  status: Database["public"]["Enums"]["market_dispute_status"],
  resolution: string | null,
) {
  await assertAdmin(db, userId);
  const adb = await admin();
  const { data, error } = await adb
    .from("market_disputes")
    .update({ status, resolution, resolved_by: userId })
    .eq("id", disputeId)
    .select("transaction_id")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(adb, data.transaction_id, `dispute_${status}`, userId, {});
  return { ok: true };
}

export async function getFeeSettings(db: DB) {
  const { data, error } = await db
    .from("market_fee_settings")
    .select("platform_fee_bps,platform_fee_fixed_cents,updated_at")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    platformFeeBps: data?.platform_fee_bps ?? 0,
    platformFeeFixedCents: data?.platform_fee_fixed_cents ?? 0,
    updatedAt: data?.updated_at ? new Date(data.updated_at).getTime() : null,
  };
}

export async function adminSetFeeSettings(
  db: DB,
  userId: string,
  input: { platformFeeBps: number; platformFeeFixedCents: number },
) {
  await assertAdmin(db, userId);
  const { error } = await db
    .from("market_fee_settings")
    .update({
      platform_fee_bps: input.platformFeeBps,
      platform_fee_fixed_cents: input.platformFeeFixedCents,
      updated_by: userId,
    })
    .eq("id", true);
  if (error) throw new Error(error.message);
  return { ok: true };
}
