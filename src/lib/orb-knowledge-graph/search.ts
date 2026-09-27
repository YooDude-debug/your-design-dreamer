/**
 * Memory-Suche für die Knowledge-Graph-Experimentseite (nur Lesen, rein).
 *
 * Provenienz:
 * - Suchtreffer: Textvergleich im Browser (content/topic/category) – "abgeleitet".
 *   Das ist KEIN ORB-Retrieval.
 * - Nodes und Kanten im Pfad: tatsächlich gespeicherte orb_nodes/orb_connections.
 * - Pfad-Reihenfolge: Breitensuche über gespeicherte Kanten – "abgeleitet".
 * Räumliche Nähe in der 3D-Ansicht wird nie verwendet.
 */

import type { KgEdge, KgGraph, KgNode } from "@/lib/orb-knowledge-graph.functions";

export const MAX_HITS = 12;
export const MAX_DEPTH = 2;
export const MAX_PATH_NODES = 40;

export type KgSearchHit = { id: string; fields: ("content" | "topic" | "category")[] };

export type KgPathStep =
  | { kind: "hit"; nodeId: string }
  | { kind: "edge"; edgeId: string; from: string; to: string; depth: number };

export type KgSearchResult = {
  query: string;
  terms: string[];
  hits: KgSearchHit[];
  /** Alle sichtbar bleibenden Nodes (Treffer + über echte Kanten erreichbar). */
  nodeIds: string[];
  edgeIds: string[];
  /** Reihenfolge für die Animation. */
  steps: KgPathStep[];
  truncated: boolean;
};

const norm = (s: string) =>
  s
    .toLocaleLowerCase("de")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

export function searchTerms(query: string): string[] {
  return [...new Set(norm(query).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2))];
}

function matchFields(n: KgNode, terms: string[]): KgSearchHit["fields"] {
  const out: KgSearchHit["fields"] = [];
  const check = (v: string | null, f: KgSearchHit["fields"][number]) => {
    if (v && terms.some((t) => norm(v).includes(t))) out.push(f);
  };
  check(n.content, "content");
  check(n.topic, "topic");
  check(n.category, "category");
  return out;
}

export function searchGraph(graph: KgGraph, query: string): KgSearchResult | null {
  const terms = searchTerms(query);
  if (!terms.length) return null;

  const hits: KgSearchHit[] = [];
  for (const n of graph.nodes) {
    const fields = matchFields(n, terms);
    if (fields.length) hits.push({ id: n.id, fields });
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  hits.sort(
    (a, b) =>
      b.fields.length - a.fields.length ||
      (byId.get(b.id)?.importance ?? 0) - (byId.get(a.id)?.importance ?? 0) ||
      a.id.localeCompare(b.id),
  );
  const top = hits.slice(0, MAX_HITS);

  const adj = new Map<string, KgEdge[]>();
  for (const e of graph.edges) {
    if (!byId.has(e.sourceNodeId) || !byId.has(e.targetNodeId)) continue;
    for (const k of [e.sourceNodeId, e.targetNodeId]) {
      const l = adj.get(k);
      if (l) l.push(e);
      else adj.set(k, [e]);
    }
  }

  const seen = new Set<string>();
  const edgeSeen = new Set<string>();
  const steps: KgPathStep[] = [];
  let truncated = hits.length > top.length;
  let frontier: string[] = [];
  for (const h of top) {
    seen.add(h.id);
    steps.push({ kind: "hit", nodeId: h.id });
    frontier.push(h.id);
  }
  for (let depth = 1; depth <= MAX_DEPTH && frontier.length; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      const list = [...(adj.get(id) ?? [])].sort((a, b) => b.weight - a.weight);
      for (const e of list) {
        if (edgeSeen.has(e.id)) continue;
        const other = e.sourceNodeId === id ? e.targetNodeId : e.sourceNodeId;
        if (!seen.has(other) && seen.size >= MAX_PATH_NODES) {
          truncated = true;
          continue;
        }
        edgeSeen.add(e.id);
        steps.push({ kind: "edge", edgeId: e.id, from: id, to: other, depth });
        if (!seen.has(other)) {
          seen.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
  }

  return {
    query,
    terms,
    hits: top,
    nodeIds: [...seen],
    edgeIds: [...edgeSeen],
    steps,
    truncated,
  };
}
