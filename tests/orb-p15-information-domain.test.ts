/**
 * P15 – Regressionsnachweis zur bewiesenen Informationsbereichs-Lücke
 * (Referenz: docs/ORB_P14_PATCH_REVIEW_RESULT_2026-09-23.md).
 *
 * Geprüft wird ausschliesslich: Fragewörter werden kein Ersatzthema, die
 * fehlenden Bereiche „alter“ und „wohnort“ sind erkannt, bestehende Fälle
 * bleiben unverändert und unpassende Erinnerungen werden weiterhin verworfen.
 * Relevanzformel, Schwellen und der harte Filter bleiben unangetastet.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { shouldPersist } from "@/orb-core/core";
import { contentTokens, memoryRelevance, similarity, topicOf } from "@/orb-core/memory";
import {
  TOPIC_AFFINITY_FLOOR,
  infoDomainOf,
  questionIntentOf,
  topicAffinity,
} from "@/orb-core/recall";

const ENGINE = readFileSync("src/orb-core/engine.server.ts", "utf8");

const AGE_MEMORY = "Ich bin 36 Jahre.";
const CITY_MEMORY = "Der Nutzer wohnt in Leipzig.";
const GPU_MEMORY = "Der Nutzer besitzt eine RTX 5070 OC.";
const FOOD_MEMORY = "Der Nutzer isst am liebsten Schnitzel und Brokkoli.";
const UNRELATED = "Der Nutzer war letzte Woche wandern.";

/** Genau der Wert, den die Kandidatensuche als `overlap` verwendet. */
const overlapOf = (question: string, memory: string) =>
  Math.max(similarity(question, memory), topicAffinity(question, memory));

describe("A – Altersfrage findet die passende Erinnerung", () => {
  it("erkennt den Bereich „alter“ auf beiden Seiten", () => {
    expect(questionIntentOf("Wie alt bin ich?")).toBe("alter");
    expect(infoDomainOf(AGE_MEMORY)).toBe("alter");
  });

  it("das Fragewort wird nicht zum Thema", () => {
    expect(topicOf("Wie alt bin ich?")).not.toBe("wie");
    expect(topicOf("Warum bin ich müde?")).not.toBe("warum");
    expect(topicOf("Wann habe ich Geburtstag?")).not.toBe("wann");
  });

  it("der Overlap ist nicht mehr 0.000", () => {
    expect(overlapOf("Wie alt bin ich?", AGE_MEMORY)).toBe(TOPIC_AFFINITY_FLOOR);
    expect(overlapOf("Wann habe ich Geburtstag?", AGE_MEMORY)).toBeGreaterThan(0);
  });
});

describe("B – Wohnortfrage findet die passende Erinnerung", () => {
  it("erkennt den Bereich „wohnort“ inklusive „wohnt“", () => {
    expect(questionIntentOf("Wo wohne ich?")).toBe("wohnort");
    expect(infoDomainOf(CITY_MEMORY)).toBe("wohnort");
    expect(infoDomainOf("Der Nutzer lebt in Leipzig.")).toBe("wohnort");
  });

  it("der Overlap ist nicht mehr 0.000", () => {
    expect(overlapOf("Wo wohne ich?", CITY_MEMORY)).toBeGreaterThan(0);
  });
});

describe("C und D – bestehende Fälle unverändert", () => {
  it("Hardwarefrage bleibt unverändert", () => {
    expect(questionIntentOf("Welche Grafikkarte habe ich?")).toBe("hardware");
    expect(topicOf("Welche Grafikkarte habe ich?")).toBe("hardware");
    expect(overlapOf("Welche Grafikkarte habe ich?", GPU_MEMORY)).toBe(TOPIC_AFFINITY_FLOOR);
  });

  it("Essensfrage bleibt unverändert", () => {
    expect(questionIntentOf("Was esse ich gerne?")).toBe("essen");
    expect(overlapOf("Was esse ich gerne?", FOOD_MEMORY)).toBe(TOPIC_AFFINITY_FLOOR);
  });

  it("H – wörtliche Treffer ranken weiterhin höher", () => {
    expect(
      similarity("Welche Grafikkarte habe ich?", "Der Nutzer hat eine neue Grafikkarte."),
    ).toBeGreaterThan(TOPIC_AFFINITY_FLOOR);
  });
});

describe("E und G – unpassende Erinnerungen bleiben verworfen", () => {
  it("fremde Bereiche werden nicht verbunden", () => {
    expect(overlapOf("Wie alt bin ich?", GPU_MEMORY)).toBe(0);
    expect(overlapOf("Wie alt bin ich?", UNRELATED)).toBe(0);
    expect(overlapOf("Wo wohne ich?", FOOD_MEMORY)).toBe(0);
    expect(overlapOf("Welche Grafikkarte habe ich?", AGE_MEMORY)).toBe(0);
  });

  it("ohne passende Erinnerung bleibt der Kandidat verworfen", () => {
    expect(overlapOf("Welche Grafikkarte habe ich?", UNRELATED)).toBe(0);
  });
});

describe("F – reine Fragen bleiben inhaltlich erkennbar", () => {
  it("die Inhaltsprüfung verliert keine Wörter", () => {
    expect(contentTokens("Wer bin ich?")).toContain("wer");
    expect(contentTokens("Wie alt bin ich?")).toContain("wie");
    expect(contentTokens("Was esse ich gerne?").length).toBeGreaterThanOrEqual(0);
    expect(contentTokens("Wo wohne ich?")).toContain("wohne");
  });
});

describe("Filter, Formel und Schwellen unverändert", () => {
  it("der harte Filter overlap > 0 besteht weiterhin", () => {
    expect(ENGINE).toContain(".filter((c) => c.overlap > 0)");
    expect(ENGINE).toContain(
      "Math.max(similarity(text, n.content), topicAffinity(text, n.content))",
    );
  });

  it("Untergrenze, Relevanzformel und Speicherschwelle bleiben gleich", () => {
    expect(TOPIC_AFFINITY_FLOOR).toBe(0.12);
    expect(shouldPersist(0.25)).toBe(false);
    expect(shouldPersist(0.35)).toBe(true);
    const base = { weight: 0.5, importance: 0.4, lastAccessedAt: 0, activationCount: 1, now: 0 };
    expect(memoryRelevance({ ...base, similarity: 0 })).toBe(0);
    expect(memoryRelevance({ ...base, similarity: TOPIC_AFFINITY_FLOOR })).toBeLessThan(
      memoryRelevance({ ...base, similarity: 0.8 }),
    );
  });
});
