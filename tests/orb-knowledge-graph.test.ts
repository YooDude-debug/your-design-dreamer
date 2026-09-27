import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diffGraphs } from "@/lib/orb-knowledge-graph/diff";
import type { KgGraph } from "@/lib/orb-knowledge-graph.functions";

const base = (): KgGraph => ({
  readAt: "2026-09-27T05:00:00.000Z",
  nodesTotal: null,
  edgesTotal: null,
  nodesLimit: 400,
  edgesLimit: 1500,
  state: { energy: 0.2, curiosity: 0.9, updatedAt: "2026-09-27T04:59:00.000Z" },
  lastOrbMessage: { id: "m1", decision: "answer", createdAt: "2026-09-27T04:58:00.000Z" },
  nodes: [
    {
      id: "a",
      type: "fact",
      content: "x",
      topic: null,
      category: null,
      source: "user",
      importance: 0.5,
      confidence: 0.5,
      lifecycle: "active",
      activationCount: 1,
      lastAccessedAt: "2026-09-27T04:00:00.000Z",
      createdAt: "2026-09-26T00:00:00.000Z",
    },
    {
      id: "b",
      type: "fact",
      content: "y",
      topic: null,
      category: null,
      source: "user",
      importance: 0.5,
      confidence: 0.5,
      lifecycle: "active",
      activationCount: 1,
      lastAccessedAt: "2026-09-27T04:00:00.000Z",
      createdAt: "2026-09-26T00:00:00.000Z",
    },
  ],
  edges: [
    {
      id: "e",
      sourceNodeId: "a",
      targetNodeId: "b",
      storedWeight: 0.5,
      weight: 0.4,
      strong: false,
      activationCount: 1,
      lastActivatedAt: "2026-09-27T04:00:00.000Z",
    },
  ],
  threads: [
    {
      id: "t",
      title: "T",
      topic: null,
      status: "open",
      nodeIds: ["a", "b"],
      activationCount: 1,
      lastActivationAt: "2026-09-27T04:00:00.000Z",
    },
  ],
});

describe("ORB Knowledge Graph – Aktivierung nur aus gespeicherten Werten", () => {
  it("meldet nichts ohne Änderung", () => {
    expect(diffGraphs(base(), { ...base(), readAt: "2026-09-27T05:00:04.000Z" })).toBeNull();
  });

  it("markiert nur den Node, dessen Zähler/Zeitstempel sich änderte", () => {
    const next = base();
    next.nodes[0]!.activationCount = 2;
    next.nodes[0]!.lastAccessedAt = "2026-09-27T05:00:02.000Z";
    const ev = diffGraphs(base(), next)!;
    expect(ev.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(ev.nodes[0]!.evidence).toEqual(["activation_count", "last_accessed_at"]);
    expect(ev.edges).toEqual([]);
  });

  it("erkennt Kanten-, Thread- und Ausgabeänderung getrennt", () => {
    const next = base();
    next.edges[0]!.lastActivatedAt = "2026-09-27T05:00:02.000Z";
    next.threads[0]!.lastActivationAt = "2026-09-27T05:00:02.000Z";
    next.lastOrbMessage = { id: "m2", decision: "ask", createdAt: "2026-09-27T05:00:02.000Z" };
    const ev = diffGraphs(base(), next)!;
    expect(ev.nodes).toEqual([]);
    expect(ev.edges.map((e) => e.id)).toEqual(["e"]);
    expect(ev.threads.map((t) => t.id)).toEqual(["t"]);
    expect(ev.lastOrbMessageChanged).toBe(true);
  });

  it("liest nur – kein getOrbSnapshot, keine Schreibaufrufe", () => {
    const src = readFileSync("src/lib/orb-knowledge-graph.functions.ts", "utf8");
    expect(src).not.toMatch(/\.(update|insert|upsert|delete)\(/);
    expect(src).not.toContain("getSnapshot(");
    expect(src).toContain("assertAdmin");
  });
});
