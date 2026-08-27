/**
 * Y-Dude Market – serverseitige Datenlogik (Phase 1).
 *
 * Struktur: Kategorie (`market_categories`) → Artikel (`market_items`) →
 * Bilder (`market_images`). Verknüpfungen zu SlangTags und Channels liegen in
 * `market_item_slang_tags` bzw. `market_item_channels` und werden in späteren
 * Phasen bespielt – die Tabellen existieren bereits.
 *
 * Alle Abfragen laufen über den authentifizierten Supabase-Client des
 * Aufrufers, damit die bestehenden RLS-Regeln greifen. Es gibt keine parallele
 * Datenhaltung und keine eigene Nutzerverwaltung: Verkäuferdaten kommen aus
 * `profiles`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MAX_ITEM_CHANNELS, MAX_ITEM_SLANG_TAGS } from "./market-shared";

export type DB = SupabaseClient<Database>;

export type MarketItemStatus = Database["public"]["Enums"]["market_item_status"];
export type MarketItemCondition = Database["public"]["Enums"]["market_item_condition"];
export type MarketDelivery = Database["public"]["Enums"]["market_delivery"];

export type MarketCategory = {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  nameEl: string | null;
  icon: string | null;
  sortOrder: number;
};

export type MarketSeller = {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  verified: boolean;
};

export type MarketItemSummary = {
  id: string;
  title: string;
  priceCents: number;
  negotiable: boolean;
  categoryId: string | null;
  condition: MarketItemCondition;
  delivery: MarketDelivery;
  status: MarketItemStatus;
  place: string | null;
  postalCode: string | null;
  lat: number | null;
  lon: number | null;
  createdAt: number;
  /** Speicherpfad des Titelbildes (Signierung passiert im Browser). */
  coverPath: string | null;
  imageCount: number;
  sellerId: string;
  /** Aktive Hervorhebung (Ende in ms) – null, wenn nicht hervorgehoben. */
  promotedUntil: number | null;
};

export type MarketItemDetail = MarketItemSummary & {
  description: string;
  imagePaths: string[];
  seller: MarketSeller | null;
  favorited: boolean;
  /** SlangTags des Artikels (bestehende SlangTag-Infrastruktur). */
  slangTagIds: string[];
  /** Verknuepfte Channels. */
  channelIds: string[];
  /** Mitgliedschaftsdatum des Verkaeufers ("Y-Dude seit ..."). */
  sellerSince: number | null;
};

export type MarketSearchInput = {
  q: string;
  categoryId: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  withImageOnly: boolean;
  sellerId: string | null;
  limit: number;
  offset: number;
};

const ITEM_COLUMNS =
  "id,seller_id,title,price_cents,negotiable,category_id,condition,delivery,status,place,postal_code,lat,lon,created_at,promoted_until,promotion_type,promotion_disabled_at";

type ItemRow = {
  id: string;
  seller_id: string;
  title: string;
  price_cents: number;
  negotiable: boolean;
  category_id: string | null;
  condition: MarketItemCondition;
  delivery: MarketDelivery;
  status: MarketItemStatus;
  place: string | null;
  postal_code: string | null;
  lat: number | null;
  lon: number | null;
  created_at: string;
  promoted_until: string | null;
  promotion_type: string | null;
  promotion_disabled_at: string | null;
};

/* --------------------------------- Kategorien -------------------------------- */

export async function listCategories(db: DB): Promise<MarketCategory[]> {
  const { data, error } = await db
    .from("market_categories")
    .select("id,slug,name,name_en,name_el,icon,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    nameEn: c.name_en,
    nameEl: c.name_el,
    icon: c.icon,
    sortOrder: c.sort_order,
  }));
}

/* ----------------------------------- Bilder ---------------------------------- */

/** Titelbild und Bildanzahl für eine Menge Artikel – genau eine Abfrage. */
async function imageIndex(db: DB, itemIds: string[]) {
  const map = new Map<string, { cover: string | null; count: number }>();
  if (itemIds.length === 0) return map;
  const { data, error } = await db
    .from("market_images")
    .select("item_id,path,sort_order,is_primary")
    .in("item_id", itemIds)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const entry = map.get(row.item_id) ?? { cover: null, count: 0 };
    if (!entry.cover) entry.cover = row.path;
    entry.count += 1;
    map.set(row.item_id, entry);
  }
  return map;
}

