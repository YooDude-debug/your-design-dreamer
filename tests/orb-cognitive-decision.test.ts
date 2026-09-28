import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import * as mod from "@/orb-core/cognitive/decision";
import { assessDecisionFoundation as df } from "@/orb-core/cognitive/decision";
import { assessStrategies } from "@/orb-core/cognitive/strategy";
import { createCognitiveSnapshot as snap } from "@/orb-core/cognitive/snapshot";
import { createCognitiveCandidate as mk } from "@/orb-core/cognitive/candidate";
import { compareCognitiveCandidates } from "@/orb-core/cognitive/competition";
import { assessCognitiveAttention } from "@/orb-core/cognitive/attention";
import { assessCognitiveExperience } from "@/orb-core/cognitive/experience";
import { detectContradiction } from "@/orb-core/cognitive/contradiction";
import { assessCognitiveRelevance } from "@/orb-core/cognitive/relevance";
import { assessCognitiveNovelty } from "@/orb-core/cognitive/novelty";
import { assessCognitiveUncertainty } from "@/orb-core/cognitive/uncertainty";
import { assessCognitiveGoalPressure } from "@/orb-core/cognitive/goal-pressure";
import { isDirectMemory } from "@/orb-core/cognitive/foundation";

const ORDER = [
  "continue_focus",
  "ask_clarification",
  "explore_gap",
  "resolve_conflict",
  "switch_focus",
  "defer",
  "observe",
  "follow_up",
];
const focus = { kind: "task" as const, id: "t1" };
const conflict = () =>
  detectContradiction(
    { subject: "s", predicate: "ist", value: "1" },
    { subject: "s", predicate: "ist", value: "2" },
  );
const complete = (id = "c") =>
  mk({
    id,
    source: { type: "inference", sourceIds: ["m1"] },
    relevance: assessCognitiveRelevance({ factors: { context: 0.5 } }),
    novelty: assessCognitiveNovelty(),
    uncertainty: assessCognitiveUncertainty(),
    goalPressure: assessCognitiveGoalPressure(),
    attention: assessCognitiveAttention(),
    experience: assessCognitiveExperience({ actionId: "x" }),
    contradiction: conflict(),
  });
const partial = (id = "p") => mk({ id, attention: assessCognitiveAttention({ focus }) });
const run = (s: ReturnType<typeof snap>) => df(s, assessStrategies(s));
const get = (s: ReturnType<typeof snap>, t: string) =>
  run(s).candidates.find((c) => c.strategy === t)!;
