import { describe, expect, it } from "vitest";
import {
  SEMANTIC_SIGNIFICANCE,
  derivedClaims,
  pickFollowUpSource,
  prioritizeBySemantic,
  provenancePrefix,
  semanticTypeOf,
} from "@/orb-core/memory-semantics";
import { CONVERSATION_CONTINUITY_RULE } from "@/orb-core/continuity-rules";

describe("Phase 6 Bedeutungsklassen", () => {
  it.each([
    ["Ich heiße Mario", "identity"],
    ["Ich habe zwei Kinder", "relationship"],
    ["Meine Frau holt manchmal das falsche Mehl", "relationship"],
    ["Ich esse gerne dünne Pizza", "preference"],
    ["Ich spiele Fortnite", "interest"],
    ["Ich bin Koch", "skill_role"],
    ["Ich habe ORB Core gebaut, weil ich Kontinuität wollte", "project_goal"],
    ["Ich habe heute Pizza gegessen", "episodic"],
    ["Das Wetter ist grau", "unknown"],
  ])("%s → %s", (text, type) => {
    expect(semanticTypeOf(text)).toBe(type);
  });

  it("Startprioritäten: Identität/Beziehung > Beruf/Projekt > Vorliebe > Episode", () => {
    expect(SEMANTIC_SIGNIFICANCE.identity).toBeGreaterThan(SEMANTIC_SIGNIFICANCE.skill_role);
    expect(SEMANTIC_SIGNIFICANCE.skill_role).toBeGreaterThan(SEMANTIC_SIGNIFICANCE.preference);
    expect(SEMANTIC_SIGNIFICANCE.preference).toBeGreaterThan(SEMANTIC_SIGNIFICANCE.episodic);
  });

  it("Frau-Mehl erzeugt keine Pizza-Vorliebe der Ehefrau", () => {
    expect(derivedClaims("Meine Frau holt manchmal das falsche Mehl")).toEqual([]);
    expect(semanticTypeOf("Meine Frau holt manchmal das falsche Mehl")).not.toBe("preference");
  });

  it("Fakt wird nie als Vermutung formuliert und umgekehrt", () => {
    expect(provenancePrefix("confirmed")).toBe("Du hast mir gesagt, dass");
    expect(provenancePrefix("inferred")).toBe("Meine Vermutung ist");
    expect(CONVERSATION_CONTINUITY_RULE).toContain("eine Ableitung nie als Fakt");
  });

  it("Abruf: passender Typ zuerst, ohne Kandidaten zu erfinden", () => {
    const c = [
      { id: "a", content: "Ich spiele Fortnite", relevance: 0.9 },
      { id: "b", content: "Ich heiße Mario", relevance: 0.2 },
    ];
    expect(prioritizeBySemantic("Wie heiße ich?", c).map((x) => x.id)).toEqual(["b", "a"]);
    expect(prioritizeBySemantic("Wie heiße ich?", [])).toEqual([]);
  });

  it("Nachfrage: Gesprächsthema schlägt themenfremde Erinnerung", () => {
    const pick = pickFollowUpSource(
      ["projekte"],
      [
        { id: "g", topic: "spiele", content: "Ich spiele Fortnite", gapScore: 0.9 },
        { id: "o", topic: "projekte", content: "Ich baue ORB Core", gapScore: 0.4 },
      ],
    );
    expect(pick?.id).toBe("o");
    expect(pickFollowUpSource(["projekte"], [{ id: "g", topic: "spiele", content: "x", gapScore: 1 }])).toBeNull();
  });
});
