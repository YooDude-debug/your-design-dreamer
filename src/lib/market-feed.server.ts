/**
 * Market-Feed: „Was wurde neu eingestellt, das für MICH interessant sein könnte?“
 *
 * Grundlage sind ausschließlich vorhandene Daten und Funktionen:
 * - `market_searches` (bestehende Funktion „Suche speichern“) – keine zweite
 *   Speicherung von Suchinteressen,
 * - die bestehende Market-Suche `searchMarket()` – keine zweite Suchmaschine,
 * - die bestehende Follow-Beziehung (`follows`) des eingeloggten Nutzers,
 * - bestehende Artikel-Metadaten (Kategorie, Preis, Standort, Datum, …).
 *
 * Die Signale werden in `market-feed-relevance.ts` kombiniert. Ein Angebot
 * erscheint trotz mehrerer Treffergründe genau einmal. Es werden nur Daten
 * gelesen, die der Nutzer laut bestehender RLS ohnehin sehen darf.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import {
  listSavedSearches,
  recentItemsBySellers,
  searchMarket,
  type RankedMarketItem,
} from "./market-search.server";
import {
  emptyMarketFeedSignals,
  marketFeedReasons,
  scoreMarketFeedItem,
  type MarketFeedReason,
  type MarketFeedSignals,
} from "./market-feed-relevance";

type DB = SupabaseClient<Database>;

export type MarketFeedItem = RankedMarketItem & {
  /** IDs der gespeicherten Suchen, die diesen Artikel getroffen haben. */
  matchedSearchIds: string[];
  matchedLabels: string[];
  /** Einzelsignale – nachvollziehbare Grundlage für spätere Rankings. */
  signals: MarketFeedSignals;
  /** Kombinierter Relevanzwert aus allen Signalen. */
  relevance: number;
  reasons: MarketFeedReason[];
};

export type MarketFeedResult = {
  items: MarketFeedItem[];
  searches: { id: string; label: string }[];
};

/** Höchstens so viele gespeicherte Suchen werden je Aufruf ausgewertet. */
const MARKET_FEED_SEARCHES = 8;
/** Höchstens so viele Angebote gefolgter Verkäufer werden geprüft. */
const FOLLOWED_ITEMS = 30;

async function followedSellerIds(db: DB, userId: string): Promise<string[]> {
  const { data } = await db
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .limit(200);
  return (data ?? []).map((r) => r.following_id);
}

/** Öffentlich sichtbares Verkäufermerkmal; private Verkäuferdaten bleiben außen vor. */
async function verifiedSellers(db: DB, sellerIds: string[]): Promise<Set<string>> {
  if (sellerIds.length === 0) return new Set();
  const { data } = await db
    .from("profiles")
    .select("id,verified")
    .in("id", sellerIds.slice(0, 100));
  return new Set((data ?? []).filter((p) => p.verified).map((p) => p.id));
}

export async function marketFeed(db: DB, userId: string, limit = 30): Promise<MarketFeedResult> {
  const [saved, following] = await Promise.all([
    listSavedSearches(db, userId).then((rows) => rows.slice(0, MARKET_FEED_SEARCHES)),
    followedSellerIds(db, userId),
  ]);
  if (saved.length === 0 && following.length === 0) return { items: [], searches: [] };

  const [searchResults, followedItems] = await Promise.all([
    Promise.all(
      saved.map((s) =>
        searchMarket(db, {
          q: s.query?.q ?? "",
          categoryId: s.query?.categoryId ?? null,
          priceMinCents: s.query?.priceMinCents ?? null,
          priceMaxCents: s.query?.priceMaxCents ?? null,
          withImageOnly: false,
          lat: s.query?.lat ?? null,
          lon: s.query?.lon ?? null,
          radiusKm: s.query?.radiusKm ?? null,
          limit: 20,
          offset: 0,
        }).catch(() => null),
      ),
    ),
    recentItemsBySellers(db, following, FOLLOWED_ITEMS).catch(() => [] as RankedMarketItem[]),
  ]);

  const followSet = new Set(following);
  const now = Date.now();
  const byId = new Map<string, MarketFeedItem>();

  const add = (item: RankedMarketItem): MarketFeedItem => {
    const existing = byId.get(item.id);
    if (existing) return existing;
    const created: MarketFeedItem = {
      ...item,
      matchedSearchIds: [],
      matchedLabels: [],
      signals: emptyMarketFeedSignals(),
      relevance: 0,
      reasons: [],
    };
    created.signals.ageHours = Math.max(0, (now - item.createdAt) / 3_600_000);
    created.signals.followedSeller = followSet.has(item.sellerId);
    created.signals.promoted = item.promotedUntil !== null;
    byId.set(item.id, created);
    return created;
  };

  // 1) Treffer der gespeicherten Suchen (stärkstes Interessensignal).
  const interestCategories = new Set<string>();
  for (const s of saved) if (s.query?.categoryId) interestCategories.add(s.query.categoryId);

  searchResults.forEach((res, index) => {
    if (!res) return;
    const search = saved[index];
    const best = Math.max(1, ...res.items.map((i) => i.score));
    for (const item of res.items) {
      if (item.sellerId === userId) continue;
      const entry = add(item);
      if (!entry.matchedSearchIds.includes(search.id)) {
        entry.matchedSearchIds.push(search.id);
        entry.matchedLabels.push(search.label);
        entry.signals.savedSearchMatches += 1;
      }
      const normalized = Math.min(1, item.score / best);
      if (normalized > entry.signals.savedSearchScore) entry.signals.savedSearchScore = normalized;
      if (item.score > entry.score) entry.score = item.score;
      if (item.categoryId) interestCategories.add(item.categoryId);
    }
  });

  // 2) Neue Angebote gefolgter Verkäufer – eigenes soziales Signal, kein Suchtreffer.
  for (const item of followedItems) {
    if (item.sellerId === userId) continue;
    add(item);
  }

  // 3) Verkäufer-Metadaten und Kategorie-Match ergänzen, dann kombiniert bewerten.
  const entries = Array.from(byId.values());
  const verified = await verifiedSellers(
    db,
    Array.from(new Set(entries.map((e) => e.sellerId))),
  ).catch(() => new Set<string>());

  for (const entry of entries) {
    entry.signals.sellerVerified = verified.has(entry.sellerId);
    entry.signals.categoryMatch = entry.categoryId
      ? interestCategories.has(entry.categoryId)
      : false;
    entry.relevance = scoreMarketFeedItem(entry.signals);
    entry.reasons = marketFeedReasons(entry.signals);
  }

  const items = entries
    .sort((a, b) => b.relevance - a.relevance || b.createdAt - a.createdAt)
    .slice(0, limit);

  return { items, searches: saved.map((s) => ({ id: s.id, label: s.label })) };
}