/**
 * Hervorhebung gilt nur, wenn sie laeuft UND nicht von der Moderation
 * abgeschaltet wurde. Die Pruefung liegt bewusst an einer Stelle.
 */
export function activePromotion(
  promotedUntil: string | null,
  disabledAt: string | null,
): number | null {
  if (!promotedUntil || disabledAt) return null;
  const end = new Date(promotedUntil).getTime();
  return Number.isFinite(end) && end > Date.now() ? end : null;
}

function toSummary(row: ItemRow, img: { cover: string | null; count: number } | undefined) {
  return {
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
    coverPath: img?.cover ?? null,
    imageCount: img?.count ?? 0,
    sellerId: row.seller_id,
    promotedUntil: activePromotion(row.promoted_until, row.promotion_disabled_at),
  } satisfies MarketItemSummary;
}

/* ----------------------------------- Suche ----------------------------------- */

/**
 * Artikelsuche: Volltext (`search_tsv`) plus Kategorie-, Preis- und
 * Bildfilter. Seitenweise (Offset), weil Sortierung und Filter frei
 * kombinierbar sind; die Seitengröße bleibt klein.
 */
export async function searchItems(
  db: DB,
  input: MarketSearchInput,
): Promise<{ items: MarketItemSummary[]; hasMore: boolean }> {
  let query = db
    .from("market_items")
    .select(ITEM_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(input.offset, input.offset + input.limit); // +1 Zeile als „gibt es mehr?“

  if (input.sellerId) {
    // Eigene Artikelliste: auch deaktivierte Artikel, nie gelöschte.
    query = query.eq("seller_id", input.sellerId).neq("status", "deleted");
  } else {
    query = query.in("status", ["active", "reserved", "sold"]);
  }
  if (input.categoryId) query = query.eq("category_id", input.categoryId);
  if (input.priceMinCents !== null) query = query.gte("price_cents", input.priceMinCents);
  if (input.priceMaxCents !== null) query = query.lte("price_cents", input.priceMaxCents);

  const term = input.q.trim();
  if (term.length > 0) {
    // Wortanfänge zählen ("fahrr" findet "Fahrrad"), Sonderzeichen entfernen.
    const words = term
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);
    if (words.length > 0) {
      query = query.textSearch("search_tsv", words.map((w) => `${w}:*`).join(" & "), {
        config: "simple",
      });
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ItemRow[];
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;

  const images = await imageIndex(
    db,
    page.map((r) => r.id),
  );
  let items = page.map((r) => toSummary(r, images.get(r.id)));
  if (input.withImageOnly) items = items.filter((i) => i.imageCount > 0);
  return { items, hasMore };
}

/* ---------------------------------- Detail ----------------------------------- */

export async function getItem(
  db: DB,
  itemId: string,
  userId: string,
): Promise<MarketItemDetail | null> {
  const { data, error } = await db
    .from("market_items")
    .select(`${ITEM_COLUMNS},description`)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as ItemRow & { description: string };
  if (row.status === "deleted") return null;

  const [{ data: imgs }, { data: prof }, { data: fav }, { data: tagRows }, { data: chanRows }] =
    await Promise.all([
      db
        .from("market_images")
        .select("path,sort_order,is_primary")
        .eq("item_id", itemId)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
      db
        .from("profiles")
        .select("id,username,display_name,avatar_url,verified,created_at")
        .eq("id", row.seller_id)
        .maybeSingle(),
      db
        .from("market_favorites")
        .select("item_id")
        .eq("item_id", itemId)
        .eq("user_id", userId)
        .maybeSingle(),
      db.from("market_item_slang_tags").select("tag_id").eq("item_id", itemId),
      db.from("market_item_channels").select("channel_id").eq("item_id", itemId),
    ]);

  const imagePaths = (imgs ?? []).map((i) => i.path);
  return {
    ...toSummary(row, { cover: imagePaths[0] ?? null, count: imagePaths.length }),
    description: row.description ?? "",
    imagePaths,
    seller: prof
      ? {
          id: prof.id,
          username: prof.username ?? "",
          displayName: prof.display_name ?? prof.username ?? "",
          avatarPath: prof.avatar_url ?? null,
          verified: !!prof.verified,
        }
      : null,
    favorited: !!fav,
    slangTagIds: (tagRows ?? []).map((r) => r.tag_id),
    channelIds: (chanRows ?? []).map((r) => r.channel_id),
    sellerSince: prof?.created_at ? new Date(prof.created_at).getTime() : null,
  };
}

/* ---------------------------------- Schreiben -------------------------------- */

export type CreateItemInput = {
  title: string;
  description: string;
  priceCents: number;
  negotiable: boolean;
  categoryId: string;
  condition: MarketItemCondition;
  delivery: MarketDelivery;
  place: string | null;
  postalCode: string | null;
  lat: number | null;
  lon: number | null;
  /** Bereits hochgeladene Speicherpfade (Reihenfolge = Anzeigereihenfolge). */
  imagePaths: string[];
  /** SlangTags des Artikels (bestehende Tags des Verkaeufers). */
  slangTagIds?: string[];
  /** Channels, in denen der Artikel als Market-Eintrag erscheinen soll. */
  channelIds?: string[];
};

export async function createItem(db: DB, userId: string, input: CreateItemInput): Promise<string> {
  const { data, error } = await db
    .from("market_items")
    .insert({
      seller_id: userId,
      title: input.title,
      description: input.description,
      price_cents: input.priceCents,
      negotiable: input.negotiable,
      category_id: input.categoryId,
      condition: input.condition,
      delivery: input.delivery,
      place: input.place,
      postal_code: input.postalCode,
      lat: input.lat,
      lon: input.lon,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const itemId = data.id;
  if (input.imagePaths.length > 0) {
    const rows = input.imagePaths.slice(0, 8).map((path, index) => ({
      item_id: itemId,
      path,
      sort_order: index,
      is_primary: index === 0,
    }));
    const { error: imgError } = await db.from("market_images").insert(rows);
    if (imgError) throw new Error(imgError.message);
  }

  const tagIds = (input.slangTagIds ?? []).slice(0, MAX_ITEM_SLANG_TAGS);
  if (tagIds.length > 0) {
    const { error: tagError } = await db
      .from("market_item_slang_tags")
      .insert(tagIds.map((id) => ({ item_id: itemId, tag_id: id })));
    if (tagError) throw new Error(tagError.message);
  }

  const channelIds = Array.from(new Set(input.channelIds ?? [])).slice(0, MAX_ITEM_CHANNELS);
  if (channelIds.length > 0) {
    const { error: chError } = await db
      .from("market_item_channels")
      .insert(channelIds.map((id) => ({ item_id: itemId, channel_id: id })));
    if (chError) throw new Error(chError.message);
  }
  return itemId;
}

/** Status ändern (nur der Verkäufer – zusätzlich durch RLS abgesichert). */
export async function setItemStatus(
  db: DB,
  userId: string,
  itemId: string,
  status: MarketItemStatus,
): Promise<void> {
  const { error } = await db
    .from("market_items")
    .update({ status })
    .eq("id", itemId)
    .eq("seller_id", userId);
  if (error) throw new Error(error.message);
}

/** Merkliste umschalten; liefert den Zustand danach. */
export async function toggleFavorite(db: DB, userId: string, itemId: string): Promise<boolean> {
  const { data } = await db
    .from("market_favorites")
    .select("item_id")
    .eq("item_id", itemId)
    .eq("user_id", userId)
    .maybeSingle();
  if (data) {
    const { error } = await db
      .from("market_favorites")
      .delete()
      .eq("item_id", itemId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await db.from("market_favorites").insert({ item_id: itemId, user_id: userId });
  if (error) throw new Error(error.message);
  return true;
}
