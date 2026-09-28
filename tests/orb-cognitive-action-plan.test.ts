import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import * as mod from "@/orb-core/cognitive/action-plan";
import { createActionPlan as plan, STRATEGY_ACTION } from "@/orb-core/cognitive/action-plan";
import { assessStrategies } from "@/orb-core/cognitive/strategy";
import { assessDecisionFoundation } from "@/orb-core/cognitive/decision";
import { createCognitiveSnapshot as snap } from "@/orb-core/cognitive/snapshot";
import { createCognitiveCandidate as mk } from "@/orb-core/cognitive/candidate";
import { assessCognitiveExperience } from "@/orb-core/cognitive/experience";
import { detectContradiction } from "@/orb-core/cognitive/contradiction";
import { isDirectMemory } from "@/orb-core/cognitive/foundation";

const focus = { kind: "task" as const, id: "t1" };
const cand = () => mk({ id: "a", source: { type: "inference", sourceIds: ["m1"] } });
const conflict = () =>
  detectContradiction(
    { subject: "s", predicate: "ist", value: "1" },
    { subject: "s", predicate: "ist", value: "2" },
  );
const exp = () => assessCognitiveExperience({ actionId: "x" });
const full = () =>
  snap({
    currentFocus: focus,
    candidates: [cand()],
    conflicts: [conflict()],
    experiences: [exp()],
  });
