import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import * as mod from "@/orb-core/cognitive/snapshot";
import { createCognitiveSnapshot as snap } from "@/orb-core/cognitive/snapshot";
import { createCognitiveCandidate as mk } from "@/orb-core/cognitive/candidate";
import { compareCognitiveCandidates } from "@/orb-core/cognitive/competition";
import { assessCognitiveAttention } from "@/orb-core/cognitive/attention";
import { assessCognitiveExperience } from "@/orb-core/cognitive/experience";
import { detectContradiction } from "@/orb-core/cognitive/contradiction";
import { isDirectMemory, type OrbGoal } from "@/orb-core/cognitive/foundation";

const focus = { kind: "task" as const, id: "t1" };
const goal: OrbGoal = {
  id: "g1",
  title: "Y-Dude",
  priority: 0.4,
  status: "active",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};
const build = () => {
  const a = mk({
    id: "b",
    topic: "Zweites Thema",
    source: { type: "inference", sourceIds: ["m1"] },
    attention: assessCognitiveAttention({ focus, currentFocus: 0.9 }),
  });
  const b = mk({ id: "a", topic: "Erstes Thema", source: { type: "memory", memoryId: "m1" } });
  return {
    currentFocus: focus,
    attentionAvailability: 0.3,
    candidates: [a, b],
    competitions: [compareCognitiveCandidates(a, b)],
    goals: [goal],
    experiences: [assessCognitiveExperience({ actionId: "x1" })],
    conflicts: [
      detectContradiction(
        { subject: "s", predicate: "ist", value: "1" },
        { subject: "s", predicate: "ist", value: "2" },
      ),
    ],
  };
};
const CODE = readFileSync("src/orb-core/cognitive/snapshot.ts", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("Phase 11 – Cognitive Snapshot", () => {
  it("A/F/G/H/I – vollständiger Snapshot übernimmt alles unverändert", () => {
    expect(snap(build())).toEqual(build());
  });

  it("B/C/D – nur Fokus; fehlend → null / []", () => {
    const s = snap({ currentFocus: focus });
    expect(s.currentFocus).toEqual(focus);
    expect(s.candidates).toEqual([]);
    expect(s.competitions).toEqual([]);
    expect(s.goals).toEqual([]);
    expect(s.experiences).toEqual([]);
    expect(s.conflicts).toEqual([]);
    expect(snap().currentFocus).toBeNull();
    expect(snap({ currentFocus: { kind: "erfunden", id: "x" } }).currentFocus).toBeNull();
  });

  it("E/M/N – Reihenfolge erhalten, keine Auswahl, keine Sortierung", () => {
    const s = snap(build());
    expect(s.candidates.map((c) => c.id)).toEqual(["b", "a"]);
    const dup = mk({ id: "a" });
    expect(snap({ candidates: [dup, dup] }).candidates).toHaveLength(2);
  });

  it("J/K/L – attentionAvailability nur explizit", () => {
    expect(snap({ attentionAvailability: 0.7 }).attentionAvailability).toBe(0.7);
    expect(snap({}).attentionAvailability).toBeNull();
    for (const v of [NaN, Infinity, 2, -1, "0.5"])
      expect(snap({ attentionAvailability: v }).attentionAvailability).toBeNull();
    const withCands = snap({ candidates: build().candidates });
    expect(withCands.attentionAvailability).toBeNull();
    expect(withCands.currentFocus).toBeNull();
    expect(withCands.competitions).toEqual([]);
  });

  it("O/P/Q/R – kein Score, keine Strategie, keine Aktion", () => {
    const s = snap(build()) as unknown as Record<string, unknown>;
    expect(Object.keys(s).sort()).toEqual([
      "attentionAvailability",
      "candidates",
      "competitions",
      "conflicts",
      "currentFocus",
      "experiences",
      "goals",
    ]);
    expect(Object.keys(mod)).toEqual(["createCognitiveSnapshot"]);
    expect(CODE).not.toMatch(
      /score|strategy|action|decision|sort\(|rank|select|best|priorit|Math\./i,
    );
  });

  it("S/T – Provenance erhalten, Inference bleibt Inference", () => {
    const s = snap(build());
    expect(s.candidates[0].source).toEqual({ type: "inference", sourceIds: ["m1"] });
    expect(isDirectMemory(s.candidates[0].source)).toBe(false);
    expect(s.candidates[1].source).toEqual({ type: "memory", memoryId: "m1" });
  });

  it("U–Z – keine Mutation, Arrays und Objekte isoliert", () => {
    const input = build();
    const before = structuredClone(input);
    const s = snap(input);
    s.candidates.push(mk({ id: "neu" }));
    s.competitions.push(s.competitions[0]);
    s.goals.push(goal);
    s.experiences.push(s.experiences[0]);
    s.conflicts.push(s.conflicts[0]);
    s.candidates[0].topic = "geändert";
    s.goals[0].priority = 1;
    if (s.currentFocus) s.currentFocus.id = "x";
    expect(input).toEqual(before);
  });

  it("AA – deterministisch", () => {
    expect(snap(build())).toEqual(snap(build()));
  });

  it("AB–AF – keine Uhr, Zufall, DB/API/LLM, Learning, Aktion", () => {
    expect(CODE).not.toMatch(
      /Date\.now|new Date|Math\.random|randomUUID|supabase|fetch\(|createServerFn|\.server"|insert\(|speak\(|process\.env|learn|emit|dispatch/i,
    );
  });

  it("AG/AH – Phase 1–10 unverändert, snapshot.ts nirgends importiert", () => {
    const before = build();
    snap(before);
    expect(build()).toEqual(before);
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
        !f.endsWith("cognitive/snapshot.ts") &&
        f !== "src/orb-core/cognitive-observation.ts" &&
        /cognitive\/snapshot"|\.\/snapshot"/.test(readFileSync(f, "utf8")) &&
        f.includes("orb-core/cognitive"),
    );
    const users2 = files.filter(
      (f) =>
        !f.endsWith("cognitive/snapshot.ts") &&
        f !== "src/orb-core/cognitive-observation.ts" &&
        readFileSync(f, "utf8").includes("cognitive/snapshot"),
    );
    // Einzige erlaubte Ausnahme: der Cognitive-Observation-Einstieg.
    expect([...users, ...users2]).toEqual([]);
  });
});
