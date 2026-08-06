/**
 * Öffentliche API des Hashtag-Systems (Server Functions).
 *
 * Die Oberfläche importiert ausschließlich diese Datei; die Implementierung
 * liegt in `hashtags.server.ts` und wird erst im Handler geladen.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Hashtag-Suche (eigener Index, unabhängig von der SlangTag-Suche). */
export const searchHashtags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ q: z.string().max(80).default(""), limit: z.number().int().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./hashtags.server");
    return api.searchHashtags(context.supabase, data.q, data.limit ?? 20);
  });

/** Eigene Trendliste der Hashtags. */
export const getTrendingHashtags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ days: z.number().int().optional(), limit: z.number().int().optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./hashtags.server");
    return api.getTrendingHashtags(context.supabase, data.days ?? 7, data.limit ?? 10);
  });

/** Beiträge eines Hashtags über den Index (Hashtag-Seite). */
export const getHashtagPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ tag: z.string().min(1).max(80), limit: z.number().int().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./hashtags.server");
    return api.getHashtagPage(context.supabase, context.userId, data.tag, data.limit ?? 60);
  });

/** Hashtag folgen bzw. entfolgen (eigenes Ranking-Signal). */
export const setHashtagFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ tag: z.string().min(1).max(80), follow: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./hashtags.server");
    return api.setHashtagFollow(context.supabase, context.userId, data.tag, data.follow);
  });

/** Alle gefolgten Hashtags des angemeldeten Nutzers. */
export const listFollowedHashtags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const api = await import("./hashtags.server");
    return api.listFollowedHashtags(context.supabase, context.userId);
  });
