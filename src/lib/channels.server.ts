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
  type ChannelUpdate = Database["public"]["Tables"]["channels"]["Update"];
  const update: ChannelUpdate = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 60);
    if (!name) throw new Error("invalid_channel_name");
    update.name = name;
    update.slug = slugify(name);
  }
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.icon !== undefined) update.icon = patch.icon;
  if (patch.imageUrl !== undefined) update.image_url = patch.imageUrl;
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
  if (patch.region !== undefined) update.region = patch.region;
  if (patch.isPublic !== undefined) update.is_public = patch.isPublic;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;

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

/* ------------------------------------------------------------------ */
/* Channel-Verwaltung: Rollen, Moderation, Follower, Sperren            */
/* ------------------------------------------------------------------ */

export type ChannelRole = "owner" | "moderator";

export type ManagedChannel = ChannelSummary & {
  role: ChannelRole;
  isPublic: boolean;
  isActive: boolean;
};

export type ChannelMember = {
  userId: string;
  role: ChannelRole;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type ChannelModerationPost = {
  id: string;
  userId: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
  pinned: boolean;
  approvedAt: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

type ProfileRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

async function profileMap(db: DB, ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map<string, ProfileRow>();
  const { data } = await db.from("profiles").select("id, username, display_name, avatar_url").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p as ProfileRow]));
}

/**
 * Channels, die der Nutzer verwaltet – Grundlage ist ausschliesslich die
 * Relation `channel_members` (user_id → channel_id → role). Keine
 * hartcodierten Benutzer-IDs.
 */
export async function listManagedChannels(db: DB, userId: string): Promise<ManagedChannel[]> {
  const { data, error } = await db
    .from("channel_members")
    .select(
      "role, channels!inner(id, name, slug, icon, category_id, followers_count, posts_count, is_public, is_active, channel_categories(name, slug))",
    )
    .eq("user_id", userId);
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
      is_public: boolean;
      is_active: boolean;
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
        isPublic: c.is_public,
        isActive: c.is_active,
        role: (row.role as ChannelRole) ?? "moderator",
      },
    ];
  });
}

/** Einzelner Channel (RLS erlaubt Owner, Moderatoren, Admins und oeffentliche Channels). */
export async function getChannel(db: DB, channelId: string): Promise<ChannelDetail | null> {
  const { data, error } = await db
    .from("channels")
    .select(
      "id, name, slug, description, icon, image_url, category_id, owner_id, region, followers_count, posts_count, is_public, is_active, channel_categories(name, slug)",
    )
    .eq("id", channelId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const detail = toDetail(data);
  const cat = (data as unknown as { channel_categories: { name: string; slug: string } | null })
    .channel_categories;
  return { ...detail, categoryName: cat?.name ?? null, categorySlug: cat?.slug ?? null };
}

/** Beitraege, die diesem Channel zugeordnet sind (Moderationsliste). */
export async function listChannelModerationPosts(
  db: DB,
  channelId: string,
  limit = 60,
): Promise<ChannelModerationPost[]> {
  const { data, error } = await db
    .from("posts")
    .select(
      "id, user_id, title, description, image_url, video_url, created_at, channel_pinned, channel_approved_at",
    )
    .eq("channel_id", channelId)
    .order("channel_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw error;
  const rows = data ?? [];
  const profiles = await profileMap(db, rows.map((r) => r.user_id));
  return rows.map((r) => {
    const p = profiles.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      description: r.description,
      imageUrl: r.image_url,
      videoUrl: r.video_url,
      createdAt: r.created_at,
      pinned: r.channel_pinned,
      approvedAt: r.channel_approved_at,
      username: p?.username ?? null,
      displayName: p?.display_name ?? null,
      avatarUrl: p?.avatar_url ?? null,
    };
  });
}

/**
 * Moderationsaktion. Laeuft ueber die geprüfte Datenbankfunktion
 * `channel_moderate_post`; „remove“ loest ausschliesslich die
 * Channel-Zuordnung – Beitrag und SlangTags bleiben unveraendert bestehen.
 */
export async function moderateChannelPost(
  db: DB,
  postId: string,
  action: "approve" | "remove" | "pin" | "unpin",
) {
  const { error } = await db.rpc("channel_moderate_post", { _post_id: postId, _action: action });
  if (error) throw error;
  return { ok: true } as const;
}

/** Follower eines Channels (nur fuer Owner/Moderatoren lesbar – RLS). */
export async function listChannelFollowers(db: DB, channelId: string, limit = 100) {
  const { data, error } = await db
    .from("channel_follows")
    .select("user_id")
    .eq("channel_id", channelId)
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) throw error;
  const rows = data ?? [];
  const profiles = await profileMap(db, rows.map((r) => r.user_id));
  return rows.map((r) => {
    const p = profiles.get(r.user_id);
    return {
      userId: r.user_id,
      username: p?.username ?? null,
      displayName: p?.display_name ?? null,
      avatarUrl: p?.avatar_url ?? null,
    };
  });
}

