/**
 * ORB Core – Smoke Test für den kontrollierten Rollout (Phase 4).
 *
 * Dieser Test prüft ausschliesslich Grundfunktionen („antwortet der Kern
 * überhaupt?“) und ist ausdrücklich unabhängig von einem einzelnen Fix. Er darf
 * daher sowohl vor als auch nach einem Rollout laufen.
 */

import { describe, it, expect } from "vitest";

import { contentTokens, normKey, similarity, topicOf, memoryRelevance } from "@/orb-core/memory";
import { infoDomainOf, questionIntentOf, topicAffinity } from "@/orb-core/recall";

describe("ORB Core Smoke: Kernmodule antworten", () => {
  it("Speicher-Normalisierung liefert stabile Schlüssel", () => {
    expect(normKey("  Ich bin 36 Jahre.  ")).toBe(normKey("ich bin 36 jahre"));
    expect(similarity("ich bin 36 jahre", "ich bin 36 jahre")).toBeCloseTo(1, 5);
  });

  it("Tokenisierung liefert verwertbare Inhaltswörter", () => {
    const tokens = contentTokens("Ich habe eine neue Grafikkarte gekauft");
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens).toContain("grafikkarte");
  });

  it("Themenerkennung und Wissensdomänen antworten deterministisch", () => {
    const topic = topicOf("Ich fliege nach Japan");
    expect(typeof topic === "string" && topic.length > 0).toBe(true);
    expect(topicOf("Ich fliege nach Japan")).toBe(topic);
    expect(infoDomainOf("Welche Grafikkarte habe ich?")).toBe("hardware");
    expect(questionIntentOf("Wie alt bin ich?")).not.toBe(undefined);
  });

  it("Relevanzbewertung liefert einen Wert im erwarteten Bereich", () => {
    const now = Date.now();
    const score = memoryRelevance({
      similarity: 0.5,
      weight: 0.8,
      importance: 0.6,
      lastAccessedAt: now - 3600_000,
      activationCount: 2,
      now,
    });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThan(0);
  });

  it("Themenaffinität bleibt im gültigen Wertebereich", () => {
    const value = topicAffinity("Wie alt bin ich?", "Ich bin 36 Jahre.");
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });
});
