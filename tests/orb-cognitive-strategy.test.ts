import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import * as mod from "@/orb-core/cognitive/strategy";
import { assessStrategies, STRATEGY_TYPES } from "@/orb-core/cognitive/strategy";
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

const focus = { kind: "task" as const, id: "t1" };
const conflict = () =>
  detectContradiction(
    { subject: "s", predicate: "ist", value: "1" },
    { subject: "s", predicate: "ist", value: "2" },
  );
const complete = () =>
  mk({
    id: "c",
    relevance: assessCognitiveRelevance(),
    novelty: assessCognitiveNovelty(),
    uncertainty: assessCognitiveUncertainty(),
    goalPressure: assessCognitiveGoalPressure(),
    attention: assessCognitiveAttention(),
    experience: assessCognitiveExperience({ actionId: "x" }),
    contradiction: conflict(),
  });
const partial = () => mk({ id: "p", attention: assessCognitiveAttention({ focus }) });
const full = () => {
  const a = partial();
  const b = complete();
  return snap({
    currentFocus: focus,
    candidates: [a, b],
    competitions: [compareCognitiveCandidates(a, b)],
    experiences: [assessCognitiveExperience({ actionId: "x1" })],
    conflicts: [conflict()],
  });
};
const av = (s: ReturnType<typeof snap>) =>
  Object.fromEntries(assessStrategies(s).strategies.map((x) => [x.type, x.available]));
const CODE = readFileSync("src/orb-core/cognitive/strategy.ts", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("Phase 12 – Cognitive Strategy", () => {
  it("A/B – leerer Snapshot, observe immer true", () => {
    expect(av(snap())).toEqual({
      continue_focus: false,
      ask_clarification: false,
      explore_gap: false,
      resolve_conflict: false,
      switch_focus: false,
      defer: false,
      observe: true,
      follow_up: false,
    });
  });

  it("C/D – continue_focus nur mit explizitem Fokus", () => {
    expect(av(snap({ candidates: [partial()] })).continue_focus).toBe(false);
    const r = assessStrategies(snap({ currentFocus: focus })).strategies[0];
    expect(r).toEqual({
      type: "continue_focus",
      available: true,
      reasons: ["explicit_current_focus"],
    });
  });

  it("E/F – defer", () => {
    expect(av(snap({ candidates: [complete()] })).defer).toBe(true);
    expect(av(snap()).defer).toBe(false);
  });

  it("G–J – ask_clarification / explore_gap nur über fehlende Dimensionen", () => {
    const p = av(snap({ candidates: [partial()] }));
    expect(p.ask_clarification).toBe(true);
    expect(p.explore_gap).toBe(true);
    const c = av(snap({ candidates: [complete()] }));
    expect(c.ask_clarification).toBe(false);
    expect(c.explore_gap).toBe(false);
  });

  it("K/L – resolve_conflict nur explizit", () => {
    expect(av(snap({ conflicts: [conflict()] })).resolve_conflict).toBe(true);
    expect(av(snap({ candidates: [complete(), complete()] })).resolve_conflict).toBe(false);
  });

  it("M–P – switch_focus braucht Fokus + Candidate + Competition", () => {
    const a = partial();
    const b = complete();
    const comp = [compareCognitiveCandidates(a, b)];
    expect(
      av(snap({ currentFocus: focus, candidates: [a, b], competitions: comp })).switch_focus,
    ).toBe(true);
    expect(av(snap({ currentFocus: focus, candidates: [a, b] })).switch_focus).toBe(false);
    expect(av(snap({ candidates: [a, b], competitions: comp })).switch_focus).toBe(false);
    expect(av(snap({ currentFocus: focus, competitions: comp })).switch_focus).toBe(false);
  });

  it("Q/R – follow_up nur mit Experience", () => {
    expect(
      av(snap({ experiences: [assessCognitiveExperience({ actionId: "a" })] })).follow_up,
    ).toBe(true);
    expect(av(snap()).follow_up).toBe(false);
  });

  it("S + Reihenfolge – alle 8 gleichzeitig true, feste Reihenfolge", () => {
    const r = assessStrategies(full());
    expect(r.strategies.every((s) => s.available)).toBe(true);
    expect(r.strategies.map((s) => s.type)).toEqual([...STRATEGY_TYPES]);
    expect(assessStrategies(snap()).strategies.map((s) => s.type)).toEqual([...STRATEGY_TYPES]);
    for (const s of r.strategies) expect(s.reasons).toHaveLength(1);
  });

  it("T–W – kein Winner, Ranking, Score, Priority", () => {
    const r = assessStrategies(full()) as unknown as Record<string, unknown>;
    expect(Object.keys(r)).toEqual(["strategies"]);
    for (const s of r.strategies as object[])
      expect(Object.keys(s).sort()).toEqual(["available", "reasons", "type"]);
    expect(Object.keys(mod).sort()).toEqual(["STRATEGY_TYPES", "assessStrategies"]);
    expect(CODE).not.toMatch(
      /winner|selected|best|recommend|rank|score|priorit|utility|probab|weight|nextAction|sort\(|Math\./i,
    );
  });

  it("X/Y – Snapshot inkl. verschachtelter Daten nicht mutiert", () => {
    const s = full();
    const before = structuredClone(s);
    const r = assessStrategies(s);
    r.strategies[0].reasons.push("x");
    expect(s).toEqual(before);
  });

  it("Z – deterministisch", () => {
    expect(assessStrategies(full())).toEqual(assessStrategies(full()));
  });

  it("AA–AK – keine Uhr, Zufall, DB/API/LLM, Memory, Retrieval, Learning, Aktion, Gate", () => {
    expect(CODE).not.toMatch(
      /Date\.now|new Date|Math\.random|randomUUID|supabase|fetch\(|createServerFn|\.server"|insert\(|speak\(|process\.env|learn|emit|dispatch|retriev|memory|curiosity|energy|autonomy|gate|question|impulse/i,
    );
    expect(CODE).not.toMatch(/goals/);
  });

  it("AL/AM – Phase 1–11 unverändert, strategy.ts nirgends importiert", () => {
    const s = full();
    const before = structuredClone(s);
    assessStrategies(s);
    expect(full()).toEqual(before);
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
        !f.endsWith("cognitive/strategy.ts") &&
        /cognitive\/strategy|\.\/strategy/.test(readFileSync(f, "utf8")),
    );
    expect(users).toEqual([]);
  });
});
