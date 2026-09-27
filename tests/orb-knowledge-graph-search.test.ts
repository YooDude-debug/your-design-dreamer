import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { searchGraph, searchTerms } from "@/lib/orb-knowledge-graph/search";
import type { KgGraph, KgNode } from "@/lib/orb-knowledge-graph.functions";

const node = (id: string, content: string, extra: Partial<KgNode> = {}): KgNode => ({
  id,
  type: "fact",
  content,
  topic: null,
  category: null,
  source: "user",
  importance: 0.5,
  confidence: 0.5,
  lifecycle: "active",
  activationCount: 1,
  lastAccessedAt: "2026-09-27T04:00:00.000Z",
  createdAt: "2026-09-26T00:00:00.000Z",
  ...extra,
});
const edge = (id: string, s: string, t: string, weight = 0.5) => ({
  id,
  sourceNodeId: s,
  targetNodeId: t,
  storedWeight: weight,
  weight,
  strong: false,
  activationCount: 1,
  lastActivatedAt: "2026-09-27T04:00:00.000Z",
});
const g = (): KgGraph => ({
  readAt: "2026-09-27T05:00:00.000Z",
  state: null,
  lastOrbMessage: null,
  threads: [],
  nodes: [
    node("a", "Ich habe zwei Kinder"),
    node("b", "Schule"),
    node("c", "Ferien"),
    node("d", "Auto", { topic: "Kinder" }),
    node("x", "unverbunden"),
  ],
  edges: [edge("e1", "a", "b"), edge("e2", "b", "c"), edge("e3", "c", "x")],
});

describe("Knowledge-Graph-Suche", () => {
  it("normalisiert Suchbegriffe", () => {
    expect(searchTerms("  KINDER, Schüle ")).toEqual(["kinder", "schule"]);
    expect(searchGraph(g(), " ")).toBeNull();
  });
  it("findet Treffer in Inhalt und Thema", () => {
    const r = searchGraph(g(), "kinder")!;
    expect(r.hits.map((h) => h.id).sort()).toEqual(["a", "d"]);
    expect(r.hits.find((h) => h.id === "d")!.fields).toEqual(["topic"]);
  });
  it("folgt nur gespeicherten Kanten, höchstens 2 Stufen", () => {
    const r = searchGraph(g(), "kinder")!;
    expect(r.nodeIds.sort()).toEqual(["a", "b", "c", "d"]);
    expect(r.edgeIds).toEqual(["e1", "e2"]);
    expect(r.nodeIds).not.toContain("x");
    const edges = r.steps.filter((s) => s.kind === "edge");
    expect(edges.map((s) => s.kind === "edge" && s.depth)).toEqual([1, 2]);
  });
  it("erzeugt ohne Treffer keinen künstlichen Pfad", () => {
    const r = searchGraph(g(), "zebra")!;
    expect(r.hits).toEqual([]);
    expect(r.steps).toEqual([]);
  });
  it("verändert die Eingabedaten nicht und schreibt nichts", () => {
    const d = g();
    const before = JSON.stringify(d);
    searchGraph(d, "kinder schule");
    expect(JSON.stringify(d)).toBe(before);
    const src = readFileSync("src/lib/orb-knowledge-graph/search.ts", "utf8");
    expect(src).not.toMatch(/supabase|fetch\(|createServerFn/);
  });
});
