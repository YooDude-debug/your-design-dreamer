/**
 * Öffentliche API von Y-Dude Market (Server Functions).
 *
 * Die Oberfläche importiert ausschließlich diese Datei; die Datenlogik liegt in
 * `market.server.ts` und wird erst im Handler geladen.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Alle aktiven Market-Kategorien (flach, sortiert). */
export const listMarketCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const api = await import("./market.server");
    return api.listCategories(context.supabase);
  });

/** Artikelsuche mit Volltext-, Kategorie-, Preis- und Bildfilter. */
export const searchMarketItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        q: z.string().max(120).default(""),
        categoryId: z.string().uuid().nullish(),
        priceMinCents: z.number().int().nullish(),
        priceMaxCents: z.number().int().nullish(),
        withImageOnly: z.boolean().default(false),
        /** "me" = eigene Artikel (inkl. deaktivierter). */
        mine: z.boolean().default(false),
        limit: z.number().int().min(1).max(40).default(20),
        offset: z.number().int().min(0).default(0),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market.server");
    return api.searchItems(context.supabase, {
      q: data.q,
      categoryId: data.categoryId ?? null,
      priceMinCents: data.priceMinCents ?? null,
      priceMaxCents: data.priceMaxCents ?? null,
      withImageOnly: data.withImageOnly,
      sellerId: data.mine ? context.userId : null,
      limit: data.limit,
      offset: data.offset,
    });
  });

/** Artikel-Detailseite. */
export const getMarketItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ itemId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./market.server");
    return api.getItem(context.supabase, data.itemId, context.userId);
  });

/** Artikel einstellen (Verkäufer ist immer der angemeldete Nutzer). */
export const createMarketItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        title: z.string().trim().min(3).max(120),
        description: z.string().max(4000).default(""),
        priceCents: z.number().int().min(0).max(100_000_000).default(0),
        negotiable: z.boolean().default(true),
        categoryId: z.string().uuid(),
        condition: z.enum(["new", "like_new", "good", "used"]).default("good"),
        delivery: z.enum(["pickup", "shipping", "both"]).default("pickup"),
        place: z.string().max(160).nullish(),
        postalCode: z.string().max(16).nullish(),
        lat: z.number().nullish(),
        lon: z.number().nullish(),
        imagePaths: z.array(z.string().max(300)).max(8).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market.server");
    const id = await api.createItem(context.supabase, context.userId, {
      title: data.title,
      description: data.description,
      priceCents: data.priceCents,
      negotiable: data.negotiable,
      categoryId: data.categoryId,
      condition: data.condition,
      delivery: data.delivery,
      place: data.place ?? null,
      postalCode: data.postalCode ?? null,
      lat: data.lat ?? null,
      lon: data.lon ?? null,
      imagePaths: data.imagePaths,
    });
    return { id };
  });

/** Status setzen (aktiv / reserviert / verkauft / deaktiviert / gelöscht). */
export const setMarketItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        itemId: z.string().uuid(),
        status: z.enum(["active", "reserved", "sold", "disabled", "deleted"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market.server");
    await api.setItemStatus(context.supabase, context.userId, data.itemId, data.status);
    return { ok: true };
  });

/** Artikel merken / Merken aufheben. */
export const toggleMarketFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ itemId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./market.server");
    const favorited = await api.toggleFavorite(context.supabase, context.userId, data.itemId);
    return { favorited };
  });
