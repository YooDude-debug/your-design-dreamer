/**
 * Y-Dude Market – Produkt-Statistik (Phase 4).
 *
 * Datenschutz zuerst: gespeichert werden nur wenige, fest definierte
 * Ereignisnamen plus Artikel-, Verkäufer- und Kategoriebezug. Es werden
 * **keine** genauen Standorte, keine Nachrichteninhalte und keine
 * vollständigen Suchtexte abgelegt – bei Suchen nur die Anzahl der Treffer
 * und ob überhaupt Filter benutzt wurden.
 */

import type { DB } from "./market.server";

export const MARKET_EVENTS = [
  "market_item_view",
  "market_item_favorite",
  "market_contact_seller",
  "market_offer_created",
  "market_offer_accepted",
  "market_search",
  "market_item_promoted",
  "market_channel_click",
  "market_slangtag_play",
] as const;

export type MarketEvent = (typeof MARKET_EVENTS)[number];

export type MarketEventInput = {
  event: MarketEvent;
  itemId?: string | null;
  /** Nur wenige, unkritische Kennzahlen (z. B. Trefferzahl). */
  meta?: Record<string, number | boolean | string> | null;
};

/** Erlaubte Meta-Schlüssel – alles andere wird verworfen. */
const META_KEYS = new Set(["resultCount", "hasFilters", "source", "position", "promoted"]);

function safeMeta(meta: MarketEventInput["meta"]): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  for (const [key, value] of Object.entries(meta ?? {})) {
    if (!META_KEYS.has(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, 32);
    else out[key] = value;
  }
  return out;
}

/**
 * Ereignis speichern. Fehler werden bewusst geschluckt: Statistik darf eine
 * Nutzeraktion niemals blockieren.
 */
export async function trackMarketEvent(
  db: DB,
  actorId: string,
  input: MarketEventInput,
): Promise<void> {
  let sellerId: string | null = null;
  let categoryId: string | null = null;
  if (input.itemId) {
    const { data } = await db
      .from("market_items")
      .select("seller_id,category_id")
      .eq("id", input.itemId)
      .maybeSingle();
    sellerId = data?.seller_id ?? null;
    categoryId = data?.category_id ?? null;
  }

  await db.from("market_analytics_events").insert({
    event: input.event,
    item_id: input.itemId ?? null,
    seller_id: sellerId,
    actor_id: actorId,
    category_id: categoryId,
    meta: safeMeta(input.meta),
  });
}

export type MarketEventCount = { event: string; count: number };

/** Aggregierte Ereignisse der letzten Tage (Moderations-Dashboard). */
export async function marketEventTotals(db: DB, days: number): Promise<MarketEventCount[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await db
    .from("market_analytics_events")
    .select("event")
    .gte("created_at", since)
    .limit(5000);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.event, (counts.get(row.event) ?? 0) + 1);
  return [...counts.entries()]
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count);
}
