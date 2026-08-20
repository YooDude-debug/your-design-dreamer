/**
 * Channel-System – serverseitige Datenlogik.
 *
 * Struktur: Kategorie → Channel → Unterkategorie. Kategorien sind über
 * `parent_category_id` beliebig tief verschachtelbar (`channel_categories`),
 * Channels hängen an genau einer Kategorie (`channels`), Nutzer folgen
 * Channels über `channel_follows`. Beiträge referenzieren optional
 * `posts.channel_id` und `posts.channel_category_id` – die bestehende
 * Sichtbarkeitslogik bleibt davon unberührt.
 *
 * Das Hashtag- und das SlangTag-System bleiben unverändert und werden hier
 * nicht vermischt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type DB = SupabaseClient<Database>;

export type ChannelCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parentCategoryId: string | null;
  sortOrder: number;
};

export type ChannelSummary = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  followersCount: number;
  postsCount: number;
};

export type ChannelDetail = ChannelSummary & {
  description: string | null;
  imageUrl: string | null;
  region: string | null;
  ownerId: string | null;
  isPublic: boolean;
  isActive: boolean;
};

/** Channel-/Kategorie-Slug: klein, ohne Sonderzeichen, Bindestriche statt Leerzeichen. */
export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* ------------------------------------------------------------------ */
/* Kategorien                                                          */
/* ------------------------------------------------------------------ */

/** Alle aktiven Kategorien (flach); die Hierarchie ergibt sich aus `parentCategoryId`. */
export async function listCategories(db: DB): Promise<ChannelCategory[]> {
  const { data, error } = await db
    .from("channel_categories")
    .select("id, name, slug, description, icon, parent_category_id, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    icon: r.icon,
    parentCategoryId: r.parent_category_id,
    sortOrder: r.sort_order,
  }));
}

/* ------------------------------------------------------------------ */
/* Suche und Listen                                                    */
/* ------------------------------------------------------------------ */

/** Indexgestützte Channel-Suche über Name, Slug, Kategorie und Unterkategorien. */
export async function searchChannels(db: DB, q: string, limit = 20): Promise<ChannelSummary[]> {
  const term = (q ?? "").trim().toLowerCase();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const { data, error } = await db.rpc("search_channels", { _q: term, _limit: safeLimit });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    icon: r.icon,
    categoryId: r.category_id,
    categoryName: r.category_name,
    categorySlug: r.category_slug,
    followersCount: r.followers_count,
    postsCount: r.posts_count,
  }));
}

/** Channels nach Popularität (Trending-Basis: Follower, dann Beiträge). */
export async function listTrendingChannels(db: DB, limit = 20): Promise<ChannelSummary[]> {
  return searchChannels(db, "", limit);
}

/** Channels, denen der angemeldete Nutzer folgt. */
export async function listFollowedChannels(db: DB, userId: string): Promise<ChannelSummary[]> {
  const { data, error } = await db
    .from("channel_follows")
    .select(
      "channel_id, channels!inner(id, name, slug, icon, category_id, followers_count, posts_count, is_active, channel_categories(name, slug))",
    )
    .eq("user_id", userId)
    .eq("channels.is_active", true);
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const c = row.channels as unknown as {
      id: string;
      name: string;
      slug: string;
      icon: string | null;
      category_id: string | null;
      followers_count: number;
      posts_count: number;
      channel_categories: { name: string; slug: string } | null;
    } | null;
    if (!c) return [];
    return [
      {
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        categoryId: c.category_id,
        categoryName: c.channel_categories?.name ?? null,
        categorySlug: c.channel_categories?.slug ?? null,
        followersCount: c.followers_count,
        postsCount: c.posts_count,
      },
    ];
  });
}

/* ------------------------------------------------------------------ */
/* Channel-Verwaltung                                                  */
/* ------------------------------------------------------------------ */

