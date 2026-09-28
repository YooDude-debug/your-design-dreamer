import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import * as mod from "@/orb-core/cognitive/outcome";
import { createOutcome as out } from "@/orb-core/cognitive/outcome";
import { createActionPlan } from "@/orb-core/cognitive/action-plan";
import { createCognitiveSnapshot as snap } from "@/orb-core/cognitive/snapshot";
import { isDirectMemory } from "@/orb-core/cognitive/foundation";

const CODE = readFileSync("src/orb-core/cognitive/outcome.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const FULL = {
  actionId: "act-1",
  expectedOutcome: "Nutzer antwortet",
  actualOutcome: "Nutzer antwortet",
  outcomeStatus: "observed" as const,
  outcomeMatch: "not_matched" as const,
  usefulness: 0.4,
  userFeedback: "negative" as const,
  source: "conversation",
  createdAt: "2026-09-28T14:00:00Z",
  provenance: { type: "inference", sourceIds: ["m1", "m2"] },
};
const EMPTY = {
  actionId: null,
  expectedOutcome: null,
  actualOutcome: null,
  outcomeStatus: "unknown",
  outcomeMatch: "unknown",
  usefulness: null,
  userFeedback: "unknown",
  source: null,
  createdAt: null,
  provenance: undefined,
};

describe("Phase 15 – Cognitive Outcome & Feedback Foundation", () => {
  it("A – leerer Input → neutrale Defaults", () => {
    expect(out()).toEqual(EMPTY);
    expect(out({})).toEqual(EMPTY);
    expect(out(null)).toEqual(EMPTY);
  });

  it("B – vollständig befüllt → wörtlich übernommen", () => {
    expect(out(FULL)).toEqual(FULL);
  });

  it("C/D/E/AP – fehlende Texte/ID bleiben null, keine ID-Erzeugung", () => {
    const o = out({ outcomeStatus: "observed" });
    expect(o.actionId).toBeNull();
    expect(o.expectedOutcome).toBeNull();
    expect(o.actualOutcome).toBeNull();
    expect(out({ actionId: 5 as unknown as string }).actionId).toBeNull();
  });

  it("F/G/H – outcomeStatus nur übernommen", () => {
    expect(out({ outcomeStatus: "observed" }).outcomeStatus).toBe("observed");
    expect(out({ outcomeStatus: "partially_observed" }).outcomeStatus).toBe("partially_observed");
    expect(out({ outcomeStatus: "unknown", actualOutcome: "alles klar" }).outcomeStatus).toBe("unknown");
  });

  it("I/J/K/L – outcomeMatch nur übernommen", () => {
    for (const m of ["matched", "partially_matched", "not_matched", "unknown"] as const)
      expect(out({ outcomeMatch: m }).outcomeMatch).toBe(m);
  });

  it("M/N/O/P – usefulness explizit, ungültig → null, kein Begrenzen", () => {
    expect(out({ usefulness: 0 }).usefulness).toBe(0);
    expect(out({ usefulness: 1 }).usefulness).toBe(1);
    expect(out({ usefulness: 0.37 }).usefulness).toBe(0.37);
    for (const v of [-0.01, 1.01, 5, NaN, Infinity, "0.5", null, undefined])
      expect(out({ usefulness: v as number }).usefulness).toBeNull();
  });

  it("Q/R/S/T – userFeedback nur übernommen", () => {
    for (const f of ["positive", "negative", "neutral", "unknown"] as const)
      expect(out({ userFeedback: f }).userFeedback).toBe(f);
  });

  it("U – ungültige Enum-Werte → unknown, nie ein anderer Wert", () => {
    const o = out({
      outcomeStatus: "Observed" as never,
      outcomeMatch: "match" as never,
      userFeedback: "good" as never,
    });
    expect([o.outcomeStatus, o.outcomeMatch, o.userFeedback]).toEqual(["unknown", "unknown", "unknown"]);
    expect(out({ userFeedback: "__proto__" as never }).userFeedback).toBe("unknown");
  });

  it("V/W – Provenance unverändert, Inference bleibt Inference", () => {
    const o = out(FULL);
    expect(o.provenance).toEqual(FULL.provenance);
    expect(o.provenance).not.toBe(FULL.provenance);
    expect(isDirectMemory(o.provenance as never)).toBe(false);
    expect(out({ provenance: { type: "memory", memoryId: "m" } }).provenance).toEqual({ type: "memory", memoryId: "m" });
    expect(out({ provenance: "frei" }).provenance).toBe("frei");
  });

  it("X – deterministisch", () => {
    expect(out(FULL)).toEqual(out(FULL));
  });

  it("AA/AB/AC – kein Vergleich, keine Text-/Stimmungsauswertung", () => {
    const same = out({ expectedOutcome: "x", actualOutcome: "x" });
    expect(same.outcomeMatch).toBe("unknown");
    const t = out({ actualOutcome: "Super, danke!!! 😂👍", expectedOutcome: "y" });
    expect([t.userFeedback, t.outcomeStatus, t.outcomeMatch, t.usefulness]).toEqual([
      "unknown",
      "unknown",
      "unknown",
      null,
    ]);
    expect(CODE).not.toMatch(/===\s*i\.expected|expectedOutcome\s*===|localeCompare|toLowerCase|\.length|sentiment|emoji/i);
  });

  it("AI – Input und Action Plan unverändert", () => {
    const input = structuredClone(FULL);
    const o = out(input);
    (o.provenance as { sourceIds: string[] }).sourceIds.push("x");
    expect(input).toEqual(FULL);
    const s = snap();
    const p = createActionPlan("observe", s)!;
    const bp = structuredClone(p);
    out({ actionId: p.action, provenance: p });
    expect(p).toEqual(bp);
  });

  it("AJ–AM – kein Score, Ranking, Priorität, nextAction", () => {
    expect(Object.keys(mod)).toEqual(["createOutcome"]);
    expect(Object.keys(out(FULL)).sort()).toEqual(Object.keys(EMPTY).sort());
    expect(CODE).not.toMatch(/score|rank|winner|loser|priorit|weight|best|selected|recommend|nextAction|sort\(|Math\.|\.reduce\(/i);
  });

  it("Y/Z/AQ/AD–AH – keine Uhr, Zufall, Learning, Strategie, Memory, DB/API/LLM, Aktion", () => {
    expect(CODE).not.toMatch(
      /Date\.now|new Date|performance\.now|Math\.random|randomUUID|uuid|supabase|fetch\(|createServerFn|\.server"|insert\(|speak\(|process\.env|learn|adapt|emit|dispatch|retriev|memory|curiosity|energy|autonomy|impulse|strateg/i,
    );
    expect(out().createdAt).toBeNull();
  });

  it("AN/AO – Phase 1–14 unverändert, keine Imports, nirgends importiert", () => {
    expect(CODE).not.toMatch(/\bimport\b/);
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
      (f) => !f.endsWith("cognitive/outcome.ts") && /cognitive\/outcome|\.\/outcome/.test(readFileSync(f, "utf8")),
    );
    expect(users).toEqual([]);
  });
});
