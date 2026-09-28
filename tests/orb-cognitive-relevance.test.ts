import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  RELEVANCE_FACTOR_KEYS,
  RELEVANCE_FACTOR_SPEC,
  assessCognitiveRelevance,
  isRelevanceFactors,
} from "@/orb-core/cognitive/relevance";
import { isDirectMemory, type OrbInformationSource } from "@/orb-core/cognitive/foundation";

const full = { context: 0.8, goals: 0.6, knowledgeGap: 0.4, task: 0.5, recency: 0.9, experience: 0.3, userSignal: 0.7 };

describe("Phase 2 – Cognitive Relevance", () => {
  it("vollständige Faktoren", () => {
    const a = assessCognitiveRelevance({ factors: full });
    expect(a.factors).toEqual(full);
    expect(a.confidence).toBe(1);
    expect(a.unknownFactors).toEqual([]);
    expect(isRelevanceFactors(a.factors)).toBe(true);
  });

  it("fehlende Faktoren sind null, nicht 0", () => {
    const a = assessCognitiveRelevance({ factors: { context: 0.5 } });
    expect(a.factors.goals).toBeNull();
    expect(a.factors.goals).not.toBe(0);
    expect(a.unknownFactors).toHaveLength(6);
    expect(a.confidence).toBeCloseTo(1 / 7);
    expect(assessCognitiveRelevance().confidence).toBe(0);
  });

  it("explizites null bleibt unknown, 0 bleibt bestimmt", () => {
    const a = assessCognitiveRelevance({ factors: { goals: null, task: 0 } });
    expect(a.factors.goals).toBeNull();
    expect(a.factors.task).toBe(0);
    expect(a.unknownFactors).not.toContain("task");
  });

  it("Werte außerhalb 0..1 werden begrenzt", () => {
    const a = assessCognitiveRelevance({ factors: { context: 3, recency: -2 } });
    expect(a.factors.context).toBe(1);
    expect(a.factors.recency).toBe(0);
  });

  it("NaN / Infinity / Nicht-Zahl → null und invalid", () => {
    const a = assessCognitiveRelevance({ factors: { context: NaN, goals: Infinity, task: -Infinity, recency: "0.5" } });
    for (const k of ["context", "goals", "task", "recency"] as const) expect(a.factors[k]).toBeNull();
    expect(a.invalidFactors.sort()).toEqual(["context", "goals", "recency", "task"]);
  });

  it("Provenance bleibt erhalten, Inference wird nicht Direct Memory", () => {
    const prov: OrbInformationSource[] = [
      { type: "memory", memoryId: "m1" },
      { type: "inference", sourceIds: ["m1", "c1"] },
    ];
    const snap = JSON.stringify(prov);
    const a = assessCognitiveRelevance({ factors: full, provenance: [...prov, { type: "bogus" }] });
    expect(a.provenance).toEqual(prov);
    expect(a.provenance[0]).not.toBe(prov[0]);
    expect(isDirectMemory(a.provenance[1])).toBe(false);
    expect(JSON.stringify(prov)).toBe(snap);
    expect(assessCognitiveRelevance().provenance).toEqual([{ type: "unknown" }]);
  });

  it("Memory-Importance, Retrieval, Curiosity, Energy, Goals werden nicht verändert", () => {
    const memory = { id: "m1", importance: 0.9, retrievalScore: 0.77 };
    const orbState = { curiosity: 0.4, energy: 0.2 };
    const goals = [{ id: "g1", status: "active", priority: 0.5 }];
    const snap = JSON.stringify({ memory, orbState, goals });
    const input = { factors: { ...full }, provenance: [{ type: "memory", memoryId: "m1" }] };
    const inSnap = JSON.stringify(input);
    const a = assessCognitiveRelevance(input);
    expect(JSON.stringify({ memory, orbState, goals })).toBe(snap);
    expect(JSON.stringify(input)).toBe(inSnap);
    expect(Object.keys(a).sort()).toEqual(["confidence", "factors", "invalidFactors", "provenance", "unknownFactors"]);
  });

  it("hohe Importance kann niedrige Relevance haben und umgekehrt", () => {
    const hi = { importance: 0.95 };
    const lo = { importance: 0.1 };
    const aHi = assessCognitiveRelevance({ factors: { context: 0.05, goals: 0.0, recency: 0.1 } });
    const aLo = assessCognitiveRelevance({ factors: { context: 0.95, goals: 0.9, recency: 1 } });
    expect(aHi.factors.context!).toBeLessThan(hi.importance);
    expect(aLo.factors.context!).toBeGreaterThan(lo.importance);
    expect(hi.importance).toBe(0.95);
    expect(lo.importance).toBe(0.1);
  });

  it("keine Gewichtung / kein Gesamtwert, alle Faktoren dokumentiert", () => {
    const a = assessCognitiveRelevance({ factors: full }) as Record<string, unknown>;
    expect(a.score).toBeUndefined();
    expect(a.relevance).toBeUndefined();
    for (const k of RELEVANCE_FACTOR_KEYS) expect(RELEVANCE_FACTOR_SPEC[k].unknownWhen.length).toBeGreaterThan(0);
    expect(RELEVANCE_FACTOR_SPEC.context.dynamic).toBe(true);
    expect(RELEVANCE_FACTOR_SPEC.recency.persistable).toBe(false);
  });

  it("keine Aktion: Modul ohne DB/LLM/fetch/Seiteneffekte, von keinem Modul importiert", () => {
    const src = readFileSync("src/orb-core/cognitive/relevance.ts", "utf8");
    expect(src).not.toMatch(/supabase|fetch\(|createServerFn|\.server|insert\(|speak|process\.env/);
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk("src");
    const users = files.filter((f) => !f.endsWith("cognitive/relevance.ts") && readFileSync(f, "utf8").includes("cognitive/relevance"));
    expect(users).toEqual([]);
  });
});