const STRATS = Object.keys(STRATEGY_ACTION) as (keyof typeof STRATEGY_ACTION)[];
const CODE = readFileSync("src/orb-core/cognitive/action-plan.ts", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("Phase 14 – Cognitive Action Planning Foundation", () => {
  it("A/B – continue_focus", () => {
    expect(plan("continue_focus", snap({ currentFocus: focus }))).toEqual({
      strategy: "continue_focus",
      action: "continue_conversation",
      executable: true,
      requirements: ["currentFocus"],
      missingRequirements: [],
      reasons: ["explicit_current_focus"],
    });
    const p = plan("continue_focus", snap())!;
    expect(p.executable).toBe(false);
    expect(p.missingRequirements).toEqual(["currentFocus"]);
  });

  it("C/D/E – ask_clarification / explore_gap (Beispiel aus Spezifikation)", () => {
    expect(plan("ask_clarification", snap({ candidates: [cand()] }))).toEqual({
      strategy: "ask_clarification",
      action: "ask_user",
      executable: true,
      requirements: ["candidate"],
      missingRequirements: [],
      reasons: ["candidate_present"],
    });
    expect(plan("ask_clarification", snap())!.missingRequirements).toEqual(["candidate"]);
    const e = plan("explore_gap", snap({ candidates: [cand()] }))!;
    expect(e.action).toBe("explore_information");
    expect(e.executable).toBe(true);
  });

  it("F/G – resolve_conflict", () => {
    expect(plan("resolve_conflict", snap({ conflicts: [conflict()] }))!.executable).toBe(true);
    const p = plan("resolve_conflict", snap({ candidates: [cand(), cand()] }))!;
    expect(p.executable).toBe(false);
    expect(p.missingRequirements).toEqual(["conflict"]);
  });

  it("H/I – switch_focus", () => {
    expect(
      plan("switch_focus", snap({ currentFocus: focus, candidates: [cand()] }))!.executable,
    ).toBe(true);
    expect(plan("switch_focus", snap({ candidates: [cand()] }))!.missingRequirements).toEqual([
      "currentFocus",
    ]);
    expect(plan("switch_focus", snap())!.missingRequirements).toEqual([
      "currentFocus",
      "candidate",
    ]);
  });

  it("J/K – defer und observe immer strukturell ausführbar", () => {
    for (const s of ["defer", "observe"] as const) {
      const p = plan(s, snap())!;
      expect(p.executable).toBe(true);
      expect(p.requirements).toEqual([]);
    }
    expect(plan("defer", snap())!.action).toBe("defer_response");
    expect(plan("observe", snap())!.action).toBe("observe_state");
  });

  it("L/M – follow_up", () => {
    expect(plan("follow_up", snap({ experiences: [exp()] }))!.executable).toBe(true);
    const p = plan("follow_up", snap())!;
    expect(p.action).toBe("follow_up_user");
    expect(p.missingRequirements).toEqual(["experience"]);
  });

  it("N/AE/AF – nur explizite Strategie, ungültig → kein Plan, kein Ausweichen", () => {
    for (const v of [undefined, null, "", "best", "Observe", 1, {}, "toString", "__proto__"])
      expect(plan(v, full())).toBeNull();
    const s = full();
    const dc = assessDecisionFoundation(s, assessStrategies(s)).candidates[0];
    expect(plan("observe", s, dc)).toBeNull();
    expect(plan("continue_focus", s, dc)!.strategy).toBe("continue_focus");
    for (const st of STRATS) expect(plan(st, s)!.strategy).toBe(st);
  });

  it("AH – statische Zuordnung, 8 verschiedene Actions", () => {
    expect(STRATEGY_ACTION).toEqual({
      continue_focus: "continue_conversation",
      ask_clarification: "ask_user",
      explore_gap: "explore_information",
      resolve_conflict: "resolve_conflict",
      switch_focus: "switch_topic",
      defer: "defer_response",
      observe: "observe_state",
      follow_up: "follow_up_user",
    });
    expect(new Set(Object.values(STRATEGY_ACTION)).size).toBe(8);
  });

  it("O/AI/AJ – kein Text, fehlende Anforderungen explizit, executable ≠ soll ausführen", () => {
    const p = plan("ask_clarification", full()) as unknown as Record<string, unknown>;
    expect(Object.keys(p).sort()).toEqual([
      "action",
      "executable",
      "missingRequirements",
      "reasons",
      "requirements",
      "strategy",
    ]);
    for (const st of STRATS) {
      const q = plan(st, snap())!;
      expect(q.executable).toBe(q.missingRequirements.length === 0);
      for (const m of q.missingRequirements) expect(q.requirements).toContain(m);
    }
    expect(CODE).not.toMatch(/\?"|text:|message:|prompt|shouldExecute|allowed|execute\(/i);
  });

  it("P–S/AG – kein Score, Ranking, Winner/Loser, nextAction, kein Vergleich", () => {
    expect(Object.keys(mod).sort()).toEqual([
      "ACTION_TYPES",
      "STRATEGY_ACTION",
      "createActionPlan",
    ]);
    expect(CODE).not.toMatch(
      /score|rank|winner|loser|priorit|weight|best|selected|recommend|nextAction|sort\(|Math\.|\.reduce\(/i,
    );
  });

  it("T – deterministisch", () => {
    for (const st of STRATS) expect(plan(st, full())).toEqual(plan(st, full()));
  });

  it("U/V/W – Snapshot, DecisionCandidate, Provenance unverändert", () => {
    const s = full();
    const dc = assessDecisionFoundation(s, assessStrategies(s)).candidates[1];
    const bs = structuredClone(s);
    const bd = structuredClone(dc);
    const p = plan("ask_clarification", s, dc)!;
    p.requirements.push("x");
    p.missingRequirements.push("x");
    expect(s).toEqual(bs);
    expect(dc).toEqual(bd);
    expect(s.candidates[0].source).toEqual({ type: "inference", sourceIds: ["m1"] });
    expect(isDirectMemory(s.candidates[0].source)).toBe(false);
    expect(plan("ask_clarification", s)!.requirements).toEqual(["candidate"]);
  });

  it("X–AC – keine Uhr, Zufall, DB/API/LLM, Memory/Retrieval, Learning, Aktion", () => {
    expect(CODE).not.toMatch(
      /Date\.now|new Date|Math\.random|randomUUID|supabase|fetch\(|createServerFn|\.server"|insert\(|speak\(|process\.env|learn|emit|dispatch|retriev|memory|curiosity|energy|autonomy|impulse/i,
    );
  });

  it("AD – Phase 1–13 unverändert, action-plan.ts nirgends importiert", () => {
    const s = full();
    const before = structuredClone(s);
    for (const st of STRATS) plan(st, s);
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
        !f.endsWith("cognitive/action-plan.ts") &&
        /cognitive\/action-plan|\.\/action-plan/.test(readFileSync(f, "utf8")),
    );
    expect(users).toEqual([]);
    expect([...CODE.matchAll(/from "([^"]+)"/g)].map((m) => m[1])).toEqual(["./snapshot.ts"]);
  });
});
