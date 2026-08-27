/**
 * Y-Dude Market – Suche, Matching und gespeicherte Suchen (Phase 3).
 *
 * Ablauf (bewusst ohne KI):
 *   Text → parseMarketQuery → Postgres-Vorfilter (Volltext, Kategorie, Preis,
 *   Bounding-Box) → Haversine nur für Kandidaten → scoreItem → Ranking.
 *
 * Es entsteht keine zweite Suchmaschine: Channels kommen aus `search_channels`,
 * SlangTags aus `slang_tags`, Artikel aus `market_items`.
 */

import { activePromotion, type DB, type MarketItemSummary } from "./market.server";
import {
  MARKET_LIMITS,
  boundingBox,
  dedupeById,
  describeMarketQuery,
  haversineKm,
  normalizeMarketText,
  parseMarketQuery,
  roughDistanceKm,
  scoreItem,
  type ParsedMarketQuery,
} from "./market-query";

const ITEM_COLUMNS =
  "id,seller_id,title,description,price_cents,negotiable,category_id,condition,delivery,status,place,postal_code,lat,lon,created_at,promoted_until,promotion_type,promotion_disabled_at";

type Row = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price_cents: number;
  negotiable: boolean;
  category_id: string | null;
  condition: MarketItemSummary["condition"];
  delivery: MarketItemSummary["delivery"];
  status: MarketItemSummary["status"];
  place: string | null;
  postal_code: string | null;
  lat: number | null;
  lon: number | null;
  created_at: string;
  promoted_until: string | null;
  promotion_type: string | null;
  promotion_disabled_at: string | null;
};

export type RankedMarketItem = MarketItemSummary & {
  /** Ungefähre Entfernung in km (nur bei bekanntem Standort). */
  distanceKm: number | null;
  score: number;
};

export type MarketSearchRequest = {
  /** Rohtext der Suche (wird serverseitig erneut geparst – nie dem Client vertrauen). */
  q: string;
  categoryId: string | null;
  /** Vom Nutzer bewusst entfernte/geänderte Filter überschreiben den Parser. */
  priceMinCents: number | null;
  priceMaxCents: number | null;
  withImageOnly: boolean;
  /** Standort des Suchenden (optional, gerundet vom Client). */
  lat: number | null;
  lon: number | null;
  radiusKm: number | null;
  limit: number;
  offset: number;
};

export type MarketSearchResult = {
  items: RankedMarketItem[];
  hasMore: boolean;
  /** Serverseitig erkannte Suchparameter – die UI zeigt daraus die Chips. */
  parsed: ParsedMarketQuery;
};

/* ------------------------------- Hilfsmittel --------------------------------- */

async function coverIndex(db: DB, ids: string[]) {
  const map = new Map<string, { cover: string | null; count: number }>();
  if (ids.length === 0) return map;
  const { data } = await db
    .from("market_images")
    .select("item_id,path,sort_order,is_primary")
    .in("item_id", ids)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  for (const row of data ?? []) {
    const entry = map.get(row.item_id) ?? { cover: null, count: 0 };
    if (!entry.cover) entry.cover = row.path;
    entry.count += 1;
    map.set(row.item_id, entry);
  }
  return map;
}

/** Normalisierte SlangTag-Namen je Artikel (zusätzliches Relevanzsignal). */
async function slangTagIndex(db: DB, ids: string[]) {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const { data } = await db
    .from("market_item_slang_tags")
    .select("item_id,tag_id")
    .in("item_id", ids);
  const tagIds = Array.from(new Set((data ?? []).map((r) => r.tag_id)));
  if (tagIds.length === 0) return map;
  const { data: tags } = await db
    .from("slang_tags")
    .select("id,name,normalized_name")
    .in("id", tagIds);
  const names = new Map(
    (tags ?? []).map((t) => [t.id, normalizeMarketText(t.normalized_name ?? t.name ?? "")]),
  );
  for (const row of data ?? []) {
    const name = names.get(row.tag_id);
    if (!name) continue;
    map.set(row.item_id, [...(map.get(row.item_id) ?? []), name]);
  }
  return map;
}

