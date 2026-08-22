import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Detail-Auswertungen für den Creator-/Unternehmer-Statistikbereich.
 *
 * Grundsätze:
 * - Es werden ausschliesslich bereits vorhandene Daten ausgewertet
 *   (posts, post_likes, comments, follows, slang_tags) – keine neue
 *   Datenhaltung.
 * - Zugriff nur mit Creator- oder Unternehmer-Rolle, immer beschränkt auf die
 *   eigenen Inhalte des angemeldeten Kontos.
 * - Privatsphäre: Fremde Personen werden nur dann namentlich ausgeliefert,
 *   wenn ihr Profil öffentlich ist. Bei Likes zählt zusätzlich die
 *   Einstellung „Likes privat“. Andernfalls „Anonymer Nutzer“ ohne Bild
 *   und ohne Profil-Link. Aggregierte Zahlen bleiben korrekt.
 */

export type StatActor = {
  /** Nur gesetzt, wenn die Person öffentlich sichtbar sein möchte. */
  username: string | null;
  avatar: string | null;
  verified: boolean;
  /** true = anonymisiert dargestellt („Anonymer Nutzer“). */
  anonymous: boolean;
};

export type CreatorPostRow = {
  id: string;
  title: string;
  createdAt: string;
  likes: number;
  comments: number;
  views: number;
  tagUses: number;
  image: string | null;
  hasVideo: boolean;
};

export type CreatorLikeRow = {
  postId: string;
  postTitle: string;
  createdAt: string;
  actor: StatActor;
};

export type CreatorCommentRow = {
  id: string;
  postId: string;
  postTitle: string;
  body: string;
  createdAt: string;
  actor: StatActor;
};

export type CreatorFollowerRow = {
  createdAt: string;
  actor: StatActor;
};

export type CreatorTagRow = {
  id: string;
  name: string;
  kind: string;
  audio: string | null;
  uses: number;
  videoUses: number;
  plays: number;
  reach: number;
  /** Position innerhalb aller SlangTags nach Nutzungen. */
  rank: number;
  createdAt: string;
};

export type CreatorTagUsePost = {
  postId: string;
  title: string;
  createdAt: string;
  tags: string[];
};

export type CreatorSeriesPoint = {
  day: string;
  likes: number;
  comments: number;
  followers: number;
  tagUses: number;
};

const ANON: StatActor = { username: null, avatar: null, verified: false, anonymous: true };

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function requireCreator(context: { supabase: any; userId: string }) {
  const [creator, business] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "creator" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "business" }),
  ]);
  if (creator.data !== true && business.data !== true) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as AdminClient;
}

async function signPaths(admin: AdminClient, paths: string[]): Promise<Map<string, string>> {
  const clean = [...new Set(paths.filter(Boolean))];
  const out = new Map<string, string>();
  if (clean.length === 0) return out;
  const { data } = await admin.storage.from("media").createSignedUrls(clean, 60 * 60);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}

/** Baut anonymisierungssichere Darstellungen für fremde Konten. */
async function buildActors(
  admin: AdminClient,
  ids: string[],
  opts: { selfId: string; respectLikesPrivacy?: boolean },
): Promise<Map<string, StatActor>> {
  const unique = [...new Set(ids)];
  const map = new Map<string, StatActor>();
  if (unique.length === 0) return map;

  const { data: profs } = await admin
    .from("profiles")
    .select("id,username,display_name,avatar_url,verified,profile_visibility,likes_private")
    .in("id", unique);

  const avatarPaths = (profs ?? [])
    .filter((p) => p.profile_visibility === "public" && p.avatar_url)
    .map((p) => p.avatar_url as string);
  const signed = await signPaths(admin, avatarPaths);

  for (const p of profs ?? []) {
    const isSelf = p.id === opts.selfId;
    const hidden =
      !isSelf &&
      (p.profile_visibility !== "public" ||
        (opts.respectLikesPrivacy === true && Boolean(p.likes_private)));
    if (hidden) {
      map.set(p.id as string, ANON);
      continue;
    }
    map.set(p.id as string, {
      username: (p.username as string) ?? null,
      avatar: p.avatar_url ? (signed.get(p.avatar_url as string) ?? null) : null,
      verified: Boolean(p.verified),
      anonymous: false,
    });
  }
  for (const id of unique) if (!map.has(id)) map.set(id, ANON);
  return map;
}

