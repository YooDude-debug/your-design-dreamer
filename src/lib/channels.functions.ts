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
      .object({ q: z.string().max(80).default(""), limit: z.number().int().optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.searchChannels(context.supabase, data.q, data.limit ?? 20);
  });

/** Beliebteste Channels (Trending-Basis). */
export const listTrendingChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ limit: z.number().int().optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.listTrendingChannels(context.supabase, data.limit ?? 20);
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
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./channels.server");
    return api.listChannelPostIds(
      context.supabase,
      { channelId: data.channelId, categoryId: data.categoryId },
      data.limit ?? 60,
    );
  });
