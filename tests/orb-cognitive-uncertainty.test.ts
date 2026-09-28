import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { assessCognitiveUncertainty } from "@/orb-core/cognitive/uncertainty";
import { isDirectMemory, type OrbInformationSource } from "@/orb-core/cognitive/foundation";
import { memoryRelevance } from "@/orb-core/memory";
import { relevanceScore } from "@/orb-core/core";

const mem: OrbInformationSource = { type: "memory", memoryId: "m1" };
const conv: OrbInformationSource = { type: "conversation", messageId: "c1" };
const inf: OrbInformationSource = { type: "inference", sourceIds: ["m1"] };

describe("Phase 4 – Cognitive Uncertainty", () => {
  it("A/B/C/D – Quellenarten geordnet", () => {
    const u = (s: unknown) => assessCognitiveUncertainty({ source: s }).factors;
    expect(u(mem).sourceCertainty).toBe(0.1);
    expect(u(mem).inferenceDependency).toBe(0);
    expect(u(conv).sourceCertainty).toBe(0.2);
    expect(u(inf).sourceCertainty).toBe(0.6);
    expect(u(inf).inferenceDependency).toBe(0.5);
    expect(u({ type: "unknown" }).sourceCertainty).toBe(1);
    expect(u({ type: "unknown" }).missingEvidence).toBe(1);
    expect(u({ type: "unknown" }).inferenceDependency).toBeNull();
  });

  it("E – zwei übereinstimmende Quellen", () => {
    const a = assessCognitiveUncertainty({
      statement: "Der Benutzer arbeitet an Projekt X",
      source: conv,
      others: [{ text: "Der Benutzer arbeitet an Projekt X", source: mem }],
    });
    expect(a.factors.sourceAgreement).toBe(0);
    expect(a.factors.contradiction).toBe(0);
    expect(a.agreeingSources).toEqual([mem]);
  });

  it("F/Q – widersprüchliche Quellen, keine Wahrheitsentscheidung", () => {
    const other = { text: "Das Lieblingsspiel ist Elden Ring", source: mem };
    const a = assessCognitiveUncertainty({
      statement: "Das Lieblingsspiel ist Tetris",
      source: conv,
      others: [other],
    });
    expect(a.factors.contradiction).toBe(1);
    expect(a.factors.sourceAgreement).toBe(1);
    expect(a.contradictions[0].incoming).toEqual(conv);
    expect(a.contradictions[0].existing).toEqual(mem);
    const r = a as unknown as Record<string, unknown>;
    expect(r.winner).toBeUndefined();
    expect(r.truth).toBeUndefined();
  });

  it("einzelne Quelle → keine künstliche Übereinstimmung", () => {
    expect(
      assessCognitiveUncertainty({ statement: "X ist A", source: mem }).factors.sourceAgreement,
    ).toBeNull();
    expect(
      assessCognitiveUncertainty({ statement: "X ist A", source: mem, others: [] }).factors
        .sourceAgreement,
    ).toBeNull();
  });

  it("G – fehlende Evidenz ≠ falsch", () => {
    const a = assessCognitiveUncertainty({
      statement: "ORB vermutet etwas",
      source: { type: "bogus" },
    });
    expect(a.factors.missingEvidence).toBe(1);
    expect(a.provenance).toEqual({ type: "unknown" });
    const r = a as unknown as Record<string, unknown>;
    expect(r.isFalse).toBeUndefined();
    expect(r.valid).toBeUndefined();
  });

  it("H/I – Zeit nur bei zeitabhängiger Information", () => {
    const base = { source: mem, observedAt: "2026-01-01T00:00:00Z", now: "2026-09-28T00:00:00Z" };
    expect(
      assessCognitiveUncertainty({ ...base, statement: "Arbeitet heute an X", timeDependent: true })
        .factors.recencyUncertainty,
    ).toBe(1);
    expect(
      assessCognitiveUncertainty({
        ...base,
        statement: "Hat X einmal entwickelt",
        timeDependent: false,
      }).factors.recencyUncertainty,
    ).toBe(0);
    expect(assessCognitiveUncertainty({ ...base }).factors.recencyUncertainty).toBeNull();
    expect(
      assessCognitiveUncertainty({ source: mem, timeDependent: true }).factors.recencyUncertainty,
    ).toBeNull();
  });

  it("J – mehrstufige Inference unsicherer als direkte", () => {
    const one = assessCognitiveUncertainty({ source: inf }).factors.inferenceDependency!;
    const two = assessCognitiveUncertainty({ source: inf, inferenceDepth: 2 }).factors
      .inferenceDependency!;
    expect(two).toBeGreaterThan(one);
    expect(one).toBeGreaterThan(0);
  });

  it("K/L/M/N – NaN, Infinity, clamp, null", () => {
    const a = assessCognitiveUncertainty({
      source: mem,
      factors: {
        sourceCertainty: NaN,
        contradiction: Infinity,
        missingEvidence: 5,
        recencyUncertainty: -3,
        sourceAgreement: null,
      },
    });
    expect(a.factors.sourceCertainty).toBeNull();
    expect(a.factors.contradiction).toBeNull();
    expect(a.invalidFactors).toEqual(["sourceCertainty", "contradiction"]);
    expect(a.factors.missingEvidence).toBe(1);
    expect(a.factors.recencyUncertainty).toBe(0);
    expect(a.factors.sourceAgreement).toBeNull();
    expect(assessCognitiveUncertainty().unknownFactors).toEqual([
      "sourceAgreement",
      "contradiction",
      "inferenceDependency",
      "recencyUncertainty",
    ]);
  });

  it("O/P – Provenance unverändert, Inference nie Memory", () => {
    const snap = JSON.stringify(inf);
    const a = assessCognitiveUncertainty({
      source: inf,
      statement: "Y",
      others: [{ text: "Y", source: mem }],
    });
    expect(a.provenance).toEqual(inf);
    expect(a.provenance).not.toBe(inf);
    expect(isDirectMemory(a.provenance)).toBe(false);
    expect(a.basedOnInference).toBe(true);
    expect(JSON.stringify(inf)).toBe(snap);
  });

  it("R – kein Gesamtscore; confidence ist nur Abdeckung", () => {
    const a = assessCognitiveUncertainty({ source: mem }) as unknown as Record<string, unknown>;
    expect(a.overallUncertainty).toBeUndefined();
    expect(a.score).toBeUndefined();
    expect(a.confidence).toBe(0.5);
  });

  it("S/T/U/V – deterministisch, keine Uhr/Zufall/DB/API/LLM, nicht eingebunden", () => {
    const i = {
      statement: "X ist A",
      source: conv,
      others: [{ text: "X ist B", source: mem }],
      timeDependent: true,
      observedAt: "2026-09-01T00:00:00Z",
      now: "2026-09-28T00:00:00Z",
    };
    expect(assessCognitiveUncertainty(i)).toEqual(assessCognitiveUncertainty(i));
    const src = readFileSync("src/orb-core/cognitive/uncertainty.ts", "utf8");
    expect(src).not.toMatch(
      /Date\.now|Math\.random|supabase|fetch\(|createServerFn|\.server|insert\(|speak\(|process\.env/,
    );
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
        !f.endsWith("cognitive/uncertainty.ts") &&
        f !== "src/orb-core/cognitive-observation.ts" &&
        readFileSync(f, "utf8").includes("cognitive/uncertainty"),
    );
    // Einzige erlaubte Ausnahme: der Cognitive-Observation-Einstieg.
    expect(users).toEqual([]);
  });

  it("W – bestehende ORB-Scores unverändert", () => {
    const before = relevanceScore(0.5, 0.7, 0.3);
    assessCognitiveUncertainty({
      source: mem,
      statement: "X ist A",
      others: [{ text: "X ist B", source: conv }],
    });
    expect(relevanceScore(0.5, 0.7, 0.3)).toBe(before);
    expect(typeof memoryRelevance).toBe("function");
  });
});
