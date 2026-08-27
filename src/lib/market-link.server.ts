/**
 * Y-Dude Market – Verknuepfungen (Phase 2):
 * SlangTags am Artikel, Channel-Verknuepfung, Favoritenliste und das
 * regelbasierte Market-Matching fuer Channel-Beitraege.
 *
 * Es werden ausschliesslich bestehende Strukturen benutzt: `slang_tags`,
 * `channels` samt `search_channels`, `market_favorites`. Nichts wird
 * dupliziert, es entstehen keine Kopien von Market-Artikeln.
 */

import { activePromotion, type DB } from "./market.server";
import type { MarketChatItem } from "./market-chat.server";

import { MAX_ITEM_CHANNELS, MAX_ITEM_SLANG_TAGS } from "./market-shared";

/* ------------------------------- SlangTags ---------------------------------- */

/**
 * SlangTags eines Artikels setzen (nur eigene bzw. nutzbare Tags).
 * Bestehende SlangTag-Technik wird unveraendert weiterverwendet.
 */
export async function setItemSlangTags(
  db: DB,
  userId: string,
  itemId: string,
  tagIds: string[],
): Promise<string[]> {
  const { data: item, error: itemError } = await db
    .from("market_items")
    .select("id,seller_id")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item || item.seller_id !== userId) throw new Error("not_owner");

  const wanted = Array.from(new Set(tagIds)).slice(0, MAX_ITEM_SLANG_TAGS);
  const { data: usable } = await db
    .from("slang_tags")
    .select("id")
    .in("id", wanted.length ? wanted : ["00000000-0000-0000-0000-000000000000"]);
  const allowed = (usable ?? []).map((t) => t.id);

  const { error: delError } = await db
    .from("market_item_slang_tags")
    .delete()
    .eq("item_id", itemId);
  if (delError) throw new Error(delError.message);
  if (allowed.length > 0) {
    const { error } = await db
      .from("market_item_slang_tags")
      .insert(allowed.map((id) => ({ item_id: itemId, tag_id: id })));
    if (error) throw new Error(error.message);
  }
  return allowed;
}

export async function itemSlangTagIds(db: DB, itemId: string): Promise<string[]> {
  const { data, error } = await db
    .from("market_item_slang_tags")
    .select("tag_id")
    .eq("item_id", itemId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.tag_id);
}

/* -------------------------------- Channels ---------------------------------- */

export type ChannelSuggestion = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  categoryName: string | null;
};

/**
 * Passende Channels vorschlagen: bestehende Volltextsuche `search_channels`
 * mit den aussagekraeftigsten Woertern aus Titel, Kategorie und Beschreibung.
 */
