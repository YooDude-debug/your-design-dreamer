/**
 * Öffentliche API der Interest Engine (Server Functions).
 *
 * Alle Funktionen sind UI-unabhängig und werden derzeit nirgends automatisch
 * aufgerufen – Feed, Werbe-Feed und Messenger bleiben unverändert.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ContentType, InteractionInput } from "./interest-engine/types";

export const recordInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: InteractionInput) => data)
  .handler(async ({ data, context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.recordInteraction(context.supabase, context.userId, data);
  });

export const getInterestProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.getInterestProfile(context.supabase, context.userId);
  });

export const calculateInterestScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { categoryId: string }) => data)
  .handler(async ({ data, context }) => {
    const engine = await import("./interest-engine/engine.server");
    return {
      categoryId: data.categoryId,
      score: await engine.calculateInterestScore(context.supabase, context.userId, data.categoryId),
    };
  });

export const updateInterestDecay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.updateInterestDecay(context.supabase, context.userId);
  });

export const calculateConnectionInfluence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.calculateConnectionInfluence(context.supabase, context.userId);
  });

export const setBaseInterests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { categoryIds: string[]; baseScore?: number }) => data)
  .handler(async ({ data, context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.setBaseInterests(context.supabase, context.userId, data.categoryIds, data.baseScore ?? 100);
  });

export const setContentCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contentType: ContentType; contentId: string; categoryIds: string[] }) => data)
  .handler(async ({ data, context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.setContentCategories(context.supabase, { ...data, ownerId: context.userId });
  });

export const listInterestCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.loadCategories(context.supabase);
  });

export const getRecommendedFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.getRecommendedFeed(context.supabase, context.userId, data.limit);
  });

export const getRecommendedAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.getRecommendedAds(context.supabase, context.userId, data.limit);
  });

export const getRecommendedSlangTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.getRecommendedSlangTags(context.supabase, context.userId, data.limit);
  });

export const getRecommendedCreators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.getRecommendedCreators(context.supabase, context.userId, data.limit);
  });

export const getRecommendedConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.getRecommendedConnections(context.supabase, context.userId, data.limit);
  });

export const getTrendingCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { days?: number; limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const engine = await import("./interest-engine/engine.server");
    return engine.getTrendingCategories(context.supabase, data.days ?? 7, data.limit ?? 10);
  });
