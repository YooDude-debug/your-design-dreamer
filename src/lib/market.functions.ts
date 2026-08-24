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
        slangTagIds: z.array(z.string().uuid()).max(5).default([]),
        channelIds: z.array(z.string().uuid()).max(3).default([]),
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
      slangTagIds: data.slangTagIds,
      channelIds: data.channelIds,
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

/* ------------------------- Phase 2: Messenger & Angebote --------------------- */

/** Artikel-Kontext an eine bestehende Unterhaltung haengen (idempotent). */
export const attachMarketContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ conversationId: z.string().uuid(), itemId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-chat.server");
    return api.attachItemContext(context.supabase, context.userId, data.conversationId, data.itemId);
  });

/** Kompakte Artikeldaten fuer Chatkarten. */
export const getMarketChatItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ itemIds: z.array(z.string().uuid()).max(30).default([]) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-chat.server");
    return api.chatItems(context.supabase, data.itemIds);
  });

/** Alle Angebote einer Unterhaltung. */
export const listConversationOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ conversationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./market-chat.server");
    return api.offersForConversation(context.supabase, data.conversationId);
  });

/** Eigene bzw. erhaltene Angebote (Mein Market). */
export const listMyOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ role: z.enum(["buyer", "seller"]) }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./market-chat.server");
    return api.offersForUser(context.supabase, context.userId, data.role);
  });

/** Preisangebot abgeben (Kaeufer = angemeldeter Nutzer). */
export const createMarketOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        itemId: z.string().uuid(),
        conversationId: z.string().uuid(),
        amountCents: z.number().int().min(0).max(100_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-chat.server");
    return api.createOffer(context.supabase, context.userId, data);
  });

/** Angebot annehmen / ablehnen / zurueckziehen (Rechte serverseitig geprueft). */
export const respondMarketOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        offerId: z.string().uuid(),
        action: z.enum(["accept", "decline", "withdraw"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-chat.server");
    return api.respondOffer(context.supabase, data.offerId, data.action);
  });

/* --------------------- Phase 2: SlangTags, Channels, Favoriten --------------- */

/** SlangTags eines Artikels setzen. */
export const setMarketItemSlangTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ itemId: z.string().uuid(), tagIds: z.array(z.string().uuid()).max(10).default([]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-link.server");
    const ids = await api.setItemSlangTags(context.supabase, context.userId, data.itemId, data.tagIds);
    return { tagIds: ids };
  });

/** Passende Channels vorschlagen. */
export const suggestMarketChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        title: z.string().max(120).default(""),
        description: z.string().max(400).default(""),
        categoryName: z.string().max(80).default(""),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-link.server");
    return api.suggestChannelsForItem(context.supabase, data);
  });

/** Artikel mit Channels verknuepfen (max. 3). */
export const setMarketItemChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        itemId: z.string().uuid(),
        channelIds: z.array(z.string().uuid()).max(10).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-link.server");
    const ids = await api.setItemChannels(context.supabase, context.userId, data.itemId, data.channelIds);
    return { channelIds: ids };
  });

/** Market-Artikel eines Channels (Channel-Tab, seitenweise). */
export const listChannelMarketItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        channelId: z.string().uuid(),
        limit: z.number().int().min(1).max(20).default(10),
        offset: z.number().int().min(0).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-link.server");
    return api.channelMarketItems(context.supabase, data.channelId, data.limit, data.offset);
  });

/** Regelbasiertes Market-Matching fuer suchaehnliche Beitraege. */
export const matchMarketForText = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ text: z.string().max(400).default(""), limit: z.number().int().min(1).max(10).default(6) })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-link.server");
    return api.matchMarketItems(context.supabase, data.text, data.limit);
  });

/** Eigene Merkliste. */
export const listMarketFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const api = await import("./market-link.server");
    return api.favoriteItems(context.supabase, context.userId);
  });

/* --------------------------- Phase 3: Suche & Matching ----------------------- */

/**
 * Gemeinsames Eingabeschema der Phase-3-Suche. Alle Werte werden serverseitig
 * begrenzt – der Client kann weder beliebige Preise noch beliebige Radien
 * erzwingen und das Ranking nicht beeinflussen.
 */
const searchInput = z.object({
  q: z.string().max(200).default(""),
  categoryId: z.string().uuid().nullish(),
  priceMinCents: z.number().int().min(0).max(100_000_000).nullish(),
  priceMaxCents: z.number().int().min(0).max(100_000_000).nullish(),
  withImageOnly: z.boolean().default(false),
  lat: z.number().min(-90).max(90).nullish(),
  lon: z.number().min(-180).max(180).nullish(),
  radiusKm: z.number().min(1).max(500).nullish(),
  limit: z.number().int().min(1).max(20).default(20),
  offset: z.number().int().min(0).max(200).default(0),
});

function toRequest(data: z.infer<typeof searchInput>) {
  return {
    q: data.q,
    categoryId: data.categoryId ?? null,
    priceMinCents: data.priceMinCents ?? null,
    priceMaxCents: data.priceMaxCents ?? null,
    withImageOnly: data.withImageOnly,
    lat: data.lat ?? null,
    lon: data.lon ?? null,
    radiusKm: data.radiusKm ?? null,
    limit: data.limit,
    offset: data.offset,
  };
}

/** Strukturierte Market-Suche mit Relevanz-Ranking. */
export const searchMarketSmart = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => searchInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const api = await import("./market-search.server");
    return api.searchMarket(context.supabase, toRequest(data));
  });

/** Eine Suche, mehrere Bereiche: Market, Channels, SlangTags. */
export const searchMarketEverything = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => searchInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const api = await import("./market-search.server");
    return api.searchEverything(context.supabase, toRequest(data));
  });

/** „Das könnte dich auch interessieren“ auf der Artikelseite. */
export const getSimilarMarketItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ itemId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./market-search.server");
    return api.similarItems(context.supabase, data.itemId);
  });

/** Gespeicherte Suchen des angemeldeten Nutzers. */
export const listMarketSavedSearches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const api = await import("./market-search.server");
    return api.listSavedSearches(context.supabase, context.userId);
  });

/** Aktuelle Suche speichern (Benachrichtigungen zunächst aktiv). */
export const saveMarketSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => searchInput.extend({ label: z.string().max(120).nullish() }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./market-search.server");
    return api.saveSearch(context.supabase, context.userId, toRequest(data), data.label ?? undefined);
  });

/** Gespeicherte Suche umbenennen oder Benachrichtigungen umschalten. */
export const updateMarketSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().max(120).optional(),
        notify: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const api = await import("./market-search.server");
    await api.updateSavedSearch(context.supabase, context.userId, data.id, {
      label: data.label,
      notify: data.notify,
    });
    return { ok: true };
  });

/** Gespeicherte Suche löschen. */
export const deleteMarketSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const api = await import("./market-search.server");
    await api.deleteSavedSearch(context.supabase, context.userId, data.id);
    return { ok: true };
  });