export async function suggestChannelsForItem(
  db: DB,
  input: { title: string; description: string; categoryName: string },
): Promise<ChannelSuggestion[]> {
  const words = `${input.title} ${input.categoryName} ${input.description}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 6);
  if (words.length === 0) return [];

  const seen = new Map<string, ChannelSuggestion>();
  for (const word of words) {
    const { data } = await db.rpc("search_channels", { _q: word, _limit: 5 });
    for (const c of data ?? []) {
      if (seen.has(c.id)) continue;
      seen.set(c.id, {
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        categoryName: c.category_name ?? null,
      });
    }
    if (seen.size >= 8) break;
  }
  return Array.from(seen.values()).slice(0, 8);
}

/** Artikel mit Channels verknuepfen (max. `MAX_ITEM_CHANNELS`). */
export async function setItemChannels(
  db: DB,
  userId: string,
  itemId: string,
  channelIds: string[],
): Promise<string[]> {
  const { data: item, error: itemError } = await db
    .from("market_items")
    .select("id,seller_id")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item || item.seller_id !== userId) throw new Error("not_owner");

  const wanted = Array.from(new Set(channelIds)).slice(0, MAX_ITEM_CHANNELS);
  const { error: delError } = await db.from("market_item_channels").delete().eq("item_id", itemId);
  if (delError) throw new Error(delError.message);
  if (wanted.length > 0) {
    const { error } = await db
      .from("market_item_channels")
      .insert(wanted.map((id) => ({ item_id: itemId, channel_id: id })));
    if (error) throw new Error(error.message);
  }
  return wanted;
}

export async function itemChannelIds(db: DB, itemId: string): Promise<string[]> {
  const { data, error } = await db
    .from("market_item_channels")
    .select("channel_id")
    .eq("item_id", itemId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.channel_id);
}

/* ------------------------- Artikel in Channel / Match ------------------------ */

import { searchItems } from "./market.server";
import type { MarketItemSummary } from "./market.server";

/** Artikel eines Channels – seitenweise, nur verknuepfte Artikel. */
export async function channelMarketItems(
  db: DB,
  channelId: string,
  limit: number,
  offset: number,
): Promise<{ items: MarketItemSummary[]; hasMore: boolean }> {
  const { data, error } = await db
    .from("market_item_channels")
    .select("item_id,created_at")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const ids = (hasMore ? rows.slice(0, limit) : rows).map((r) => r.item_id);
  if (ids.length === 0) return { items: [], hasMore: false };
  const items = await itemsByIds(db, ids);
  return { items, hasMore };
}

async function itemsByIds(db: DB, ids: string[]): Promise<MarketItemSummary[]> {
  const { data, error } = await db
    .from("market_items")
    .select(
      "id,seller_id,title,price_cents,negotiable,category_id,condition,delivery,status,place,postal_code,lat,lon,created_at,promoted_until,promotion_disabled_at",
    )
    .in("id", ids)
    .in("status", ["active", "reserved", "sold"]);
  if (error) throw new Error(error.message);
  const { data: imgs } = await db
    .from("market_images")
    .select("item_id,path,sort_order,is_primary")
    .in("item_id", ids)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  const cover = new Map<string, { cover: string | null; count: number }>();
  for (const i of imgs ?? []) {
    const e = cover.get(i.item_id) ?? { cover: null, count: 0 };
    if (!e.cover) e.cover = i.path;
    e.count += 1;
    cover.set(i.item_id, e);
  }
  const order = new Map(ids.map((id, i) => [id, i]));
  return (data ?? [])
    .map((row) => ({
      id: row.id,
      title: row.title,
      priceCents: row.price_cents,
      negotiable: row.negotiable,
      categoryId: row.category_id,
      condition: row.condition,
      delivery: row.delivery,
      status: row.status,
      place: row.place,
      postalCode: row.postal_code,
      lat: row.lat,
      lon: row.lon,
      createdAt: new Date(row.created_at).getTime(),
      coverPath: cover.get(row.id)?.cover ?? null,
      imageCount: cover.get(row.id)?.count ?? 0,
      sellerId: row.seller_id,
      promotedUntil: activePromotion(row.promoted_until, row.promotion_disabled_at),
    }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Woerter, die auf eine Kaufabsicht hindeuten (regelbasiert, keine KI). */
const INTENT_WORDS = [
  "suche",
  "gesucht",
  "kaufe",
  "kaufen",
  "brauche",
  "wer hat",
  "looking for",
  "want to buy",
  "searching",
  "ψάχνω",
  "αγοράσω",
  "ζητώ",
];

const STOP_WORDS = new Set([
  "suche",
  "gesucht",
  "kaufe",
  "kaufen",
  "brauche",
  "bis",
  "für",
  "fuer",
  "eine",
  "einen",
  "ein",
  "der",
  "die",
  "das",
  "und",
  "mit",
  "von",
  "zum",
  "zur",
  "looking",
  "for",
  "want",
  "buy",
  "the",
  "and",
  "with",
  "ψάχνω",
  "αγοράσω",
  "ζητώ",
  "για",
  "ένα",
  "μια",
]);

export type MarketMatch = {
  /** true, wenn der Text ueberhaupt nach einer Kaufabsicht aussieht. */
  intent: boolean;
  query: string;
  priceMaxCents: number | null;
  items: MarketItemSummary[];
};

/**
 * Einfaches, regelbasiertes Matching fuer Channel-Beitraege:
 * Kaufabsicht erkennen, Preisobergrenze lesen, bestehende Market-Suche nutzen.
 */
export async function matchMarketItems(db: DB, text: string, limit: number): Promise<MarketMatch> {
  const lower = text.toLowerCase();
  const intent = INTENT_WORDS.some((w) => lower.includes(w));
  if (!intent) return { intent: false, query: "", priceMaxCents: null, items: [] };

  const priceMatch = lower.match(/(?:bis|max|under|έως)\s*(\d{1,6})/);
  const priceMaxCents = priceMatch ? Number(priceMatch[1]) * 100 : null;

  const words = lower
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    .slice(0, 4);
  if (words.length === 0) return { intent: true, query: "", priceMaxCents, items: [] };

  const { items } = await searchItems(db, {
    q: words.join(" "),
    categoryId: null,
    priceMinCents: null,
    priceMaxCents,
    withImageOnly: false,
    sellerId: null,
    limit,
    offset: 0,
  });
  // Nur bei ausreichender Relevanz zeigen: mindestens ein Treffer.
  return { intent: true, query: words.join(" "), priceMaxCents, items };
}

/* -------------------------------- Favoriten ---------------------------------- */

export async function favoriteItems(db: DB, userId: string): Promise<MarketItemSummary[]> {
  const { data, error } = await db
    .from("market_favorites")
    .select("item_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => r.item_id);
  if (ids.length === 0) return [];
  return itemsByIds(db, ids);
}

export type { MarketChatItem };
