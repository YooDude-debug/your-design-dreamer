/**
 * Öffentliche API des Feed-Algorithmus (Server Functions).
 *
 * Nur diese Datei wird von der Oberfläche importiert; die Implementierung
 * liegt in `feed-ranking/engine.server.ts` und wird erst im Handler geladen.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FeedSignalInput } from "./feed-ranking/types";

/** Ranking-Kontext des angemeldeten Nutzers (Interessen, Region, Gelerntes). */
export const getFeedContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const engine = await import("./feed-ranking/engine.server");
    return engine.loadViewerContext(context.supabase, context.userId);
  });

/** Einzelnes Interaktionssignal protokollieren und Gewichte anpassen. */
export const recordFeedSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: FeedSignalInput) => data)
  .handler(async ({ data, context }) => {
    const engine = await import("./feed-ranking/engine.server");
    return engine.recordSignal(context.supabase, context.userId, data);
  });

/** Mehrere Signale gebündelt senden (Batching beim Scrollen). */
export const recordFeedSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { signals: FeedSignalInput[] }) => data)
  .handler(async ({ data, context }) => {
    const engine = await import("./feed-ranking/engine.server");
    let updated = 0;
    for (const signal of data.signals.slice(0, 50)) {
      const result = await engine.recordSignal(context.supabase, context.userId, signal);
      updated += result.updated;
    }
    return { ok: true, updated };
  });

/**
 * Datenschutz: gelernte Gewichte, Signale und Score-Cache löschen.
 * Beiträge, Likes, Kommentare und Follower bleiben erhalten.
 */
export const resetFeedAlgorithm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const engine = await import("./feed-ranking/engine.server");
    return engine.resetFeedAlgorithm(context.supabase, context.userId);
  });