function toRanked(
  row: Row,
  cover: { cover: string | null; count: number } | undefined,
  distanceKm: number | null,
  score: number,
): RankedMarketItem {
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
    coverPath: cover?.cover ?? null,
    imageCount: cover?.count ?? 0,
    sellerId: row.seller_id,
    promotedUntil: activePromotion(row.promoted_until, row.promotion_disabled_at),
    distanceKm,
    score,
  };
}

/** Volltextausdruck aus Suchwörtern (Wortanfänge, ODER-verknüpft). */
function tsQuery(parsed: ParsedMarketQuery): string | null {
  const words = [...parsed.terms, ...parsed.synonyms].slice(0, 8);
  if (words.length === 0) return null;
  return words.map((w) => `${w}:*`).join(" | ");
}

/* ---------------------------------- Suche ------------------------------------ */

/**
 * Strukturierte Market-Suche mit Ranking.
 *
 * Vorfilter laufen in Postgres (GIN-Volltext, Kategorie, Preis, Bounding-Box);
 * Haversine und Score laufen nur über die Kandidatenmenge.
 */
export async function searchMarket(
  db: DB,
  input: MarketSearchRequest,
): Promise<MarketSearchResult> {
  const parsed = parseMarketQuery(input.q);
  const priceMin = input.priceMinCents ?? parsed.priceMinCents;
  const priceMax = input.priceMaxCents ?? parsed.priceMaxCents;
  const radiusKm = input.radiusKm ?? parsed.radiusKm;
  const hasOrigin = input.lat !== null && input.lon !== null;

  let query = db
    .from("market_items")
    .select(ITEM_COLUMNS)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(MARKET_LIMITS.candidates);

  if (input.categoryId) query = query.eq("category_id", input.categoryId);
  if (priceMin !== null) query = query.gte("price_cents", priceMin);
  if (priceMax !== null) query = query.lte("price_cents", priceMax);
  if (parsed.condition) query = query.eq("condition", parsed.condition);
  if (parsed.delivery) query = query.in("delivery", [parsed.delivery, "both"]);
  if (parsed.postalCode) query = query.eq("postal_code", parsed.postalCode);

  // Bounding-Box als Datenbank-Vorfilter – nie Haversine über die ganze Tabelle.
  if (hasOrigin && radiusKm && radiusKm > 0) {
    const box = boundingBox(input.lat!, input.lon!, radiusKm);
    query = query
      .gte("lat", box.minLat)
      .lte("lat", box.maxLat)
      .gte("lon", box.minLon)
      .lte("lon", box.maxLon);
  }

  const ts = tsQuery(parsed);
  if (ts) query = query.textSearch("search_tsv", ts, { config: "simple" });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as Row[];

  // Ortsangabe ohne Koordinaten: über den Freitext des Standortfeldes filtern.
  if (parsed.place && !hasOrigin) {
    const place = normalizeMarketText(parsed.place);
    const narrowed = rows.filter((r) => normalizeMarketText(r.place ?? "").includes(place));
    if (narrowed.length > 0) rows = narrowed;
  }

  const ids = rows.map((r) => r.id);
  const [covers, tags] = await Promise.all([coverIndex(db, ids), slangTagIndex(db, ids)]);

  const now = Date.now();
  let ranked = rows.map((row) => {
    let distanceKm: number | null = null;
    if (hasOrigin && row.lat !== null && row.lon !== null) {
      distanceKm = roughDistanceKm(haversineKm(input.lat!, input.lon!, row.lat, row.lon));
    }
    const score = scoreItem(
      {
        title: row.title,
        description: row.description,
        categoryId: row.category_id,
        priceCents: row.price_cents,
        createdAt: new Date(row.created_at).getTime(),
        distanceKm,
        slangTags: tags.get(row.id) ?? [],
        promotedUntil: activePromotion(row.promoted_until, row.promotion_disabled_at),
      },
      { query: parsed, categoryId: input.categoryId, radiusKm, now },
    );
    return toRanked(row, covers.get(row.id), distanceKm, score);
  });

  // Harte Radiusgrenze (Bounding-Box ist nur ein Rechteck).
  if (hasOrigin && radiusKm && radiusKm > 0) {
    ranked = ranked.filter((i) => i.distanceKm === null || i.distanceKm <= radiusKm);
  }
  if (input.withImageOnly) ranked = ranked.filter((i) => i.imageCount > 0);

  // Relevanz vor Distanz: erst Score, bei ähnlichem Score entscheidet die Nähe.
  ranked.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 2) return b.score - a.score;
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const dbb = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== dbb) return da - dbb;
    return b.createdAt - a.createdAt;
  });

  ranked = capPromoted(ranked);

  const page = ranked.slice(input.offset, input.offset + input.limit);
  return { items: page, hasMore: ranked.length > input.offset + input.limit, parsed };
}

