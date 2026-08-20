/**
 * Öffentliche API des Channel-Systems (Server Functions).
 *
 * Die Oberfläche importiert ausschließlich diese Datei; die Datenlogik liegt
 * in `channels.server.ts` und wird erst im Handler geladen.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Alle aktiven Kategorien (flach, Hierarchie über `parentCategoryId`). */
export const listChannelCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const api = await import("./channels.server");
    return api.listCategories(context.supabase);
  });

/** Channel-Suche über Name, Slug, Kategorie und Unterkategorien. */
export const searchChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        q: z.string().max(80).default(""),
        limit: z.number().int().optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.searchChannels(context.supabase, data.q, data.limit ?? 20, data.offset ?? 0);
  });

/** Beliebteste Channels (Trending-Basis). */
export const listTrendingChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ limit: z.number().int().optional(), offset: z.number().int().min(0).optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.listTrendingChannels(context.supabase, data.limit ?? 20, data.offset ?? 0);
  });

/** Channels des angemeldeten Nutzers (gefolgt). */
export const listFollowedChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const api = await import("./channels.server");
    return api.listFollowedChannels(context.supabase, context.userId);
  });

/** Channel anlegen (Eigentümer ist immer der angemeldete Nutzer). */
export const createChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().min(1).max(60),
        categoryId: z.string().uuid().nullable().optional(),
        description: z.string().max(500).nullable().optional(),
        icon: z.string().max(40).nullable().optional(),
        region: z.string().max(80).nullable().optional(),
        isPublic: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.createChannel(context.supabase, context.userId, data);
  });

/** Channel bearbeiten (Eigentümer oder Admin – über RLS abgesichert). */
export const updateChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        channelId: z.string().uuid(),
        name: z.string().min(1).max(60).optional(),
        description: z.string().max(500).nullable().optional(),
        icon: z.string().max(40).nullable().optional(),
        imageUrl: z.string().url().nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        region: z.string().max(80).nullable().optional(),
        isPublic: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { channelId, ...patch } = data;
    const api = await import("./channels.server");
    return api.updateChannel(context.supabase, channelId, patch);
  });

/** Channel aktivieren bzw. deaktivieren. */
export const setChannelActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ channelId: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.setChannelActive(context.supabase, data.channelId, data.active);
  });

/** Channel folgen bzw. entfolgen. */
export const setChannelFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ channelId: z.string().uuid(), follow: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.setChannelFollow(context.supabase, context.userId, data.channelId, data.follow);
  });

/** Beiträge nach Channel bzw. (Unter-)Kategorie filtern. */
export const listChannelPostIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        channelId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        limit: z.number().int().optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.listChannelPostIds(
      context.supabase,
      { channelId: data.channelId, categoryId: data.categoryId },
      data.limit ?? 60,
      data.offset ?? 0,
    );
  });

/* ------------------------------------------------------------------ */
/* Channel-Verwaltung (Owner / Moderator)                              */
/* ------------------------------------------------------------------ */

/** Channels, die der angemeldete Nutzer verwaltet (owner/moderator). */
export const listManagedChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const api = await import("./channels.server");
    return api.listManagedChannels(context.supabase, context.userId);
  });

/** Einzelnen Channel laden. */
export const getChannel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ channelId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.getChannel(context.supabase, data.channelId);
  });

/** Beitraege des Channels fuer die Moderationsliste. */
export const listChannelModerationPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        channelId: z.string().uuid(),
        limit: z.number().int().optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.listChannelModerationPosts(
      context.supabase,
      data.channelId,
      data.limit ?? 30,
      data.offset ?? 0,
    );
  });

/**
 * Moderationsaktion. `remove` entfernt ausschliesslich die Channel-Zuordnung –
 * Beitrag und SlangTags bleiben im normalen Feed erhalten.
 */
export const moderateChannelPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        postId: z.string().uuid(),
        action: z.enum(["approve", "remove", "pin", "unpin"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.moderateChannelPost(context.supabase, data.postId, data.action);
  });

/** Follower des Channels (nur Owner/Moderatoren). */
export const listChannelFollowers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        channelId: z.string().uuid(),
        limit: z.number().int().optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.listChannelFollowers(
      context.supabase,
      data.channelId,
      data.limit ?? 50,
      data.offset ?? 0,
    );
  });

/** Channel-Team (Owner + Moderatoren). */
export const listChannelMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ channelId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.listChannelMembers(context.supabase, data.channelId);
  });

/** Moderator hinzufuegen (nur Owner – RLS erzwingt das). */
export const addChannelModerator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ channelId: z.string().uuid(), username: z.string().min(1).max(40) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.addChannelModerator(context.supabase, data.channelId, data.username, context.userId);
  });

/** Moderator entfernen (nur Owner – RLS erzwingt das). */
export const removeChannelMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ channelId: z.string().uuid(), userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.removeChannelMember(context.supabase, data.channelId, data.userId);
  });

/** Nutzer fuer den Channel sperren bzw. entsperren. */
export const setChannelBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        channelId: z.string().uuid(),
        userId: z.string().uuid(),
        banned: z.boolean(),
        reason: z.string().max(300).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.setChannelBan(
      context.supabase,
      data.channelId,
      data.userId,
      data.banned,
      context.userId,
      data.reason ?? null,
    );
  });

/** Gesperrte Nutzer eines Channels. */
export const listChannelBans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ channelId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.listChannelBans(context.supabase, data.channelId);
  });