const allTrue = () => {
  const a = partial("a");
  const b = complete("b");
  return snap({
    currentFocus: focus,
    candidates: [a, b],
    competitions: [compareCognitiveCandidates(a, b)],
    experiences: [assessCognitiveExperience({ actionId: "x1" })],
    conflicts: [conflict()],
  });
};
const DIMS = [
  "relevance",
  "novelty",
  "uncertainty",
  "goalPressure",
  "attention",
  "experience",
  "contradiction",
] as const;
const COVERAGE = DIMS.map((d) => `${d}Coverage` as const);
const CODE = readFileSync("src/orb-core/cognitive/decision.ts", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("Phase 13 – Cognitive Decision Foundation", () => {
  it("A/K/AD – leerer Snapshot: nur observe, feste Reihenfolge", () => {
    const r = run(snap());
    expect(r.candidates.map((c) => c.strategy)).toEqual(ORDER);
    expect(r.candidates.filter((c) => c.available).map((c) => c.strategy)).toEqual(["observe"]);
    expect(get(snap(), "observe").missingInputs).toEqual([]);
    expect(get(snap(), "switch_focus").missingInputs).toEqual([
      "currentFocus",
      "candidate",
      "competition",
    ]);
    for (const c of r.candidates) expect(c.decisionInputs.relevanceCoverage).toBeNull();
  });

  it("B – nur Fokus (Beispiel aus Spezifikation)", () => {
    expect(get(snap({ currentFocus: focus }), "continue_focus")).toEqual({
      strategy: "continue_focus",
      available: true,
      decisionInputs: {
        relevanceCoverage: null,
        noveltyCoverage: null,
        uncertaintyCoverage: null,
        goalPressureCoverage: null,
        attentionCoverage: null,
        experienceCoverage: null,
        contradictionCoverage: null,
        competition: null,
        focusPresent: true,
        experiencePresent: false,
        conflictPresent: false,
      },
      missingInputs: [],
      reasons: ["explicit_current_focus"],
    });
  });

  it("C – vollständiger Candidate: Datenabdeckung unverändert übernommen", () => {
    const c = complete();
    const d = get(snap({ candidates: [c] }), "ask_clarification");
    expect(d.available).toBe(false);
    expect(d.missingInputs).toEqual([]);
    expect(d.decisionInputs.relevanceCoverage).toBe(c.relevance!.confidence);
    expect(d.decisionInputs.attentionCoverage).toBe(c.attention!.confidence);
    expect(d.decisionInputs.experienceCoverage).toBe(c.experience!.completeness);
    expect(d.decisionInputs.contradictionCoverage).toBe(c.contradiction!.confidence);
    expect(d.decisionInputs.competition).toBeNull();
  });

  it("D/E – fehlende Dimensionen landen in missingInputs", () => {
    const one = mk({ ...complete(), uncertainty: null });
    expect(get(snap({ candidates: [one] }), "explore_gap").missingInputs).toEqual(["uncertainty"]);
    const d = get(snap({ candidates: [partial()] }), "ask_clarification");
    expect(d.available).toBe(true);
    expect(d.missingInputs).toHaveLength(6);
    expect(d.missingInputs).not.toContain("attention");
    expect(d.decisionInputs.relevanceCoverage).toBeNull();
  });

  it("F – mehrere Candidates: Werte null, fehlende Dimensionen je Candidate", () => {
    const d = get(snap({ candidates: [partial("a"), complete("b")] }), "explore_gap");
    for (const k of COVERAGE) expect(d.decisionInputs[k]).toBeNull();
    expect(d.missingInputs).toContain("a.novelty");
    expect(d.missingInputs.some((m) => m.startsWith("b."))).toBe(false);
  });

  it("G/H/I – Konflikt, Competition, Experience nur als Vorhandensein", () => {
    expect(
      get(snap({ conflicts: [conflict()] }), "resolve_conflict").decisionInputs.conflictPresent,
    ).toBe(true);
    const a = partial("a");
    const b = complete("b");
    const s = snap({
      currentFocus: focus,
      candidates: [a, b],
      competitions: [compareCognitiveCandidates(a, b)],
    });
    const sw = get(s, "switch_focus");
    expect(sw.available).toBe(true);
    expect(sw.missingInputs).toEqual([]);
    expect(sw.decisionInputs.competition).toBeNull();
    const f = get(
      snap({ experiences: [assessCognitiveExperience({ actionId: "e" })] }),
      "follow_up",
    );
    expect(f.available).toBe(true);
    expect(f.decisionInputs.experiencePresent).toBe(true);
  });

  it("J/AE – alle Strategien gleichzeitig verfügbar", () => {
    expect(run(allTrue()).candidates.every((c) => c.available)).toBe(true);
  });

  it("L–P – kein Ranking, Auswahl, Empfehlung, Score, Winner/Loser", () => {
    const r = run(allTrue()) as unknown as Record<string, unknown>;
    expect(Object.keys(r)).toEqual(["candidates"]);
    for (const c of r.candidates as object[])
      expect(Object.keys(c).sort()).toEqual([
        "available",
        "decisionInputs",
        "missingInputs",
        "reasons",
        "strategy",
      ]);
    expect(Object.keys(mod).sort()).toEqual([
      "assessDecisionCandidate",
      "assessDecisionFoundation",
    ]);
    expect(CODE).not.toMatch(
      /score|priorit|weight|rank|winner|loser|best|selected|recommend|nextAction|sort\(|Math\.|\.reduce\(/i,
    );
  });

  it("Symmetrie – vertauschte Candidates ändern keine Verfügbarkeit", () => {
    const x = run(snap({ candidates: [partial("a"), complete("b")] })).candidates.map(
      (c) => c.available,
    );
    const y = run(snap({ candidates: [complete("b"), partial("a")] })).candidates.map(
      (c) => c.available,
    );
    expect(x).toEqual(y);
  });

  it("Q – deterministisch", () => {
    expect(run(allTrue())).toEqual(run(allTrue()));
  });

  it("R/S/T/U/V – keine Mutation, Provenance bleibt, Inference bleibt Inference", () => {
    const s = allTrue();
    const st = assessStrategies(s);
    const bs = structuredClone(s);
    const bst = structuredClone(st);
    const r = df(s, st);
    r.candidates[0].reasons.push("x");
    r.candidates[1].missingInputs.push("x");
    expect(s).toEqual(bs);
    expect(st).toEqual(bst);
    expect(s.candidates[1].source).toEqual({ type: "inference", sourceIds: ["m1"] });
    expect(isDirectMemory(s.candidates[1].source)).toBe(false);
  });

  it("W–AA – keine Uhr, Zufall, DB/API/LLM, Memory/Retrieval, Aktion", () => {
    expect(CODE).not.toMatch(
      /Date\.now|new Date|Math\.random|randomUUID|supabase|fetch\(|createServerFn|\.server"|insert\(|speak\(|process\.env|learn|emit|dispatch|retriev|memory|curiosity|energy|autonomy|question|impulse/i,
    );
  });

  it("AB/AC – Phase 1–12 unverändert, decision.ts nirgends importiert", () => {
    const s = allTrue();
    const before = structuredClone(s);
    run(s);
    expect(allTrue()).toEqual(before);
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
      (f) =>
        !f.endsWith("cognitive/decision.ts") &&
        /cognitive\/decision|\.\/decision/.test(readFileSync(f, "utf8")),
    );
    expect(users).toEqual([]);
    const imports = [...CODE.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
    expect(imports).toEqual(["./candidate.ts", "./snapshot.ts"]);
  });

  it("Korrektur A–E – nur ...Coverage-Felder, keine Dimensionswerte", () => {
    const c = complete();
    const d = get(snap({ candidates: [c] }), "observe").decisionInputs as Record<string, unknown>;
    for (const dim of DIMS) {
      expect(dim in d).toBe(false);
      expect(`${dim}Coverage` in d).toBe(true);
    }
    expect(d.relevanceCoverage).toBe(c.relevance!.confidence);
    expect(d.noveltyCoverage).toBe(c.novelty!.confidence);
    expect(d.uncertaintyCoverage).toBe(c.uncertainty!.confidence);
    expect(d.goalPressureCoverage).toBe(c.goalPressure!.confidence);
    expect(d.experienceCoverage).toBe(c.experience!.completeness);
    expect(CODE).not.toMatch(
      /\b(relevance|novelty|uncertainty|goalPressure|attention|experience|contradiction):/,
    );
    const typeBlock = CODE.match(/export type OrbDecisionInputs = \{[^}]*\}/)![0];
    for (const dim of DIMS) expect(typeBlock).not.toMatch(new RegExp(`\\b${dim}:`));
  });

  it("Korrektur F–K – mehrere Candidates: keine Auswahl, Aggregation oder Reihenfolge-Effekt", () => {
    const a = complete("a");
    const b = complete("b");
    const s1 = snap({ candidates: [a, b] });
    const s2 = snap({ candidates: [b, a] });
    const bs = structuredClone(s1);
    const ba = structuredClone(a);
    const r1 = run(s1);
    const r2 = run(s2);
    for (const c of r1.candidates) for (const k of COVERAGE) expect(c.decisionInputs[k]).toBeNull();
    expect(r1.candidates.map((c) => c.decisionInputs)).toEqual(
      r2.candidates.map((c) => c.decisionInputs),
    );
    expect(r1.candidates.map((c) => c.available)).toEqual(r2.candidates.map((c) => c.available));
    expect(s1).toEqual(bs);
    expect(a).toEqual(ba);
  });
});