/**
 * Begrenzung: hoechstens `MARKET_LIMITS.promotedPerPage` hervorgehobene
 * Artikel je Seite. Ueberzaehlige rutschen hinter die organischen Treffer,
 * damit bezahlte Sichtbarkeit die Ergebnisliste nie uebernimmt.
 */
function capPromoted(ranked: RankedMarketItem[]): RankedMarketItem[] {
  const kept: RankedMarketItem[] = [];
  const deferred: RankedMarketItem[] = [];
  let promoted = 0;
  for (const item of ranked) {
    if (item.promotedUntil) {
      promoted += 1;
      if (promoted > MARKET_LIMITS.promotedPerPage) {
        deferred.push(item);
        continue;
      }
    }
    kept.push(item);
  }
  return deferred.length > 0 ? [...kept, ...deferred] : kept;
}

/* ----------------------------- Universelle Suche ------------------------------ */

export type UniversalSearchResult = {
  parsed: ParsedMarketQuery;
  items: RankedMarketItem[];
  itemsTotal: number;
  channels: { id: string; name: string; slug: string; icon: string | null }[];
  slangTags: { id: string; name: string; kind: string }[];
};

/**
 * Eine Suche, mehrere Ergebnisbereiche: Market, Channels, SlangTags.
 * Es werden ausschließlich die bestehenden Suchfunktionen genutzt.
 */
export async function searchEverything(
  db: DB,
  input: MarketSearchRequest,
): Promise<UniversalSearchResult> {
  const market = await searchMarket(db, { ...input, limit: MARKET_LIMITS.items, offset: 0 });
  const term = market.parsed.terms[0] ?? market.parsed.raw.trim();
  if (!term) {
    return {
      parsed: market.parsed,
      items: market.items,
      itemsTotal: market.items.length,
      channels: [],
      slangTags: [],
    };
  }

  const [channelRes, tagRes] = await Promise.all([
    db.rpc("search_channels", { _q: term, _limit: MARKET_LIMITS.channels }),
    db
      .from("slang_tags")
      .select("id,name,kind,normalized_name")
      .ilike("normalized_name", `%${term}%`)
      .eq("moderation_status", "approved")
      .limit(MARKET_LIMITS.slangTags),
  ]);

  return {
    parsed: market.parsed,
    items: market.items,
    itemsTotal: market.items.length,
    channels: (channelRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
    })),
    slangTags: (tagRes.data ?? []).map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
  };
}

/* ------------------------------ Ähnliche Artikel ------------------------------ */

/**
 * „Das könnte dich auch interessieren“: gleiche Kategorie bzw. ähnliche Wörter,
 * sinnvoller Preisbereich, niemals der Artikel selbst, nur aktive Angebote.
 */