/** Channel anlegen; der angemeldete Nutzer wird Eigentümer (RLS erzwingt das). */
export async function createChannel(
  db: DB,
  userId: string,
  input: {
    name: string;
    categoryId?: string | null;
    description?: string | null;
    icon?: string | null;
    region?: string | null;
    isPublic?: boolean;
  },
): Promise<ChannelDetail> {
  const name = input.name.trim().slice(0, 60);
  const slug = slugify(name);
  if (!name || !slug) throw new Error("invalid_channel_name");
  const { data, error } = await db
    .from("channels")
    .insert({
      name,
      slug,
      description: input.description ?? null,
      icon: input.icon ?? null,
      category_id: input.categoryId ?? null,
      region: input.region ?? null,
      is_public: input.isPublic ?? true,
      owner_id: userId,
    })
    .select(
      "id, name, slug, description, icon, image_url, category_id, owner_id, region, followers_count, posts_count, is_public, is_active",
    )
    .single();
  if (error) throw error;
  return toDetail(data);
}

/** Channel bearbeiten (nur Eigentümer bzw. Admin – über RLS abgesichert). */
export async function updateChannel(
  db: DB,
  channelId: string,
  patch: {
    name?: string;
    description?: string | null;
    icon?: string | null;
    imageUrl?: string | null;
    categoryId?: string | null;
    region?: string | null;
    isPublic?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  },
): Promise<ChannelDetail> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 60);
    if (!name) throw new Error("invalid_channel_name");
    update['name'] = name;
    update['slug'] = slugify(name);
  }
  if (patch.description !== undefined) update['description'] = patch.description;
  if (patch.icon !== undefined) update['icon'] = patch.icon;
  if (patch.imageUrl !== undefined) update['image_url'] = patch.imageUrl;
  if (patch.categoryId !== undefined) update['category_id'] = patch.categoryId;
  if (patch.region !== undefined) update['region'] = patch.region;
  if (patch.isPublic !== undefined) update['is_public'] = patch.isPublic;
  if (patch.isActive !== undefined) update['is_active'] = patch.isActive;
  if (patch.sortOrder !== undefined) update['sort_order'] = patch.sortOrder;

  const { data, error } = await db
    .from("channels")
    .update(update)
    .eq("id", channelId)
    .select(
      "id, name, slug, description, icon, image_url, category_id, owner_id, region, followers_count, posts_count, is_public, is_active",
    )
    .single();
  if (error) throw error;
  return toDetail(data);
}

/** Channel deaktivieren (kein Löschen – bestehende Beiträge bleiben erhalten). */
export async function setChannelActive(db: DB, channelId: string, active: boolean) {
  return updateChannel(db, channelId, { isActive: active });
}

/* ------------------------------------------------------------------ */
/* Folgen                                                              */
/* ------------------------------------------------------------------ */

/** Channel folgen bzw. entfolgen. */
export async function setChannelFollow(
  db: DB,
  userId: string,
  channelId: string,
  follow: boolean,
): Promise<{ following: boolean }> {
  if (follow) {
    const { error } = await db
      .from("channel_follows")
      .upsert({ user_id: userId, channel_id: channelId }, { onConflict: "user_id,channel_id" });
    if (error) throw error;
    return { following: true };
  }
  const { error } = await db
    .from("channel_follows")
    .delete()
    .eq("user_id", userId)
    .eq("channel_id", channelId);
  if (error) throw error;
  return { following: false };
}

/* ------------------------------------------------------------------ */
/* Beiträge nach Channel / Kategorie                                   */
/* ------------------------------------------------------------------ */

/**
 * IDs der Beiträge eines Channels bzw. einer (Unter-)Kategorie.
 * Sichtbarkeit und Moderation greifen weiterhin über die bestehenden
 * RLS-Regeln der Tabelle `posts`.
 */
export async function listChannelPostIds(
  db: DB,
  filter: { channelId?: string; categoryId?: string },
  limit = 60,
): Promise<string[]> {
  let query = db
    .from("posts")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (filter.channelId) query = query.eq("channel_id", filter.channelId);
  if (filter.categoryId) query = query.eq("channel_category_id", filter.categoryId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

function toDetail(r: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  category_id: string | null;
  owner_id: string | null;
  region: string | null;
  followers_count: number;
  posts_count: number;
  is_public: boolean;
  is_active: boolean;
}): ChannelDetail {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    icon: r.icon,
    imageUrl: r.image_url,
    categoryId: r.category_id,
    categoryName: null,
    categorySlug: null,
    ownerId: r.owner_id,
    region: r.region,
    followersCount: r.followers_count,
    postsCount: r.posts_count,
    isPublic: r.is_public,
    isActive: r.is_active,
  };
}