/** Eigene Beiträge inklusive aktueller Kennzahlen. */
export const getCreatorPostRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorPostRow[]> => {
    const admin = await requireCreator(context);
    const { data } = await admin
      .from("posts")
      .select(
        "id,title,created_at,likes_count,comments_count,views_count,slang_tag_ids,image_url,video_url",
      )
      .eq("user_id", context.userId)
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(300);

    const rows = data ?? [];
    const signed = await signPaths(
      admin,
      rows.map((r) => (r.image_url as string | null) ?? "").filter(Boolean),
    );
    return rows.map((r) => ({
      id: r.id as string,
      title: (r.title as string) || "Ohne Titel",
      createdAt: r.created_at as string,
      likes: (r.likes_count as number) ?? 0,
      comments: (r.comments_count as number) ?? 0,
      views: (r.views_count as number) ?? 0,
      tagUses: Array.isArray(r.slang_tag_ids) ? (r.slang_tag_ids as string[]).length : 0,
      image: r.image_url ? (signed.get(r.image_url as string) ?? null) : null,
      hasVideo: Boolean(r.video_url),
    }));
  });

/** Erhaltene Likes auf eigene Beiträge. */
export const getCreatorLikeRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorLikeRow[]> => {
    const admin = await requireCreator(context);
    const { data: posts } = await admin
      .from("posts")
      .select("id,title")
      .eq("user_id", context.userId);
    const titles = new Map(
      (posts ?? []).map((p) => [p.id as string, (p.title as string) || "Beitrag"]),
    );
    if (titles.size === 0) return [];

    const { data: likes } = await admin
      .from("post_likes")
      .select("post_id,user_id,created_at")
      .in("post_id", [...titles.keys()])
      .order("created_at", { ascending: false })
      .limit(300);

    const actors = await buildActors(
      admin,
      (likes ?? []).map((l) => l.user_id as string),
      { selfId: context.userId, respectLikesPrivacy: true },
    );

    return (likes ?? []).map((l) => ({
      postId: l.post_id as string,
      postTitle: titles.get(l.post_id as string) ?? "Beitrag",
      createdAt: l.created_at as string,
      actor: actors.get(l.user_id as string) ?? ANON,
    }));
  });

/** Erhaltene Kommentare auf eigene Beiträge. */
export const getCreatorCommentRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorCommentRow[]> => {
    const admin = await requireCreator(context);
    const { data: posts } = await admin
      .from("posts")
      .select("id,title")
      .eq("user_id", context.userId);
    const titles = new Map(
      (posts ?? []).map((p) => [p.id as string, (p.title as string) || "Beitrag"]),
    );
    if (titles.size === 0) return [];

    const { data: comments } = await admin
      .from("comments")
      .select("id,post_id,user_id,body,created_at")
      .in("post_id", [...titles.keys()])
      .order("created_at", { ascending: false })
      .limit(300);

    const actors = await buildActors(
      admin,
      (comments ?? []).map((c) => c.user_id as string),
      { selfId: context.userId },
    );

    return (comments ?? []).map((c) => ({
      id: c.id as string,
      postId: c.post_id as string,
      postTitle: titles.get(c.post_id as string) ?? "Beitrag",
      body: (c.body as string) ?? "",
      createdAt: c.created_at as string,
      actor: actors.get(c.user_id as string) ?? ANON,
    }));
  });

/** Eigene Follower. */
export const getCreatorFollowerRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorFollowerRow[]> => {
    const admin = await requireCreator(context);
    const { data } = await admin
      .from("follows")
      .select("follower_id,created_at")
      .eq("following_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(300);

    const actors = await buildActors(
      admin,
      (data ?? []).map((f) => f.follower_id as string),
      { selfId: context.userId },
    );
    return (data ?? []).map((f) => ({
      createdAt: f.created_at as string,
      actor: actors.get(f.follower_id as string) ?? ANON,
    }));
  });

/** Eigene SlangTags mit Nutzung, Plays und Rangposition. */
export const getCreatorTagRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorTagRow[]> => {
    const admin = await requireCreator(context);
    const { data } = await admin
      .from("slang_tags")
      .select(
        "id,name,kind,audio_url,uses_count,video_uses_count,plays_count,reach_count,created_at,owner_id,creator_id",
      )
      .or(`owner_id.eq.${context.userId},creator_id.eq.${context.userId}`)
      .is("deleted_at", null)
      .order("uses_count", { ascending: false })
      .limit(200);

    const rows = data ?? [];
    const signed = await signPaths(
      admin,
      rows.map((r) => (r.audio_url as string | null) ?? "").filter(Boolean),
    );

    const out: CreatorTagRow[] = [];
    for (const r of rows) {
      const uses = (r.uses_count as number) ?? 0;
      const { count } = await admin
        .from("slang_tags")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gt("uses_count", uses);
      out.push({
        id: r.id as string,
        name: r.name as string,
        kind: (r.kind as string) ?? "community",
        audio: r.audio_url ? (signed.get(r.audio_url as string) ?? null) : null,
        uses,
        videoUses: (r.video_uses_count as number) ?? 0,
        plays: (r.plays_count as number) ?? 0,
        reach: (r.reach_count as number) ?? 0,
        rank: (count ?? 0) + 1,
        createdAt: r.created_at as string,
      });
    }
    return out;
  });

