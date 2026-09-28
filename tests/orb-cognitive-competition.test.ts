import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import * as mod from "@/orb-core/cognitive/competition";
import { compareCognitiveCandidates as cmp } from "@/orb-core/cognitive/competition";
import { createCognitiveCandidate as mk } from "@/orb-core/cognitive/candidate";
import { assessCognitiveAttention } from "@/orb-core/cognitive/attention";
import { assessCognitiveGoalPressure } from "@/orb-core/cognitive/goal-pressure";
import { assessCognitiveRelevance } from "@/orb-core/cognitive/relevance";
import { assessCognitiveExperience } from "@/orb-core/cognitive/experience";
import { detectContradiction } from "@/orb-core/cognitive/contradiction";
import type { OrbGoal } from "@/orb-core/cognitive/foundation";

const att = (o: Parameters<typeof assessCognitiveAttention>[0]) => assessCognitiveAttention(o);
const goal = (id: string): OrbGoal => ({
  id,
  title: "Ziel",
  priority: 0.5,
  status: "active",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
});
const focus = { kind: "task", id: "t1" };
const SRC = readFileSync("src/orb-core/cognitive/competition.ts", "utf8");
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "");

describe("Phase 10 – Cognitive Competition", () => {
  it("A – identische IDs → none", () => {
    const r = cmp(mk({ id: "x", topic: "a" }), mk({ id: "x", topic: "a" }));
    expect(r.level).toBe("none");
    expect(r.reasons).toEqual(["identical_candidate"]);
  });

  it("B/C – fehlender Candidate / keine Daten → unknown", () => {
    expect(cmp(mk({ id: "a" }), null).level).toBe("unknown");
    expect(cmp(undefined, undefined).level).toBe("unknown");
    const r = cmp(mk({ id: "a" }), mk({ id: "b" }));
    expect(r.level).toBe("unknown");
    expect(r.score).toBeNull();
  });

  it("D/E/F – Topic overlap", () => {
    expect(cmp(mk({ id: "a", topic: "ORB Memory" }), mk({ id: "b", topic: " orb memory " })).factors.topicOverlap).toBe(1);
    const e = cmp(mk({ id: "a", topic: "Auto" }), mk({ id: "b", topic: "Fahrzeug" }));
    expect(e.factors.topicOverlap).toBe(0);
    expect(e.level).toBe("none");
    expect(
      cmp(mk({ id: "a", topic: "ORB Memory System" }), mk({ id: "b", topic: "ORB Memory Retrieval" }))
        .factors.topicOverlap,
    ).toBeCloseTo(0.5);
  });

  it("G/H – Focus overlap", () => {
    const r = cmp(mk({ id: "a", attention: att({ focus }) }), mk({ id: "b", attention: att({ focus }) }));
    expect(r.factors.focusOverlap).toBe(1);
    expect(cmp(mk({ id: "a", attention: att({ focus }) }), mk({ id: "b", attention: att({}) })).factors.focusOverlap).toBeNull();
  });

  it("I/J – Attention overlap", () => {
    const r = cmp(
      mk({ id: "a", attention: att({ focus, currentFocus: 0.8 }) }),
      mk({ id: "b", attention: att({ focus, currentFocus: 0.4 }) }),
    );
    expect(r.factors.attentionOverlap).toBe(0.4);
    expect(cmp(mk({ id: "a", attention: att({}) }), mk({ id: "b" })).factors.attentionOverlap).toBeNull();
  });

  it("K/L – Goal overlap nur über explizite goalId", () => {
    const g1 = assessCognitiveGoalPressure({ goal: goal("g1") });
    const g2 = assessCognitiveGoalPressure({ goal: goal("g2") });
    expect(cmp(mk({ id: "a", goalPressure: g1 }), mk({ id: "b", goalPressure: g1 })).factors.goalOverlap).toBe(1);
    expect(cmp(mk({ id: "a", goalPressure: g1 }), mk({ id: "b", goalPressure: g2 })).factors.goalOverlap).toBe(0);
    const noGoal = assessCognitiveGoalPressure({ contextAlignment: 0.5 });
    expect(cmp(mk({ id: "a", goalPressure: noGoal }), mk({ id: "b", goalPressure: noGoal })).factors.goalOverlap).toBeNull();
  });

  it("M/N – Interruption conflict", () => {
    expect(
      cmp(mk({ id: "a", attention: att({ interruption: 0.9 }) }), mk({ id: "b", attention: att({ interruption: 0.3 }) }))
        .factors.interruptionConflict,
    ).toBe(0.3);
    expect(cmp(mk({ id: "a", attention: att({ interruption: 0.9 }) }), mk({ id: "b" })).factors.interruptionConflict).toBeNull();
  });

  it("O/P – symmetrisch", () => {
    const A = mk({ id: "a", topic: "ORB Memory System", attention: att({ focus, currentFocus: 0.7, interruption: 0.2 }) });
    const B = mk({ id: "b", topic: "ORB Retrieval", attention: att({ focus, currentFocus: 0.3, interruption: 0.6 }) });
    const ab = cmp(A, B);
    const ba = cmp(B, A);
    expect([ab.level, ab.score, ab.factors, ab.reasons]).toEqual([ba.level, ba.score, ba.factors, ba.reasons]);
    expect([ab.leftCandidateId, ba.leftCandidateId]).toEqual(["a", "b"]);
  });

  it("Q–T – kein Winner/Ranking/Auswahl/Priorisierung", () => {
    const r = cmp(mk({ id: "a", topic: "x" }), mk({ id: "b", topic: "x" })) as unknown as Record<string, unknown>;
    for (const k of ["winner", "loser", "preferred", "selected", "bestCandidate", "priority"])
      expect(r[k]).toBeUndefined();
    expect(Object.keys(mod).sort()).toEqual(["COMPETITION_FACTOR_KEYS", "compareCognitiveCandidates"]);
    expect(CODE).not.toMatch(/winner|loser|preferred|selected|best|rank|sort\(|priorit/i);
  });

  it("U/V – keine Mutation, deterministisch", () => {
    const A = mk({ id: "a", topic: "t", attention: att({ focus, currentFocus: 0.5 }) });
    const B = mk({ id: "b", topic: "t u", attention: att({ focus, currentFocus: 0.9 }) });
    const [a0, b0] = [structuredClone(A), structuredClone(B)];
    expect(cmp(A, B)).toEqual(cmp(A, B));
    expect(A).toEqual(a0);
    expect(B).toEqual(b0);
  });

  it("W–AC – keine Uhr, Zufall, DB/API/LLM, Memory, Retrieval, Learning, Aktion", () => {
    expect(CODE).not.toMatch(
      /Date\.now|new Date|Math\.random|randomUUID|supabase|fetch\(|createServerFn|\.server"|insert\(|update\(|speak\(|process\.env|recall|retriev|learn|emit|dispatch/i,
    );
  });

  it("AD/AE/AF/AG – keine automatische Umdeutung", () => {
    const con = detectContradiction(
      { subject: "x", predicate: "ist", value: "a" },
      { subject: "x", predicate: "ist", value: "b" },
    );
    expect(cmp(mk({ id: "a", contradiction: con }), mk({ id: "b", contradiction: con })).level).toBe("unknown");
    const exp = assessCognitiveExperience({ actionId: "a1" });
    expect(cmp(mk({ id: "a", experience: exp }), mk({ id: "b", experience: exp })).level).toBe("unknown");
    const gp = assessCognitiveGoalPressure({ contextAlignment: 1, taskContribution: 1 });
    expect(cmp(mk({ id: "a", goalPressure: gp }), mk({ id: "b", goalPressure: gp })).level).toBe("unknown");
    const rel = assessCognitiveRelevance({ factors: { context: 1 } });
    const r = cmp(mk({ id: "a", relevance: rel }), mk({ id: "b", relevance: rel }));
    expect(r.level).toBe("unknown");
    expect(r.factors.attentionOverlap).toBeNull();
  });

  it("AH/AI – Phase 1–9 unverändert, competition.ts nirgends importiert", () => {
    const before = [mk({ id: "a", attention: att({ focus }) }), att({ focus, currentFocus: 1 })];
    cmp(mk({ id: "a", attention: att({ focus }) }), mk({ id: "b", attention: att({ focus }) }));
    expect([mk({ id: "a", attention: att({ focus }) }), att({ focus, currentFocus: 1 })]).toEqual(before);
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk("src");
    const users = files.filter(
      (f) => !f.endsWith("cognitive/competition.ts") && /cognitive\/competition|\.\/competition"/.test(readFileSync(f, "utf8")),
    );
    expect(users).toEqual([]);
  });
});
