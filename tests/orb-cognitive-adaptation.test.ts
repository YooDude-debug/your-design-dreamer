import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import * as mod from "@/orb-core/cognitive/adaptation";
import { assessAdaptation as ad, ADAPTATION_REASONS } from "@/orb-core/cognitive/adaptation";
import { createOutcome as out, type OrbOutcomeInput } from "@/orb-core/cognitive/outcome";

const CODE = readFileSync("src/orb-core/cognitive/adaptation.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const o = (i: OrbOutcomeInput = {}) => out({ outcomeStatus: "observed", ...i });
const ev = (success: boolean | null, usefulness: number | null = null, userFeedback = "unknown" as const) => ({
  success,
  usefulness,
  userFeedback,
});

describe("Phase 16 – Cognitive Learning / Adaptation Foundation", () => {
  it("A/N/S – leeres Outcome → no_adaptation, confidence 0", () => {
    expect(ad(out())).toEqual({
      type: "no_adaptation",
      evidence: {
        outcomeStatus: "unknown",
        outcomeMatch: "unknown",
        usefulness: null,
        userFeedback: "unknown",
        success: null,
      },
      confidence: 0,
      reasons: ["no_observable_evidence"],
      source: "explicit_outcome",
    });
    const n = ad(o());
    expect([n.type, n.confidence, n.reasons]).toEqual(["observe_more", 0, ["no_observable_evidence"]]);
  });

  it("B–E/Q – positive Signale → reinforce, confidence 1", () => {
    const cases: [ReturnType<typeof ad>, string][] = [
      [ad(o({ outcomeMatch: "matched" })), "matched_outcome"],
      [ad(o({ usefulness: 0.8 })), "high_usefulness"],
      [ad(o({ userFeedback: "positive" })), "positive_feedback"],
      [ad(o(), ev(true)), "explicit_success"],
    ];
    for (const [r, reason] of cases) {
      expect(r.type).toBe("reinforce");
      expect(r.confidence).toBe(1);
      expect(r.reasons).toEqual([reason]);
    }
    const all = ad(o({ outcomeMatch: "matched", userFeedback: "positive" }), ev(true, 0.9));
    expect([all.type, all.confidence]).toEqual(["reinforce", 1]);
  });

  it("F–I – negative Signale → caution", () => {
    const cases: [ReturnType<typeof ad>, string][] = [
      [ad(o({ outcomeMatch: "not_matched" })), "not_matched_outcome"],
      [ad(o({ usefulness: 0.2 })), "low_usefulness"],
      [ad(o({ userFeedback: "negative" })), "negative_feedback"],
      [ad(o(), ev(false)), "explicit_failure"],
    ];
    for (const [r, reason] of cases) {
      expect(r.type).toBe("caution");
      expect(r.reasons).toEqual([reason]);
    }
  });

  it("J/K/L/M/R – offene Signale → observe_more, confidence 0.5", () => {
    expect(ad(o({ outcomeStatus: "partially_observed" })).reasons).toEqual(["partial_observation"]);
    expect(ad(o({ outcomeMatch: "partially_matched" })).reasons).toEqual(["partial_match"]);
    const l = ad(o({ userFeedback: "neutral" }));
    expect([l.type, l.confidence, l.reasons]).toEqual(["observe_more", 0.5, ["neutral_feedback"]]);
    expect(ad(o({ usefulness: 0.5 })).type).toBe("observe_more");
    const m = ad(o({ outcomeMatch: "partially_matched" }), ev(null));
    expect(m.reasons).toEqual(["partial_match", "unknown_success"]);
    expect(ad(o(), ev(null)).reasons).toEqual(["unknown_success"]);
    expect(ad(out(), ev(null)).type).toBe("no_adaptation");
    const p = ad(o({ outcomeMatch: "matched", outcomeStatus: "partially_observed" }));
    expect([p.type, p.confidence]).toEqual(["reinforce", 0.5]);
  });

  it("O/P – gemischte Evidenz → observe_more, beide Signale, kein Gewinner", () => {
    const r = ad(o({ outcomeMatch: "matched", userFeedback: "negative" }));
    expect(r.type).toBe("observe_more");
    expect(r.confidence).toBe(0.5);
    expect(r.reasons).toEqual(["matched_outcome", "negative_feedback", "mixed_evidence"]);
    const s = ad(o({ outcomeMatch: "not_matched" }), ev(true));
    expect([s.type, s.reasons]).toEqual(["observe_more", ["explicit_success", "not_matched_outcome", "mixed_evidence"]]);
    const u = ad(o({ usefulness: 0.9 }), ev(null, 0.1));
    expect(u.type).toBe("observe_more");
    expect(u.evidence.usefulness).toBeNull();
  });

  it("T – ungültiges Outcome → confidence null", () => {
    for (const v of [null, undefined, "x", 3]) {
      const r = ad(v as never);
      expect([r.type, r.confidence]).toEqual(["no_adaptation", null]);
    }
  });

  it("U/V – feste Reason-Codes, source explicit_outcome", () => {
    const inputs = [
      ad(out()),
      ad(o({ outcomeMatch: "matched", userFeedback: "negative", usefulness: 0.5 }), ev(null, 0.9, "neutral")),
      ad(o({ outcomeStatus: "partially_observed", outcomeMatch: "partially_matched" }), ev(false)),
    ];
    for (const r of inputs) {
      for (const x of r.reasons) expect(ADAPTATION_REASONS).toContain(x);
      expect(r.source).toBe("explicit_outcome");
    }
    expect(ADAPTATION_REASONS).toHaveLength(14);
    expect(ad(o({ provenance: { type: "inference", sourceIds: ["m"] } })).source).toBe("explicit_outcome");
  });

  it("W–AA – kein Score, Ranking, Priorität, Auswahl, nextAction", () => {
    expect(Object.keys(mod).sort()).toEqual(["ADAPTATION_REASONS", "assessAdaptation"]);
    expect(Object.keys(ad(o())).sort()).toEqual(["confidence", "evidence", "reasons", "source", "type"]);
    expect(CODE).not.toMatch(/score|rank|winner|loser|priorit|weight|best|selected|recommend|nextAction|sort\(|Math\.|\.reduce\(/i);
  });

  it("AB–AF/AN–AP – keine Anwendung, Speicherung, Memory, Retrieval, DB/API/LLM, Aktion", () => {
    expect(CODE).not.toMatch(
      /Date\.now|new Date|performance\.now|Math\.random|randomUUID|uuid|supabase|fetch\(|createServerFn|\.server"|insert\(|update\(|speak\(|process\.env|writeFile|localStorage|emit|dispatch|retriev|memory|curiosity|energy|autonomy|impulse|strateg|threshold/i,
    );
  });

  it("AG/AH/AI – deterministisch", () => {
    const i = o({ outcomeMatch: "matched", usefulness: 0.3 });
    expect(ad(i, ev(true))).toEqual(ad(i, ev(true)));
  });

  it("AJ/AK – Input und Provenance unverändert", () => {
    const i = o({ outcomeMatch: "matched", provenance: { type: "inference", sourceIds: ["m1"] } });
    const e = ev(true, 0.9, "positive");
    const bi = structuredClone(i);
    const be = structuredClone(e);
    const r = ad(i, e);
    r.reasons.push("mixed_evidence");
    expect(i).toEqual(bi);
    expect(e).toEqual(be);
    expect(i.provenance).toEqual({ type: "inference", sourceIds: ["m1"] });
    expect(Object.keys(r)).not.toContain("provenance");
  });

  it("AL/AM – Phase 1–15 unverändert, keine Imports, nirgends importiert", () => {
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
      (f) => !f.endsWith("cognitive/adaptation.ts") && /cognitive\/adaptation|\.\/adaptation/.test(readFileSync(f, "utf8")),
    );
    expect(users).toEqual([]);
  });
});
