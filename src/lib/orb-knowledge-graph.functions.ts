/**
 * ORB Knowledge Graph – Experiment (nur Admins, nur Lesen).
 *
 * Bewusst NICHT über `getOrbSnapshot`: dieser Aufruf schreibt bei jedem Lesen
 * Kennzahlen in `orb_state` (decay_computations, energy). Das Experiment darf
 * produktive ORB-Daten nicht verändern und liest deshalb ausschliesslich mit
 * SELECT. Gewicht W(t) und Energie werden mit den reinen Core-Funktionen
 * berechnet, nicht neu erfunden.
 */

import { createServerFn } from "@tanstack/react-start";
import { internalError } from "@/orb-core/internal-error";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KgNode = {
  id: string;
  type: string;
  content: string;
  topic: string | null;
  category: string | null;
  source: string;
  importance: number;
  confidence: number;
  lifecycle: string;
  activationCount: number;
  lastAccessedAt: string;
  createdAt: string;
};

export type KgEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  storedWeight: number;
  weight: number;
  strong: boolean;
  activationCount: number;
  lastActivatedAt: string;
};

export type KgThread = {
  id: string;
  title: string;
  topic: string | null;
  status: string;
  nodeIds: string[];
  activationCount: number;
  lastActivationAt: string;
};

export type KgGraph = {
  readAt: string;
  state: { energy: number; curiosity: number; updatedAt: string } | null;
  lastOrbMessage: { id: string; decision: string | null; createdAt: string } | null;
  nodes: KgNode[];
  edges: KgEdge[];
  threads: KgThread[];
  /** Tatsächliche Anzahl in der DB (read-only count), null = nicht verfügbar. */
  nodesTotal: number | null;
  edgesTotal: number | null;
  /** Obergrenze der geladenen/visualisierten Einträge. */
  nodesLimit: number;
  edgesLimit: number;
};

export const KG_NODE_LIMIT = 400;
export const KG_EDGE_LIMIT = 1500;

export const getOrbKnowledgeGraph = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KgGraph> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { currentWeight, isStrong, recoverEnergy } = await import("@/orb-core/core");
    const db = context.supabase;
    const uid = context.userId;
    const now = Date.now();

    const [nodesRes, edgesRes, threadsRes, stateRes, msgRes] = await Promise.all([
      db
        .from("orb_nodes")
        .select(
          "id,type,content,topic,category,source,importance,confidence,lifecycle,activation_count,last_accessed_at,created_at",
          { count: "exact" },
        )
        .eq("user_id", uid)
        .limit(KG_NODE_LIMIT),
      db
        .from("orb_connections")
        .select(
          "id,source_node_id,target_node_id,weight,importance,decay_rate,activation_count,last_activated_at",
          { count: "exact" },
        )
        .eq("user_id", uid)
        .limit(KG_EDGE_LIMIT),
      db
        .from("orb_threads")
        .select("id,title,topic,status,node_ids,activation_count,last_activation_at")
        .eq("user_id", uid)
        .limit(100),
      db.from("orb_state").select("energy,curiosity,updated_at").eq("user_id", uid).maybeSingle(),
      db
        .from("orb_messages")
        .select("id,decision,created_at")
        .eq("user_id", uid)
        .eq("role", "orb")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    for (const r of [nodesRes, edgesRes, threadsRes, stateRes, msgRes]) {
      if (r.error) throw internalError(r.error);
    }

    const s = stateRes.data;
    return {
      readAt: new Date(now).toISOString(),
      // Echte Gesamtzahlen aus derselben Abfrage (count: exact); null = nicht verfügbar.
      nodesTotal: typeof nodesRes.count === "number" ? nodesRes.count : null,
      edgesTotal: typeof edgesRes.count === "number" ? edgesRes.count : null,
      nodesLimit: KG_NODE_LIMIT,
      edgesLimit: KG_EDGE_LIMIT,
      state: s
        ? {
            energy: recoverEnergy(s.energy, new Date(s.updated_at).getTime(), now),
            curiosity: s.curiosity,
            updatedAt: s.updated_at,
          }
        : null,
      lastOrbMessage: msgRes.data
        ? { id: msgRes.data.id, decision: msgRes.data.decision, createdAt: msgRes.data.created_at }
        : null,
      nodes: (nodesRes.data ?? []).map((n) => ({
        id: n.id,
        type: n.type,
        content: n.content,
        topic: n.topic,
        category: n.category,
        source: n.source,
        importance: n.importance,
        confidence: n.confidence,
        lifecycle: n.lifecycle,
        activationCount: n.activation_count,
        lastAccessedAt: n.last_accessed_at,
        createdAt: n.created_at,
      })),
      edges: (edgesRes.data ?? []).map((c) => {
        const weight = currentWeight({
          weight: c.weight,
          importance: c.importance,
          decayRate: c.decay_rate,
          lastActivatedAt: new Date(c.last_activated_at).getTime(),
          now,
        });
        return {
          id: c.id,
          sourceNodeId: c.source_node_id,
          targetNodeId: c.target_node_id,
          storedWeight: c.weight,
          weight,
          strong: isStrong(weight),
          activationCount: c.activation_count,
          lastActivatedAt: c.last_activated_at,
        };
      }),
      threads: (threadsRes.data ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        topic: t.topic,
        status: t.status,
        nodeIds: t.node_ids ?? [],
        activationCount: t.activation_count,
        lastActivationAt: t.last_activation_at,
      })),
    };
  });
