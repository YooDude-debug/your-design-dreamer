/**
 * Y-Dude Market – Phase 4: Hervorhebung, Verkäuferprofile, Statistik.
 *
 * Wichtig: Hier wird **kein** Zahlungssystem angebunden. Eine Promotion ist
 * eine Anfrage mit Preisangabe; Freigabe und Laufzeit steuert die Moderation.
 * Alle Rechte kommen aus den RLS-Regeln der Tabellen – hier gibt es keine
 * zweite Berechtigungslogik.
 */

import { activePromotion, type DB, type MarketItemSummary } from "./market.server";
import { MARKET_LIMITS } from "./market-query";

/** Adminprüfung über die bestehende Rollenfunktion – keine zweite Logik. */
export async function requireMarketAdmin(db: DB, userId: string): Promise<void> {
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

/* ------------------------------- Typen --------------------------------- */

export type PromotionType = "standard" | "featured" | "channel_boost" | "local_boost";
export type PromotionStatus = "requested" | "active" | "expired" | "cancelled";

export type MarketPromotionPlan = {
  code: string;
  promotionType: PromotionType;
  durationDays: number;
  priceCents: number;
  currency: string;
};

export type MarketPromotion = {
  id: string;
  itemId: string;
  itemTitle: string | null;
  planCode: string | null;
  promotionType: string;
  durationDays: number;
  priceCents: number;
  currency: string;
  status: string;
  startsAt: number | null;
  endsAt: number | null;
  createdAt: number;
};

export type MarketSellerProfile = {
  userId: string;
  sellerType: "private" | "business" | "professional";
  businessName: string | null;
  logoPath: string | null;
  description: string | null;
  website: string | null;
  verifiedBusiness: boolean;
};

export type MarketSellerStats = {
  activeItems: number;
  reservedItems: number;
  soldItems: number;
  promotedItems: number;
  views: number;
  favorites: number;
  contacts: number;
  offers: number;
  offersOpen: number;
};

const EMPTY_STATS: MarketSellerStats = {
  activeItems: 0,
  reservedItems: 0,
  soldItems: 0,
  promotedItems: 0,
  views: 0,
  favorites: 0,
  contacts: 0,
  offers: 0,
  offersOpen: 0,
};

/* ------------------------------ Pakete ---------------------------------- */

export async function listPromotionPlans(db: DB): Promise<MarketPromotionPlan[]> {
  const { data, error } = await db
    .from("market_promotion_plans")
    .select("code,promotion_type,duration_days,price_cents,currency")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    code: r.code,
    promotionType: r.promotion_type as PromotionType,
    durationDays: r.duration_days,
    priceCents: r.price_cents,
    currency: r.currency,
  }));
}

/* --------------------------- Promotion-Anfragen -------------------------- */

type PromotionRow = {
  id: string;
  item_id: string;
  plan_code: string | null;
  promotion_type: string;
  duration_days: number;
  price_cents: number;
  currency: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  market_items?: { title: string } | null;
};

