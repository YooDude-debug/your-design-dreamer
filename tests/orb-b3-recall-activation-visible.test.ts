import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { recallActivationExclusions } from "@/orb-core/recall-activation-filter";
import { traceMemoryUsage } from "@/orb-core/memory-usage";

const src = readFileSync("src/orb-core/engine.server.ts", "utf8");

type Node = { id: string; activationCount: number; importance: number; lastAccessedAt: string };

/** Spiegel der Schleife „1. Abgerufene Erinnerungen reaktivieren“. */
function simulate(recalled: Node[], excluded: Set<string>, exactId: string | null, imp: number) {
  const writes: { id: string; activation_count: number; last_accessed_at: string; importance: number }[] = [];
  let reactivations = 0;
  for (const node of recalled) {
    if (exactId && node.id === exactId) {
      reactivations += 1;
      continue;
    }
    if (excluded.has(node.id)) continue;
    writes.push({
      id: node.id,
      activation_count: node.activationCount + 1,
      last_accessed_at: "NOW",
      importance: Math.max(node.importance, imp * 0.8),
    });
    reactivations += 1;
  }
  return { writes, reactivations };
}
const n = (id: string): Node => ({ id, activationCount: 2, importance: 0.3, lastAccessedAt: "OLD" });

describe("B3 – Recall-Aktivierung nur für model-visible Memories", () => {
  it("1. A recalled + sichtbar → Aktivierung wie bisher", () => {
    const ex = recallActivationExclusions("DIRECT_ANSWER", ["A"], ["A"]);
    const r = simulate([n("A")], ex, null, 0.9);
    expect(r.writes).toEqual([{ id: "A", activation_count: 3, last_accessed_at: "NOW", importance: 0.9 * 0.8 }]);
  });

  it("2. A recalled + von P2-V2 entfernt → kein activation/last_accessed/importance-Write", () => {
    const ex = recallActivationExclusions("DIRECT_ANSWER", ["A"], []);
    const r = simulate([n("A")], ex, null, 0.9);
    expect(r.writes).toEqual([]);
    expect(r.reactivations).toBe(0);
  });

  it("3. A sichtbar, B entfernt, C sichtbar → nur A und C", () => {
    const ex = recallActivationExclusions("DIRECT_ANSWER", ["A", "B", "C"], ["A", "C"]);
    expect([...ex]).toEqual(["B"]);
    expect(simulate([n("A"), n("B"), n("C")], ex, null, 0.5).writes.map((w) => w.id)).toEqual(["A", "C"]);
  });

  it("4. kein Refill: Ausschluss fügt nie IDs hinzu und kennt nur übergebene IDs", () => {
    const ex = recallActivationExclusions("DIRECT_ANSWER", ["A", "B"], ["A", "Z"]);
    expect([...ex]).toEqual(["B"]);
    expect(simulate([n("A"), n("B")], ex, null, 0.5).writes.map((w) => w.id)).toEqual(["A"]);
  });

  it("andere Modi (FOLLOW_UP, LISTEN, IMPULSE, REFLECT …) unverändert", () => {
    for (const m of ["FOLLOW_UP", "LISTEN", "IMPULSE", "REFLECT", "OTHER"]) {
      expect(recallActivationExclusions(m, ["A", "B"], []).size).toBe(0);
    }
  });

  it("nicht-reliable recalled Einträge bleiben unverändert aktiviert (nur P2-V2-Entfernungen)", () => {
    const ex = recallActivationExclusions("DIRECT_ANSWER", ["A"], ["A"]);
    expect(simulate([n("A"), n("U")], ex, null, 0.5).writes.map((w) => w.id)).toEqual(["A", "U"]);
  });

  it("exact-Zweig (Block 2) unverändert", () => {
    const ex = recallActivationExclusions("DIRECT_ANSWER", ["E"], []);
    const r = simulate([n("E")], ex, "E", 0.5);
    expect(r.writes).toEqual([]);
    expect(r.reactivations).toBe(1);
  });

  it("5./6. Auswahl, P2-V2, B2, Modus: Quelltext unverändert verdrahtet", () => {
    expect(src).toContain(
      "plan.mode === \"DIRECT_ANSWER\" ? directAnswerItems : plan.relevantStrandRefs;",
    );
    expect(src).toContain("promptMemoryRefs(plan).map((r) => r.id),");
    // Ausschluss sitzt nach speak() und vor dem Aktivierungs-Write
    const iEx = src.indexOf("recallActivationExclusions(");
    expect(iEx).toBeGreaterThan(src.indexOf("const aiMs = Date.now() - aiStart;"));
    expect(iEx).toBeLessThan(src.indexOf("activation_count: node.activationCount + 1,"));
    expect(src).toContain("if (activationExcluded.has(node.id)) continue;");
    expect(src.match(/activationExcluded/g)?.length).toBe(2);
  });

  it("9. andere Aktivierungsquellen verwenden den Ausschluss nicht", () => {
    const loopStart = src.indexOf("// 1. Abgerufene Erinnerungen reaktivieren");
    const loopEnd = src.indexOf("// 1b. Ausdrückliche Korrektur");
    const rest = src.slice(0, loopStart) + src.slice(loopEnd);
    expect(rest).not.toContain("activationExcluded.has");
  });

  it("10. model_visible_memory_ids ⊇ aktivierte reliable Recall-IDs (DIRECT_ANSWER, ok)", () => {
    const reliable = ["A", "B", "C"];
    const visible = [{ id: "A" }, { id: "C" }];
    const ex = recallActivationExclusions("DIRECT_ANSWER", reliable, visible.map((v) => v.id));
    const activated = simulate(reliable.map(n), ex, null, 0.5).writes.map((w) => w.id);
    const trace = traceMemoryUsage(reliable, visible, true);
    expect(activated).toEqual(trace.modelVisibleMemoryIds);
    expect(trace.recalledButNotVisibleMemoryIds).toEqual([...ex]);
  });
});
