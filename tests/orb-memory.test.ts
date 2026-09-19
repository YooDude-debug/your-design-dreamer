/**
 * ORB Core V0.2 – Tests der reinen Gedächtnislogik.
 * Szenarien: Duplikatvermeidung, Relevanz, Ebenen, Herkunft, Confidence,
 * Interessen, Feedback, Feed-Relevanz, Vorschlagsschwelle, Top-N.
 */

import { describe, expect, it } from "vitest";

import { W_MIN } from "@/orb-core/core";
import {
  ACTIVE_AUTONOMY_LEVEL,
  AUTONOMOUS_SOCIAL_ACTIONS_ENABLED,
  applyFeedbackToWeight,
  confidenceFor,
  contentTokens,
  feedbackDelta,
  feedRelevance,
  interestDelta,
  isAutonomyLevelActive,
  isSameMemory,
  LEVEL_LIMITS,
  memoryLevel,
  memoryRelevance,
  nextInterest,
  normKey,
  recencyFactor,
  selectByLevel,
  similarity,
  SUGGESTION_THRESHOLD,
  suggestionReason,
  topicOf,
  topicsOf,
  type InterestRow,
} from "@/orb-core/memory";

const HOUR = 3_600_000;
const now = Date.UTC(2026, 8, 19, 12, 0, 0);

describe("Normalisierung und Duplikatvermeidung", () => {
  it("entfernt Füll- und Bewertungswörter", () => {
    expect(contentTokens("Ich mag sehr gerne Pizza")).toEqual(["pizza"]);
  });

  it("erkennt nur wortgleiche Erfahrungen als Duplikat", () => {
    expect(isSameMemory("Ich mag Pizza.", "Ich mag Pizza!")).toBe(true);
    expect(normKey("Pizza essen")).toBe(normKey("Pizza essen."));
    // Umformulierungen sind keine offensichtlichen Duplikate mehr.
    expect(isSameMemory("Ich mag Pizza.", "Pizza esse ich sehr gerne.")).toBe(false);
    expect(normKey("Ich mag Pizza.")).not.toBe(normKey("Pizza!"));
  });

  it("führt semantisch Unterschiedliches niemals zusammen", () => {
    expect(isSameMemory("Pizza", "Pizza mit Ananas")).toBe(false);
    expect(isSameMemory("Ich mag Pizza.", "Ich mag keine Pizza.")).toBe(false);
    expect(isSameMemory("Pizza essen", "Pizza selbst machen")).toBe(false);
    expect(isSameMemory("Ich mag Pizza.", "Ich mag Pizza mit Ananas.")).toBe(false);
    expect(isSameMemory("Ich mag Grafikkarten.", "Ich mag Prozessoren.")).toBe(false);
  });

  it("unterscheidet Verneinungen im Schlüssel", () => {
    expect(normKey("Ich mag Pizza.")).not.toBe(normKey("Ich mag keine Pizza."));
    expect(normKey("Ich komme nicht.")).not.toBe(normKey("Ich komme."));
    expect(normKey("Ich mag kein Bier.")).toBe(normKey("Ich mag keine Bier."));
  });

  it("liefert für leere Inhalte keinen Schlüssel", () => {
    expect(normKey("und der die das")).toBe("");
    expect(isSameMemory("und", "oder")).toBe(false);
  });

  it("misst Ähnlichkeit ohne Gleichsetzung", () => {
    expect(similarity("Grafikkarte kaufen", "Grafikkarte verkaufen")).toBeGreaterThan(0);
    expect(similarity("Grafikkarte", "Pizza")).toBe(0);
    expect(similarity("Pizza", "Pizza mit Ananas")).toBeLessThan(1);
  });
});

describe("Themen und Interessen", () => {
  it("erkennt bekannte Themen", () => {
    expect(topicOf("Ich interessiere mich für PC-Hardware.")).toBe("hardware");
    expect(topicOf("Ich mag Grafikkarten.")).toBe("hardware");
    expect(topicOf("Ich zocke viel auf der Konsole.")).toBe("gaming");
    expect(topicsOf("Neue GPU für Gaming vorgestellt")).toContain("hardware");
  });

  it("bildet ein Interesse aus einer Aussage und verstärkt es", () => {
    const first = nextInterest(null, { topic: "hardware", source: "user_stated", importance: 0.8 });
    expect(first.weight).toBeGreaterThan(0);
    expect(first.confidence).toBe(0.9);
    const second = nextInterest(first, {
      topic: "hardware",
      source: "user_stated",
      importance: 0.8,
    });
    expect(second.weight).toBeGreaterThan(first.weight);
    expect(second.activationCount).toBe(2);
  });

  it("wertet eine Beobachtung schwächer als eine Aussage", () => {
    expect(interestDelta("observed", 0.8)).toBeLessThan(interestDelta("user_stated", 0.8));
    expect(confidenceFor("observed")).toBeLessThan(confidenceFor("user_stated"));
    expect(confidenceFor("inferred")).toBeCloseTo(0.65, 5);
    expect(confidenceFor("observed", 4)).toBeLessThanOrEqual(0.85);
  });

  it("stuft eine Beobachtung durch eine späte Aussage auf, nie umgekehrt", () => {
    const observed = nextInterest(null, {
      topic: "gaming",
      source: "observed",
      importance: 0.5,
    });
    const stated = nextInterest(observed, {
      topic: "gaming",
      source: "user_stated",
      importance: 0.7,
    });
    expect(stated.source).toBe("user_stated");
    const again = nextInterest(stated, { topic: "gaming", source: "observed", importance: 0.4 });
    expect(again.source).toBe("user_stated");
  });
});