function toPromotion(row: PromotionRow): MarketPromotion {
  return {
    id: row.id,
    itemId: row.item_id,
    itemTitle: row.market_items?.title ?? null,
    planCode: row.plan_code,
    promotionType: row.promotion_type,
    durationDays: row.duration_days,
    priceCents: row.price_cents,
    currency: row.currency,
    status: row.status,
    startsAt: row.starts_at ? new Date(row.starts_at).getTime() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

const PROMOTION_COLUMNS =
  "id,item_id,plan_code,promotion_type,duration_days,price_cents,currency,status,starts_at,ends_at,created_at,market_items(title)";

/** Hervorhebung anfragen (keine Zahlung, nur Vormerkung zur Freigabe). */
export async function requestPromotion(
  db: DB,
  userId: string,
  input: { itemId: string; planCode: string; radiusKm: number | null },
): Promise<MarketPromotion> {
  const { data: item, error: itemError } = await db
    .from("market_items")
    .select("id,seller_id,status")
    .eq("id", input.itemId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item || item.seller_id !== userId) throw new Error("not_owner");
  if (item.status !== "active") throw new Error("item_not_active");

  const plans = await listPromotionPlans(db);
  const plan = plans.find((p) => p.code === input.planCode);
  if (!plan) throw new Error("unknown_plan");

  const { data, error } = await db
    .from("market_promotions")
    .insert({
      item_id: input.itemId,
      seller_id: userId,
      plan_code: plan.code,
      promotion_type: plan.promotionType as MarketPromotionPlan["promotionType"],
      duration_days: plan.durationDays,
      price_cents: plan.priceCents,
      currency: plan.currency,
      status: "requested",
      radius_km: input.radiusKm,
    })
    .select(PROMOTION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toPromotion(data as PromotionRow);
}

export async function listMyPromotions(db: DB, userId: string): Promise<MarketPromotion[]> {
  const { data, error } = await db
    .from("market_promotions")
    .select(PROMOTION_COLUMNS)
    .eq("seller_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toPromotion(r as PromotionRow));
}

/** Moderationssicht: offene und laufende Hervorhebungen. */
export async function listPromotionsForAdmin(
  db: DB,
  status: PromotionStatus | null,
): Promise<MarketPromotion[]> {
  let query = db
    .from("market_promotions")
    .select(PROMOTION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toPromotion(r as PromotionRow));
}

/**
 * Freigabe oder Abbruch einer Hervorhebung. Bei „aktivieren“ wird die
 * Laufzeit am Artikel gesetzt; „abbrechen“ nimmt sie sofort zurück.
 */
export async function decidePromotion(
  db: DB,
  adminId: string,
  input: { promotionId: string; action: "activate" | "cancel" },
): Promise<MarketPromotion> {
  const { data: row, error } = await db
    .from("market_promotions")
    .select("id,item_id,duration_days,promotion_type,radius_km")
    .eq("id", input.promotionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("not_found");

  const now = new Date();
  if (input.action === "activate") {
    const ends = new Date(now.getTime() + row.duration_days * 86_400_000);
    const [{ error: pErr }, { error: iErr }] = await Promise.all([
      db
        .from("market_promotions")
        .update({ status: "active", starts_at: now.toISOString(), ends_at: ends.toISOString() })
        .eq("id", row.id),
      db
        .from("market_items")
        .update({
          promoted_until: ends.toISOString(),
          promotion_type: row.promotion_type,
          promotion_created_at: now.toISOString(),
          promotion_radius_km: row.radius_km,
          promotion_disabled_at: null,
          promotion_disabled_by: null,
        })
        .eq("id", row.item_id),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (iErr) throw new Error(iErr.message);
  } else {
    const [{ error: pErr }, { error: iErr }] = await Promise.all([
      db.from("market_promotions").update({ status: "cancelled" }).eq("id", row.id),
      db
        .from("market_items")
        .update({ promotion_disabled_at: now.toISOString(), promotion_disabled_by: adminId })
        .eq("id", row.item_id),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (iErr) throw new Error(iErr.message);
  }

  const { data: fresh } = await db
    .from("market_promotions")
    .select(PROMOTION_COLUMNS)
    .eq("id", row.id)
    .single();
  return toPromotion(fresh as PromotionRow);
}

/* --------------------------- Verkäuferprofil ----------------------------- */

/**
 * Verkäuferprofil lesen.
 *
 * Die Tabelle `market_seller_profiles` ist per Zeilensicherheit auf den
 * Eigentümer (und Admins) beschränkt. Fremde Profile werden ausschließlich
 * über die Datenbankfunktion `market_public_seller_profile` gelesen, die nur
 * die öffentlich vorgesehenen Felder zurückgibt.
 */
export async function getSellerProfile(
  db: DB,
  userId: string,
  viewerId?: string,
): Promise<MarketSellerProfile | null> {
  const own = !viewerId || viewerId === userId;

  const { data, error } = own
    ? await db
        .from("market_seller_profiles")
        .select("user_id,seller_type,business_name,logo_path,description,website,verified_business")
        .eq("user_id", userId)
        .maybeSingle()
    : await db.rpc("market_public_seller_profile", { _user_id: userId }).maybeSingle<{
        user_id: string;
        seller_type: string;
        business_name: string | null;
        logo_path: string | null;
        description: string | null;
        website: string | null;
        verified_business: boolean | null;
      }>();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    userId: data.user_id,
    sellerType: data.seller_type as MarketSellerProfile["sellerType"],
    businessName: data.business_name,
    logoPath: data.logo_path,
    description: data.description,
    website: data.website,
    verifiedBusiness: !!data.verified_business,
  };
}

export async function upsertSellerProfile(
  db: DB,
  userId: string,
  input: {
    sellerType: MarketSellerProfile["sellerType"];
    businessName: string | null;
    logoPath: string | null;
    description: string | null;
    website: string | null;
  },
): Promise<MarketSellerProfile> {
  const { error } = await db.from("market_seller_profiles").upsert(
    {
      user_id: userId,
      seller_type: input.sellerType,
      business_name: input.businessName,
      logo_path: input.logoPath,
      description: input.description,
      website: input.website,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  const profile = await getSellerProfile(db, userId);
  if (!profile) throw new Error("save_failed");
  return profile;
}

/* ------------------------------ Statistik -------------------------------- */

export async function sellerStats(db: DB, sellerId: string): Promise<MarketSellerStats> {
  const { data, error } = await db.rpc("market_seller_stats", { _seller: sellerId });
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as Partial<Record<keyof MarketSellerStats, number>>;
  return { ...EMPTY_STATS, ...raw };
}

/* -------------------------- Hervorgehobene Liste -------------------------- */

const FEATURED_COLUMNS =
  "id,seller_id,title,price_cents,negotiable,category_id,condition,delivery,status,place,postal_code,lat,lon,created_at,promoted_until,promotion_disabled_at";

/**
 * „Hervorgehobene Angebote“ für die Market-Startseite. Bewusst eine eigene,
 * klar begrenzte Liste statt einer Vermischung mit der normalen Sortierung.
 */
export async function featuredItems(
  db: DB,
  categoryId: string | null,
): Promise<MarketItemSummary[]> {
  let query = db
    .from("market_items")
    .select(FEATURED_COLUMNS)
    .eq("status", "active")
    .is("promotion_disabled_at", null)
    .gt("promoted_until", new Date().toISOString())
    .order("promoted_until", { ascending: false })
    .limit(MARKET_LIMITS.featured);
  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: imgs } = await db
    .from("market_images")
    .select("item_id,path,sort_order,is_primary")
    .in(
      "item_id",
      rows.map((r) => r.id),
    )
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  const cover = new Map<string, { cover: string | null; count: number }>();
  for (const i of imgs ?? []) {
    const e = cover.get(i.item_id) ?? { cover: null, count: 0 };
    if (!e.cover) e.cover = i.path;
    e.count += 1;
    cover.set(i.item_id, e);
  }

  return rows.map((row) => ({
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
  }));
}