/** Team des Channels (Owner + Moderatoren). */
export async function listChannelMembers(db: DB, channelId: string): Promise<ChannelMember[]> {
  const { data, error } = await db
    .from("channel_members")
    .select("user_id, role, created_at")
    .eq("channel_id", channelId)
    .order("role", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const profiles = await profileMap(db, rows.map((r) => r.user_id));
  return rows.map((r) => {
    const p = profiles.get(r.user_id);
    return {
      userId: r.user_id,
      role: r.role as ChannelRole,
      createdAt: r.created_at,
      username: p?.username ?? null,
      displayName: p?.display_name ?? null,
      avatarUrl: p?.avatar_url ?? null,
    };
  });
}

/** Moderator ergaenzen (nur Owner – ueber RLS abgesichert). */
export async function addChannelModerator(
  db: DB,
  channelId: string,
  username: string,
  actorId: string,
) {
  const handle = username.trim().replace(/^@/, "");
  const { data: profile, error: pErr } = await db
    .from("profiles")
    .select("id")
    .ilike("username", handle)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile) throw new Error("user_not_found");
  const { error } = await db
    .from("channel_members")
    .upsert(
      { channel_id: channelId, user_id: profile.id, role: "moderator", created_by: actorId },
      { onConflict: "channel_id,user_id" },
    );
  if (error) throw error;
  return { ok: true } as const;
}

/** Mitglied entfernen (Owner-Eintraege bleiben geschuetzt). */
export async function removeChannelMember(db: DB, channelId: string, userId: string) {
  const { error } = await db
    .from("channel_members")
    .delete()
    .eq("channel_id", channelId)
    .eq("user_id", userId)
    .eq("role", "moderator");
  if (error) throw error;
  return { ok: true } as const;
}

/** Nutzer fuer den Channel sperren bzw. Sperre aufheben. */
export async function setChannelBan(
  db: DB,
  channelId: string,
  userId: string,
  banned: boolean,
  actorId: string,
  reason?: string | null,
) {
  if (banned) {
    const { error } = await db
      .from("channel_bans")
      .upsert(
        { channel_id: channelId, user_id: userId, reason: reason ?? null, created_by: actorId },
        { onConflict: "channel_id,user_id" },
      );
    if (error) throw error;
    return { banned: true } as const;
  }
  const { error } = await db
    .from("channel_bans")
    .delete()
    .eq("channel_id", channelId)
    .eq("user_id", userId);
  if (error) throw error;
  return { banned: false } as const;
}

/** Gesperrte Nutzer eines Channels. */
export async function listChannelBans(db: DB, channelId: string) {
  const { data, error } = await db
    .from("channel_bans")
    .select("user_id, reason, created_at")
    .eq("channel_id", channelId);
  if (error) throw error;
  const rows = data ?? [];
  const profiles = await profileMap(db, rows.map((r) => r.user_id));
  return rows.map((r) => {
    const p = profiles.get(r.user_id);
    return {
      userId: r.user_id,
      reason: r.reason,
      createdAt: r.created_at,
      username: p?.username ?? null,
      displayName: p?.display_name ?? null,
    };
  });
}