describe("Feedback", () => {
  it("verstärkt bei positivem Feedback", () => {
    const delta = feedbackDelta("positive", 0.6);
    expect(delta).toBeGreaterThan(0);
    expect(applyFeedbackToWeight(0.4, delta)).toBeGreaterThan(0.4);
  });

  it("schwächt bei negativem Feedback ab, löscht aber nie", () => {
    const delta = feedbackDelta("negative", 0.9);
    expect(delta).toBeLessThan(0);
    expect(applyFeedbackToWeight(0.1, delta)).toBe(W_MIN);
    expect(applyFeedbackToWeight(W_MIN, delta)).toBe(W_MIN);
  });
});

describe("Relevanz, Aktualität und Ebenen", () => {
  it("bevorzugt starke, wichtige und aktuelle Erinnerungen", () => {
    const base = { similarity: 0.5, weight: 0.5, importance: 0.5, activationCount: 1, now };
    const fresh = memoryRelevance({ ...base, lastAccessedAt: now - HOUR });
    const old = memoryRelevance({ ...base, lastAccessedAt: now - 500 * HOUR });
    expect(fresh).toBeGreaterThan(old);
    const strong = memoryRelevance({ ...base, weight: 0.9, lastAccessedAt: now - HOUR });
    expect(strong).toBeGreaterThan(fresh);
    expect(memoryRelevance({ ...base, similarity: 0, lastAccessedAt: now })).toBe(0);
  });

  it("lässt Aktualität nie auf null fallen", () => {
    expect(recencyFactor(now - 100_000 * HOUR, now)).toBeGreaterThanOrEqual(0.1);
  });

  it("ordnet Erinnerungen den drei Ebenen zu", () => {
    expect(
      memoryLevel({ importance: 0.2, activationCount: 1, lastAccessedAt: now - HOUR }, now),
    ).toBe("A");
    expect(
      memoryLevel({ importance: 0.8, activationCount: 1, lastAccessedAt: now - 50 * HOUR }, now),
    ).toBe("B");
    expect(
      memoryLevel({ importance: 0.2, activationCount: 1, lastAccessedAt: now - 800 * HOUR }, now),
    ).toBe("C");
  });

  it("begrenzt den Teilgraphen (Top-N je Ebene)", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      level: (i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C") as "A" | "B" | "C",
      score: i / 30,
      id: i,
    }));
    const picked = selectByLevel(many, 6);
    expect(picked.length).toBe(6);
    expect(picked.filter((p) => p.level === "A").length).toBeLessThanOrEqual(LEVEL_LIMITS.A);
    expect(picked.filter((p) => p.level === "C").length).toBeLessThanOrEqual(LEVEL_LIMITS.C);
    // Ebene A wird vor Ebene C berücksichtigt.
    expect(picked[0]?.level).toBe("A");
  });
});

describe("Feed-Beobachtung und Vorschläge", () => {
  const interests: InterestRow[] = [
    { topic: "hardware", weight: 0.9, confidence: 0.9, source: "user_stated", activationCount: 4 },
    { topic: "smartphones", weight: 0.2, confidence: 0.5, source: "observed", activationCount: 1 },
  ];

  it("erkennt relevante Beiträge anhand des Interessenmodells", () => {
    const match = feedRelevance("Neue GPU vorgestellt", interests);
    expect(match?.topic).toBe("hardware");
    expect(match?.relevance).toBeGreaterThan(SUGGESTION_THRESHOLD);
  });

  it("liefert für unpassende Beiträge keinen Vorschlag", () => {
    expect(feedRelevance("Heute war ein schöner Spaziergang im Wald", interests)).toBeNull();
  });

  it("erreicht bei schwachen Interessen die Schwelle nicht", () => {
    const match = feedRelevance("Neues Smartphone erschienen", interests);
    expect(match?.relevance ?? 0).toBeLessThan(SUGGESTION_THRESHOLD);
  });

  it("begründet Vorschläge nachvollziehbar", () => {
    expect(suggestionReason("hardware", 0.72)).toContain("hardware");
    expect(suggestionReason("hardware", 0.72)).toContain("0.72");
  });
});

describe("Autonomie-Level", () => {
  it("aktiviert nur Level 0 bis 2", () => {
    expect(ACTIVE_AUTONOMY_LEVEL).toBe(2);
    expect(isAutonomyLevelActive(2)).toBe(true);
    expect(isAutonomyLevelActive(3)).toBe(false);
    expect(isAutonomyLevelActive(4)).toBe(false);
  });

  it("hält autonome soziale Aktionen abgeschaltet", () => {
    expect(AUTONOMOUS_SOCIAL_ACTIONS_ENABLED).toBe(false);
  });
});
