// P5-PATCH-02: gleiche Kategorie + schwache Similarity (< 0.5) löst bei
// create_or_update keinen Content-Overwrite mehr aus.
import { describe, it, expect, vi, beforeEach } from "vitest";

const simMock = vi.hoisted(() => ({ value: null as number | null }));
vi.mock("@/orb-core/memory", async (orig) => {
  const real = await orig<typeof import("@/orb-core/memory")>();
  return {
    ...real,
    similarity: (a: string, b: string) => simMock.value ?? real.similarity(a, b),
  };
});

import { validateCandidate, type ExistingNode } from "@/orb-core/analysis/validate";
import { normKey, similarity } from "@/orb-core/memory";
import type { MemoryCandidate } from "@/orb-core/analysis/schema";

const NO = { forget: false, explicitRemember: false, temporaryOnly: false, change: false };
const OLD = "Logikketten von ORB Core umfassend patchen und weitertesten";
const NEW = "Kosten der LLM-API-Nutzung optimieren";

function cand(value: string, over: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return {
    key: "k", value, category: "goal", relevance: 0.8, longTermValue: 0.8, confidence: 0.9,
    temporalScope: "long_term", decayRate: 0.01, source: "conversation", sourceReference: "",
    relatedNodeIds: [], action: "create_or_update", ...over,
  };
}
function node(content: string, category = "goal"): ExistingNode {
  return { id: "n1", content, normKey: normKey(content), category, longTermValue: 0.8, temporalScope: "long_term" };
}
const run = (c: MemoryCandidate, n: ExistingNode, s = NO) =>
  validateCandidate(c, [n], s as never);

beforeEach(() => { simMock.value = null; });

describe("P5-PATCH-02", () => {
  it("A: gleiche Kategorie, sim 0.19 → kein Treffer, neue Memory", () => {
    simMock.value = 0.19;
    expect(run(cand(NEW), node(OLD)).decision).toBe("accepted");
  });
  it("B: gleiche Kategorie, sim 0.20 → kein Overwrite, neue Memory", () => {
    simMock.value = 0.2;
    const r = run(cand(NEW), node(OLD));
    expect(r.decision).toBe("accepted");
    expect(r.nodeId).toBeNull();
  });
  it("C: gleiche Kategorie, sim 0.49 → kein Overwrite", () => {
    simMock.value = 0.49;
    expect(run(cand(NEW), node(OLD)).decision).toBe("accepted");
  });
  it("D: gleiche Kategorie, sim 0.50 → bisheriger Update-Pfad", () => {
    simMock.value = 0.5;
    const r = run(cand(NEW), node(OLD));
    expect(r.decision).toBe("update");
    expect(r.nodeId).toBe("n1");
  });
  it("E: gleicher norm_key → duplicate", () => {
    const r = run(cand("Ich arbeite als Koch.", { category: "fact" }), node("Ich arbeite als Koch.", "fact"));
    expect(r.decision).toBe("duplicate");
  });
  it("F: identischer Content → kein Overwrite (duplicate)", () => {
    simMock.value = 0.2;
    expect(run(cand(OLD), node(OLD)).decision).toBe("duplicate");
  });
  it("G: andere Kategorie, sim 0.49 → wie bisher kein Treffer", () => {
    simMock.value = 0.49;
    expect(run(cand(NEW), node(OLD, "fact")).decision).toBe("accepted");
  });
  it("H: andere Kategorie, sim 0.50 → starker Treffer, update", () => {
    simMock.value = 0.5;
    expect(run(cand(NEW), node(OLD, "fact")).decision).toBe("update");
  });
  it("I: Negation → contradiction unverändert", () => {
    simMock.value = 0.2;
    expect(run(cand("Ich will nicht mehr Kosten optimieren"), node(NEW)).decision).toBe("contradiction");
  });
  it("J: Change-Signal → contradiction unverändert", () => {
    simMock.value = 0.2;
    expect(run(cand(NEW), node(OLD), { ...NO, change: true }).decision).toBe("contradiction");
  });
  it("K: reinforce + schwacher Treffer → Decision wie vor Patch 02 (Apply schützt via Patch 01)", () => {
    simMock.value = 0.2;
    const r = run(cand(NEW, { action: "reinforce" }), node(OLD));
    expect(r.decision).toBe("update");
    expect(r.nodeId).toBe("n1");
  });
  it("L: historischer Fall mit echter Similarity → alte Goal-Memory wird nicht überschrieben", () => {
    expect(similarity(NEW, OLD)).toBeLessThan(0.5);
    const r = run(cand(NEW), node(OLD));
    expect(r.decision).toBe("accepted");
    expect(r.nodeId).toBeNull();
  });
  it("kein stilles Verwerfen: niedrige LTV → bestehende Ablehnungsregel greift", () => {
    simMock.value = 0.2;
    expect(run(cand(NEW, { longTermValue: 0.1 }), node(OLD)).decision).toBe("rejected");
  });
});
