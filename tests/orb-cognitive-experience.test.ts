import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { assessCognitiveExperience } from "@/orb-core/cognitive/experience";
import { isDirectMemory, type OrbInformationSource } from "@/orb-core/cognitive/foundation";

const conv: OrbInformationSource = { type: "conversation", messageId: "c1" };
const full = {
  actionId: "question-123",
  expectedOutcome: "Benutzer beantwortet die Frage",
  actualOutcome: "Benutzer hat ausführlich geantwortet",
  outcomeStatus: "observed",
  expectation: 0.8,
  outcomeObservability: 0.9,
  outcomeMatch: 0.85,
  success: true,
  usefulness: 0.7,
  userFeedback: "positive",
  createdAt: "2026-09-28T09:00:00Z",
  observedAt: "2026-09-28T09:05:00Z",
  source: conv,
};
const run = (o: Parameters<typeof assessCognitiveExperience>[0]) => assessCognitiveExperience(o);

describe("Phase 7 – Cognitive Experience", () => {
  it("A – vollständige Experience", () => {
    const a = run(full);
    expect(a.actionId).toBe("question-123");
    expect(a.outcomeStatus).toBe("observed");
    expect(a.factors).toEqual({
      expectation: 0.8,
      outcomeObservability: 0.9,
      outcomeMatch: 0.85,
      usefulness: 0.7,
      success: true,
      userFeedback: "positive",
    });
    expect(a.completeness).toBe(1);
    expect(a.observedAt).toBe(full.observedAt);
  });

  it("B/C – fehlende Erwartung / fehlendes Outcome → null", () => {
    const a = run({ actualOutcome: "x" });
    expect(a.expectedOutcome).toBeNull();
    expect(a.factors.expectation).toBeNull();
    const b = run({ expectedOutcome: "x" });
    expect(b.actualOutcome).toBeNull();
    expect(b.factors.outcomeMatch).toBeNull();
    expect(run({}).actionId).toBeNull();
  });

  it("D/E/F – Outcome-Status", () => {
    expect(run({ outcomeStatus: "observed" }).outcomeStatus).toBe("observed");
    expect(run({ outcomeStatus: "partially_observed" }).outcomeStatus).toBe("partially_observed");
    expect(run({ outcomeStatus: "unknown" }).outcomeStatus).toBe("unknown");
    expect(run({}).outcomeStatus).toBe("unknown");
    const bad = run({ outcomeStatus: "probably" });
    expect(bad.outcomeStatus).toBe("unknown");
    expect(bad.invalidFields).toContain("outcomeStatus");
  });

  it("G/H/I/R – success nur explizit, fehlend ≠ false", () => {
    expect(run({ success: true }).factors.success).toBe(true);
    expect(run({ success: false }).factors.success).toBe(false);
    expect(run({ success: null }).factors.success).toBeNull();
    expect(run({}).factors.success).toBeNull();
    expect(run({ success: 1 }).factors.success).toBeNull();
    const same = run({ expectedOutcome: "A", actualOutcome: "A", outcomeStatus: "observed" });
    expect(same.factors.success).toBeNull();
    expect(same.factors.outcomeMatch).toBeNull();
  });

  it("J/K/Q – usefulness nur explizit, nie aus Antwortlänge", () => {
    expect(run({ usefulness: 0.6 }).factors.usefulness).toBe(0.6);
    expect(run({}).factors.usefulness).toBeNull();
    const long = run({ actualOutcome: "x".repeat(5000), outcomeStatus: "observed" });
    expect(long.factors.usefulness).toBeNull();
  });

  it("L/M/N/O/P – nur explizites Feedback, Emoji nicht interpretiert", () => {
    expect(run({ userFeedback: "positive" }).factors.userFeedback).toBe("positive");
    expect(run({ userFeedback: "negative" }).factors.userFeedback).toBe("negative");
    expect(run({ userFeedback: "neutral" }).factors.userFeedback).toBe("neutral");
    expect(run({ userFeedback: "unknown" }).factors.userFeedback).toBe("unknown");
    const emoji = run({ userFeedback: "😂", actualOutcome: "😂" });
    expect(emoji.factors.userFeedback).toBe("unknown");
    expect(emoji.invalidFields).toContain("userFeedback");
    expect(run({ actualOutcome: "Das war hilfreich." }).factors.userFeedback).toBe("unknown");
  });

  it("S/T – Provenance unverändert, Inference nie Memory", () => {
    const inf: OrbInformationSource = { type: "inference", sourceIds: ["m1"] };
    const snap = JSON.stringify(inf);
    const a = run({ source: inf, userFeedback: "positive" });
    expect(a.provenance).toEqual(inf);
    expect(a.provenance).not.toBe(inf);
    expect(isDirectMemory(a.provenance)).toBe(false);
    expect(a.basedOnInference).toBe(true);
    expect(JSON.stringify(inf)).toBe(snap);
    expect(run({}).provenance).toEqual({ type: "unknown" });
  });

  it("U/V/W – NaN, Infinity, clamp", () => {
    const a = run({
      expectation: NaN,
      outcomeObservability: Infinity,
      outcomeMatch: -Infinity,
      usefulness: 4,
    });
    expect(a.factors.expectation).toBeNull();
    expect(a.factors.outcomeObservability).toBeNull();
    expect(a.factors.outcomeMatch).toBeNull();
    expect(a.invalidFields).toEqual(["expectation", "outcomeObservability", "outcomeMatch"]);
    expect(a.factors.usefulness).toBe(1);
    expect(run({ usefulness: -1 }).factors.usefulness).toBe(0);
    expect(run({ usefulness: "0.5" }).factors.usefulness).toBeNull();
  });

  it("AE/AF – kein Gesamtscore, completeness nur Vollständigkeit", () => {
    const a = run(full) as unknown as Record<string, unknown>;
    for (const k of ["score", "experienceScore", "learningValue", "quality"])
      expect(a[k]).toBeUndefined();
    const bad = run({
      success: false,
      usefulness: 0,
      userFeedback: "negative",
      outcomeStatus: "observed",
    });
    const good = run({
      success: true,
      usefulness: 1,
      userFeedback: "positive",
      outcomeStatus: "observed",
    });
    expect(bad.completeness).toBe(good.completeness);
  });

  it("X/AB/AC – deterministisch, keine Mutation/Persistierung/Learning", () => {
    const i = { ...full };
    const snap = JSON.stringify(i);
    expect(run(i)).toEqual(run(i));
    expect(JSON.stringify(i)).toBe(snap);
    const a = run(i) as unknown as Record<string, unknown>;
    for (const k of ["save", "persist", "learn", "weights", "strategy"])
      expect(a[k]).toBeUndefined();
  });

  it("Y/Z/AA – keine Uhr/Zufall/DB/API/LLM, nicht eingebunden", () => {
    const src = readFileSync("src/orb-core/cognitive/experience.ts", "utf8");
    expect(src).not.toMatch(
      /Date\.now|new Date\(|Math\.random|randomUUID|supabase|fetch\(|createServerFn|\.server"|insert\(|speak\(|process\.env/,
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
        !f.endsWith("cognitive/experience.ts") &&
        f !== "src/orb-core/cognitive-observation.ts" &&
        readFileSync(f, "utf8").includes("cognitive/experience"),
    );
    // Einzige erlaubte Ausnahme: der Cognitive-Observation-Einstieg.
    expect(users).toEqual([]);
  });

  it("AD – Phase 1–6 nicht von experience.ts abhängig", () => {
    for (const f of [
      "foundation",
      "relevance",
      "novelty",
      "uncertainty",
      "goal-pressure",
      "attention",
    ]) {
      const src = readFileSync(`src/orb-core/cognitive/${f}.ts`, "utf8");
      expect(src.includes("cognitive/experience")).toBe(false);
      expect(createHash("sha256").update(src).digest("hex")).toHaveLength(64);
    }
  });
});