export async function similarItems(
  db: DB,
  itemId: string,
  limit = MARKET_LIMITS.similar,
): Promise<RankedMarketItem[]> {
  const { data: base, error } = await db
    .from("market_items")
    .select(ITEM_COLUMNS)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!base) return [];
  const item = base as Row;

  const parsed = parseMarketQuery(item.title);
  const ts = tsQuery(parsed);

  let query = db
    .from("market_items")
    .select(ITEM_COLUMNS)
    .eq("status", "active")
    .neq("id", itemId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (item.category_id) query = query.eq("category_id", item.category_id);
  // Preis nur als Rahmen (0,4× bis 2,5×), damit 80 € nicht 1.500 € trifft.
  if (item.price_cents > 0) {
    query = query
      .gte("price_cents", Math.floor(item.price_cents * 0.4))
      .lte("price_cents", Math.ceil(item.price_cents * 2.5));
  }
  if (ts)
    query = query.or(
      `title.ilike.%${parsed.terms[0] ?? ""}%,category_id.eq.${item.category_id ?? ""}`,
    );

  const { data, error: listError } = await query;
  if (listError) throw new Error(listError.message);
  const rows = (data ?? []) as Row[];
  const covers = await coverIndex(
    db,
    rows.map((r) => r.id),
  );

  const now = Date.now();
  const ranked = rows.map((row) => {
    const distanceKm =
      item.lat !== null && item.lon !== null && row.lat !== null && row.lon !== null
        ? roughDistanceKm(haversineKm(item.lat, item.lon, row.lat, row.lon))
        : null;
    const score = scoreItem(
      {
        title: row.title,
        description: row.description,
        categoryId: row.category_id,
        priceCents: row.price_cents,
        createdAt: new Date(row.created_at).getTime(),
        distanceKm,
        promotedUntil: activePromotion(row.promoted_until, row.promotion_disabled_at),
      },
      {
        query: parsed,
        categoryId: item.category_id,
        referencePriceCents: item.price_cents || null,
        now,
      },
    );
    return toRanked(row, covers.get(row.id), distanceKm, score);
  });

  ranked.sort((a, b) => b.score - a.score);
  return dedupeById(ranked, new Set([itemId])).slice(0, limit);
}

/* ---------------------------- Gespeicherte Suchen ----------------------------- */

export type SavedSearch = {
  id: string;
  label: string;
  notify: boolean;
  createdAt: number;
  query: {
    q: string;
    categoryId: string | null;
    priceMinCents: number | null;
    priceMaxCents: number | null;
    radiusKm: number | null;
    lat: number | null;
    lon: number | null;
    terms: string[];
  };
};

type StoredQuery = SavedSearch["query"];

function toStoredQuery(input: MarketSearchRequest, parsed: ParsedMarketQuery): StoredQuery {
  return {
    q: input.q.slice(0, 200),
    categoryId: input.categoryId,
    priceMinCents: input.priceMinCents ?? parsed.priceMinCents,
    priceMaxCents: input.priceMaxCents ?? parsed.priceMaxCents,
    radiusKm: input.radiusKm ?? parsed.radiusKm,
    lat: input.lat,
    lon: input.lon,
    terms: parsed.terms.slice(0, 8),
  };
}

export async function listSavedSearches(db: DB, userId: string): Promise<SavedSearch[]> {
  const { data, error } = await db
    .from("market_searches")
    .select("id,label,notify,query,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    notify: row.notify,
    createdAt: new Date(row.created_at).getTime(),
    query: (row.query ?? {}) as StoredQuery,
  }));
}

export async function saveSearch(
  db: DB,
  userId: string,
  input: MarketSearchRequest,
  label?: string,
): Promise<SavedSearch> {
  const parsed = parseMarketQuery(input.q);
  const stored = toStoredQuery(input, parsed);
  const { data, error } = await db
    .from("market_searches")
    .insert({
      user_id: userId,
      label: (label?.trim() || describeMarketQuery(parsed)).slice(0, 120),
      notify: true,
      query: stored,
    })
    .select("id,label,notify,query,created_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    label: data.label,
    notify: data.notify,
    createdAt: new Date(data.created_at).getTime(),
    query: stored,
  };
}

export async function updateSavedSearch(
  db: DB,
  userId: string,
  id: string,
  patch: { label?: string; notify?: boolean },
): Promise<void> {
  const update: { label?: string; notify?: boolean } = {};
  if (patch.label !== undefined) update.label = patch.label.trim().slice(0, 120);
  if (patch.notify !== undefined) update.notify = patch.notify;
  if (Object.keys(update).length === 0) return;
  const { error } = await db
    .from("market_searches")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteSavedSearch(db: DB, userId: string, id: string): Promise<void> {
  const { error } = await db.from("market_searches").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
