/**
 * ORB – „Nicht zugeordnet – historische Daten“ (nur Admins, nur lesend).
 *
 * Liest ausschließlich eigene Zeilen mit scope = 'unassigned' (Altbestand vor
 * Einführung der Bereiche). Keine Schreiboperation, keine Zuordnung, keine
 * Vermischung mit normal / orb_core / y_dude. IDs bleiben unverändert.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { internalError } from "@/orb-core/internal-error";

export const UNASSIGNED_SCOPE = "unassigned" as const;
export const UNASSIGNED_PAGE_SIZE = 50;
export const UNASSIGNED_KINDS = ["memories", "connections", "threads", "messages"] as const;
export type UnassignedKind = (typeof UNASSIGNED_KINDS)[number];

const input = z.object({
  kind: z.enum(UNASSIGNED_KINDS),
  page: z.number().int().min(0).max(10_000),
});

export type UnassignedPage = {
  kind: UnassignedKind;
  page: number;
  total: number | null;
  rows: Record<string, string | number | boolean | null | string[]>[];
};

const SPEC: Record<UnassignedKind, { table: string; columns: string; order: string }> = {
  memories: {
    table: "orb_nodes",
    columns: "id,type,content,topic,source,importance,confidence,lifecycle,created_at",
    order: "created_at",
  },
  connections: {
    table: "orb_connections",
    columns: "id,source_node_id,target_node_id,weight,importance,activation_count,created_at",
    order: "created_at",
  },
  threads: {
    table: "orb_threads",
    columns: "id,title,topic,status,node_ids,activation_count,created_at",
    order: "created_at",
  },
  messages: {
    table: "orb_messages",
    columns: "id,role,body,decision,created_at",
    order: "created_at",
  },
};

export const getOrbUnassignedPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }): Promise<UnassignedPage> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const spec = SPEC[data.kind];
    const from = data.page * UNASSIGNED_PAGE_SIZE;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (context.supabase as any)
      .from(spec.table)
      .select(spec.columns, { count: "exact" })
      .eq("user_id", context.userId)
      .eq("scope", UNASSIGNED_SCOPE)
      .order(spec.order, { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + UNASSIGNED_PAGE_SIZE - 1);
    if (res.error) throw internalError(res.error);
    return {
      kind: data.kind,
      page: data.page,
      total: typeof res.count === "number" ? res.count : null,
      rows: (res.data ?? []) as UnassignedPage["rows"],
    };
  });
