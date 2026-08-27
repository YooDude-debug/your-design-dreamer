/**
 * Gemeinsames Eingabeschema der Market-Suche.
 *
 * Liegt bewusst NICHT in `market.functions.ts`: Dateien mit `createServerFn`
 * werden beim Build in ein separates Server-Modul aufgeteilt, wobei Laufzeit-
 * Geschwister im Modulkopf entfernt werden. Ein solches Modul kann dann nicht
 * geladen werden und der Aufruf scheitert mit "Invalid server function ID".
 */

import { z } from "zod";

export const marketSearchInput = z.object({
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

export type MarketSearchInput = z.infer<typeof marketSearchInput>;

export function toMarketSearchRequest(data: MarketSearchInput) {
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
