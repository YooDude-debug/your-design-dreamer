/**
 * ORB Visual Memory – Serverfunktionen (angemeldet, RLS, Scope je Zugriff).
 *
 * Der Bereich einer Erinnerung wird serverseitig aus der eigenen Zeile gelesen
 * (nie vom Browser übernommen); alle weiteren Zugriffe laufen bereichsgebunden.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { orbChatScopeSchema } from "@/orb-core/scope";
import type { DB } from "@/orb-core/engine.server";

const DATA_SCOPES = ["normal", "orb_core", "y_dude", "unassigned"] as const;
type DataScope = (typeof DATA_SCOPES)[number];

async function memoryScope(db: DB, userId: string, memoryId: string): Promise<DataScope | null> {
  const res = await db
    .from("orb_nodes")
    .select("scope")
    .eq("id", memoryId)
    .eq("user_id", userId)
    .maybeSingle();
  const s = res.data?.scope as string | undefined;
  return s && (DATA_SCOPES as readonly string[]).includes(s) ? (s as DataScope) : null;
}

async function scoped(db: DB, scope: DataScope) {
  const { scopedDb } = await import("@/orb-core/scope");
  return scopedDb(db, scope);
}

const memoryInput = z.object({ memoryId: z.string().uuid() });
const linkInput = z.object({ memoryId: z.string().uuid(), assetId: z.string().uuid() });

/** Bilder einer Erinnerung + nicht zugeordnete Bilder desselben Bereichs. */
export const getOrbMemoryImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => memoryInput.parse(d))
  .handler(async ({ data, context }) => {
    const scope = await memoryScope(context.supabase, context.userId, data.memoryId);
    if (!scope) return { scope: null, linked: [], unassigned: [] };
    const v = await import("@/orb-core/visual/assets.server");
    const db = await scoped(context.supabase, scope);
    const [linked, unassigned] = await Promise.all([
      v.listMemoryImages(db, context.userId, data.memoryId),
      v.listUnassignedImages(db, context.userId),
    ]);
    return { scope, linked, unassigned };
  });

export const linkOrbMemoryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => linkInput.parse(d))
  .handler(async ({ data, context }) => {
    const scope = await memoryScope(context.supabase, context.userId, data.memoryId);
    if (!scope) return { ok: false as const, reason: "rejected" as const };
    const v = await import("@/orb-core/visual/assets.server");
    return v.linkMemoryImage(await scoped(context.supabase, scope), {
      userId: context.userId,
      memoryId: data.memoryId,
      assetId: data.assetId,
      basis: "manual",
    });
  });

export const unlinkOrbMemoryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => linkInput.parse(d))
  .handler(async ({ data, context }) => {
    const scope = await memoryScope(context.supabase, context.userId, data.memoryId);
    if (!scope) return { ok: false };
    const v = await import("@/orb-core/visual/assets.server");
    return v.unlinkMemoryImage(await scoped(context.supabase, scope), {
      userId: context.userId,
      memoryId: data.memoryId,
      assetId: data.assetId,
    });
  });

/** Nicht zugeordnete Bilder eines Chat-Bereichs. */
export const listOrbUnassignedImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scope: orbChatScopeSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const v = await import("@/orb-core/visual/assets.server");
    return v.listUnassignedImages(await scoped(context.supabase, data.scope), context.userId);
  });

/** Bild löschen (Speicherobjekt + Zeile; Verknüpfungen kaskadieren). */
export const deleteOrbVisualAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ assetId: z.string().uuid(), scope: z.enum(DATA_SCOPES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const v = await import("@/orb-core/visual/assets.server");
    return v.deleteVisualAsset(
      await scoped(context.supabase, data.scope),
      context.userId,
      data.assetId,
    );
  });