/**
 * Beiträge, in denen eigene SlangTags verwendet wurden.
 * Die Leseberechtigung bleibt beim Nutzerkontext (RLS/`can_view_post`), damit
 * keine nicht sichtbaren Beiträge offengelegt werden.
 */
export const getCreatorTagUsePosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ tagIds: z.array(z.string().uuid()).max(50) }).parse(data))
  .handler(async ({ data, context }): Promise<CreatorTagUsePost[]> => {
    await requireCreator(context);
    if (data.tagIds.length === 0) return [];

    const { supabase } = context;
    const { data: tags } = await supabase
      .from("slang_tags")
      .select("id,name")
      .in("id", data.tagIds);
    const names = new Map((tags ?? []).map((t) => [t.id as string, t.name as string]));

    const { data: posts } = await supabase
      .from("posts")
      .select("id,title,created_at,slang_tag_ids")
      .overlaps("slang_tag_ids", data.tagIds)
      .order("created_at", { ascending: false })
      .limit(200);

    return (posts ?? []).map((p) => ({
      postId: p.id as string,
      title: (p.title as string) || "Beitrag",
      createdAt: p.created_at as string,
      tags: ((p.slang_tag_ids as string[] | null) ?? [])
        .filter((id) => names.has(id))
        .map((id) => names.get(id) as string),
    }));
  });

/** Zeitverlauf der letzten 30 Tage (Likes, Kommentare, Follower, Tag-Nutzungen). */
export const getCreatorSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorSeriesPoint[]> => {
    const admin = await requireCreator(context);
    const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const sinceIso = since.toISOString();

    const { data: posts } = await admin.from("posts").select("id").eq("user_id", context.userId);
    const postIds = (posts ?? []).map((p) => p.id as string);

    const { data: tags } = await admin
      .from("slang_tags")
      .select("id")
      .or(`owner_id.eq.${context.userId},creator_id.eq.${context.userId}`)
      .is("deleted_at", null);
    const tagIds = (tags ?? []).map((t) => t.id as string);

    const [likes, comments, follows, tagPosts] = await Promise.all([
      postIds.length
        ? admin
            .from("post_likes")
            .select("created_at")
            .in("post_id", postIds)
            .gte("created_at", sinceIso)
        : Promise.resolve({ data: [] as { created_at: string }[] }),
      postIds.length
        ? admin
            .from("comments")
            .select("created_at")
            .in("post_id", postIds)
            .gte("created_at", sinceIso)
        : Promise.resolve({ data: [] as { created_at: string }[] }),
      admin
        .from("follows")
        .select("created_at")
        .eq("following_id", context.userId)
        .gte("created_at", sinceIso),
      tagIds.length
        ? admin
            .from("posts")
            .select("created_at")
            .overlaps("slang_tag_ids", tagIds)
            .gte("created_at", sinceIso)
        : Promise.resolve({ data: [] as { created_at: string }[] }),
    ]);

    const days: CreatorSeriesPoint[] = [];
    const index = new Map<string, CreatorSeriesPoint>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const point: CreatorSeriesPoint = {
        day: key,
        likes: 0,
        comments: 0,
        followers: 0,
        tagUses: 0,
      };
      days.push(point);
      index.set(key, point);
    }
    const add = (
      rows: { created_at: string }[] | null | undefined,
      key: "likes" | "comments" | "followers" | "tagUses",
    ) => {
      for (const r of rows ?? []) {
        const point = index.get(String(r.created_at).slice(0, 10));
        if (point) point[key] += 1;
      }
    };
    add(likes.data as { created_at: string }[] | null, "likes");
    add(comments.data as { created_at: string }[] | null, "comments");
    add(follows.data as { created_at: string }[] | null, "followers");
    add(tagPosts.data as { created_at: string }[] | null, "tagUses");
    return days;
  });
