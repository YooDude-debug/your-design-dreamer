/**
 * Y-Dude Market – Messenger-Anbindung und Preisverhandlung (Phase 2).
 *
 * Grundsatz: Market baut keinen eigenen Chat. Es wird ausschliesslich die
 * bestehende `conversations`/`messages`-Struktur benutzt; Market-Bezug haengt
 * additiv als `market_item_id` bzw. `market_offer_id` an einer Nachricht.
 *
 * Statuswechsel von Angeboten werden zusaetzlich in der Datenbank abgesichert
 * (Trigger `guard_market_offer_update`, Funktion `market_accept_offer`).
 */

import type { DB } from "./market.server";
import type { Database } from "@/integrations/supabase/types";

export type MarketOfferStatus = Database["public"]["Enums"]["market_offer_status"];

export type MarketOffer = {
  id: string;
  itemId: string;
  conversationId: string | null;
  buyerId: string;
  sellerId: string;
  amountCents: number;
  status: MarketOfferStatus;
  createdAt: number;
  updatedAt: number;
};

export type MarketChatItem = {
  id: string;
  title: string;
  priceCents: number;
  status: Database["public"]["Enums"]["market_item_status"];
  place: string | null;
  coverPath: string | null;
  sellerId: string;
};

function mapOffer(r: {
  id: string;
  item_id: string;
  conversation_id: string | null;
  buyer_id: string;
  seller_id: string;
  amount_cents: number;
  status: MarketOfferStatus;
  created_at: string;
  updated_at: string;
}): MarketOffer {
  return {
    id: r.id,
    itemId: r.item_id,
    conversationId: r.conversation_id,
    buyerId: r.buyer_id,
    sellerId: r.seller_id,
    amountCents: r.amount_cents,
    status: r.status,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

const OFFER_COLUMNS =
  "id,item_id,conversation_id,buyer_id,seller_id,amount_cents,status,created_at,updated_at";

/** Kompakter Artikel-Kontext fuer Chatkarten (nur die noetigen Felder). */
export async function chatItems(db: DB, itemIds: string[]): Promise<MarketChatItem[]> {
  const ids = Array.from(new Set(itemIds)).filter(Boolean);
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from("market_items")
    .select("id,title,price_cents,status,place,seller_id")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const { data: imgs } = await db
    .from("market_images")
    .select("item_id,path,sort_order,is_primary")
    .in("item_id", ids)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  const cover = new Map<string, string>();
  for (const i of imgs ?? []) if (!cover.has(i.item_id)) cover.set(i.item_id, i.path);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    priceCents: r.price_cents,
    status: r.status,
    place: r.place,
    coverPath: cover.get(r.id) ?? null,
    sellerId: r.seller_id,
  }));
}

/**
 * Haengt den Artikel-Kontext an eine bestehende Unterhaltung.
 * Existiert bereits eine Kontextnachricht zu genau diesem Artikel in dieser
 * Unterhaltung, passiert nichts (keine Doppelkontexte, keine Zweitchats).
 */
export async function attachItemContext(
  db: DB,
  userId: string,
  conversationId: string,
  itemId: string,
): Promise<{ created: boolean }> {
  const { data: existing, error: exErr } = await db
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("market_item_id", itemId)
    .limit(1)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  if (existing) return { created: false };

  const { error } = await db.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    kind: "market_item",
    body: "",
    market_item_id: itemId,
    delivered_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { created: true };
}

/** Alle Angebote einer Unterhaltung (nur Beteiligte sehen sie – RLS). */
export async function offersForConversation(
  db: DB,
  conversationId: string,
): Promise<MarketOffer[]> {
  const { data, error } = await db
    .from("market_offers")
    .select(OFFER_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapOffer);
}

/** Angebote, die ich abgegeben habe bzw. auf meine Artikel erhalten habe. */
export async function offersForUser(
  db: DB,
  userId: string,
  role: "buyer" | "seller",
): Promise<{ offers: MarketOffer[]; items: MarketChatItem[] }> {
  const { data, error } = await db
    .from("market_offers")
    .select(OFFER_COLUMNS)
    .eq(role === "buyer" ? "buyer_id" : "seller_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const offers = (data ?? []).map(mapOffer);
  const items = await chatItems(
    db,
    offers.map((o) => o.itemId),
  );
  return { offers, items };
}

/**
 * Angebot abgeben. Der Kaeufer ist immer der angemeldete Nutzer; der
 * Verkaeufer wird aus dem Artikel gelesen (nie aus der Anfrage).
 * Ein offenes Angebot pro Artikel und Kaeufer: ein vorhandenes offenes
 * Angebot wird zuvor zurueckgezogen.
 */
export async function createOffer(
  db: DB,
  userId: string,
  input: { itemId: string; conversationId: string; amountCents: number },
): Promise<MarketOffer> {
  const { data: item, error: itemError } = await db
    .from("market_items")
    .select("id,seller_id,status")
    .eq("id", input.itemId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item) throw new Error("item_not_found");
  if (item.seller_id === userId) throw new Error("own_item");
  if (item.status === "sold" || item.status === "deleted" || item.status === "disabled")
    throw new Error("item_closed");

  await db
    .from("market_offers")
    .update({ status: "withdrawn" })
    .eq("item_id", input.itemId)
    .eq("buyer_id", userId)
    .eq("status", "open");

  const { data, error } = await db
    .from("market_offers")
    .insert({
      item_id: input.itemId,
      conversation_id: input.conversationId,
      buyer_id: userId,
      seller_id: item.seller_id,
      amount_cents: input.amountCents,
      status: "open",
    })
    .select(OFFER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  const offer = mapOffer(data);

  const { error: msgError } = await db.from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: userId,
    kind: "market_offer",
    body: "",
    market_item_id: input.itemId,
    market_offer_id: offer.id,
    delivered_at: new Date().toISOString(),
  });
  if (msgError) throw new Error(msgError.message);
  return offer;
}

/**
 * Angebot beantworten. „accept“ laeuft ueber die transaktionale
 * Datenbankfunktion (sperrt den Artikel, lehnt Konkurrenzangebote ab,
 * setzt den Artikel auf „reserviert“). Alle Rechte werden zusaetzlich
 * durch den Trigger geprueft.
 */
export async function respondOffer(
  db: DB,
  offerId: string,
  action: "accept" | "decline" | "withdraw",
): Promise<MarketOffer> {
  if (action === "accept") {
    const { error } = await db.rpc("market_accept_offer", { _offer_id: offerId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db
      .from("market_offers")
      .update({ status: action === "decline" ? "declined" : "withdrawn" })
      .eq("id", offerId);
    if (error) throw new Error(error.message);
  }
  const { data, error } = await db
    .from("market_offers")
    .select(OFFER_COLUMNS)
    .eq("id", offerId)
    .single();
  if (error) throw new Error(error.message);
  return mapOffer(data);
}
