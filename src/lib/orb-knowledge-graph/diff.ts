/**
 * Reiner Vergleich zweier gelesener Graph-Stände.
 *
 * "Aktiv" wird NUR gemeldet, wenn ORB selbst einen gespeicherten Wert
 * verändert hat (activation_count erhöht bzw. last_accessed_at /
 * last_activated_at / last_activation_at neuer). Keine Vermutung, keine
 * Ableitung aus Textähnlichkeit.
 */

import type { KgGraph } from "@/lib/orb-knowledge-graph.functions";

export type KgEvidence = "activation_count" | "last_accessed_at" | "new_record";

export type KgActivationEvent = {
  detectedAt: string;
  /** Lesezeitpunkt davor / danach – das echte Ereignis liegt dazwischen. */
  windowFrom: string;
  windowTo: string;
  nodes: { id: string; evidence: KgEvidence[]; storedAt: string }[];
  edges: { id: string; evidence: KgEvidence[]; storedAt: string }[];
  threads: { id: string; storedAt: string }[];
  lastOrbMessageChanged: boolean;
};

const t = (iso: string) => new Date(iso).getTime();

export function diffGraphs(prev: KgGraph, next: KgGraph): KgActivationEvent | null {
  const prevNodes = new Map(prev.nodes.map((n) => [n.id, n]));
  const prevEdges = new Map(prev.edges.map((e) => [e.id, e]));
  const prevThreads = new Map(prev.threads.map((x) => [x.id, x]));

  const nodes: KgActivationEvent["nodes"] = [];
  for (const n of next.nodes) {
    const p = prevNodes.get(n.id);
    const ev: KgEvidence[] = [];
    if (!p) ev.push("new_record");
    else {
      if (n.activationCount > p.activationCount) ev.push("activation_count");
      if (t(n.lastAccessedAt) > t(p.lastAccessedAt)) ev.push("last_accessed_at");
    }
    if (ev.length) nodes.push({ id: n.id, evidence: ev, storedAt: n.lastAccessedAt });
  }

  const edges: KgActivationEvent["edges"] = [];
  for (const e of next.edges) {
    const p = prevEdges.get(e.id);
    const ev: KgEvidence[] = [];
    if (!p) ev.push("new_record");
    else {
      if (e.activationCount > p.activationCount) ev.push("activation_count");
      if (t(e.lastActivatedAt) > t(p.lastActivatedAt)) ev.push("last_accessed_at");
    }
    if (ev.length) edges.push({ id: e.id, evidence: ev, storedAt: e.lastActivatedAt });
  }

  const threads: KgActivationEvent["threads"] = [];
  for (const x of next.threads) {
    const p = prevThreads.get(x.id);
    if (!p || t(x.lastActivationAt) > t(p.lastActivationAt)) {
      threads.push({ id: x.id, storedAt: x.lastActivationAt });
    }
  }

  const lastOrbMessageChanged =
    (next.lastOrbMessage?.id ?? null) !== (prev.lastOrbMessage?.id ?? null);

  if (!nodes.length && !edges.length && !threads.length && !lastOrbMessageChanged) return null;
  return {
    detectedAt: new Date().toISOString(),
    windowFrom: prev.readAt,
    windowTo: next.readAt,
    nodes,
    edges,
    threads,
    lastOrbMessageChanged,
  };
}
