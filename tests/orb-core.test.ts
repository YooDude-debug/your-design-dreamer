/**
 * ORB Core – Tests der reinen Kernlogik (ohne Datenbank).
 *
 * Wichtigster Fall: Erinnerung entsteht → Zeit vergeht → Gewicht sinkt →
 * Erinnerung bleibt vorhanden → ähnliche Erfahrung → Reaktivierung →
 * Gewicht steigt wieder. VERGESSEN ≠ LÖSCHEN.
 */
import { describe, expect, it } from "vitest";

import {
  W_MIN,
  clamp01,
  currentWeight,
  decide,
  faceFromState,
  isLearningEvent,
  isStrong,
  nextState,
  reactivate,
  reinforcement,
  relevanceScore,
  scoreImportance,
  shouldPersist,
  textOverlap,
  type OrbState,
} from "@/lib/orb-core";

const HOUR = 3_600_000;
const NOW = 1_700_000_000_000;

const base = { weight: 0.8, importance: 0.5, decayRate: 0.05, lastActivatedAt: NOW, now: NOW };

const state: OrbState = {
  curiosity: 0.6,
  joy: 0.5,
  fear: 0.08,
  trust: 0.4,
  uncertainty: 0.3,
  energy: 0.8,
};

describe("Gewicht und Verfall", () => {
  it("frisch aktiviert = unverändertes Gewicht", () => {
    expect(currentWeight(base)).toBeCloseTo(0.8, 6);
  });

  it("Zeit ohne Aktivierung senkt das Gewicht", () => {
    const later = currentWeight({ ...base, now: NOW + 48 * HOUR });
    expect(later).toBeLessThan(0.8);
    expect(later).toBeGreaterThan(W_MIN);
  });

  it("hohe Wichtigkeit vergisst langsamer", () => {
    const low = currentWeight({ ...base, importance: 0, now: NOW + 100 * HOUR });
    const high = currentWeight({ ...base, importance: 1, now: NOW + 100 * HOUR });
    expect(high).toBeGreaterThan(low);
  });

  it("W_min wird nie unterschritten – die Erinnerung bleibt vorhanden", () => {
    const veryLate = currentWeight({ ...base, now: NOW + 100_000 * HOUR });
    expect(veryLate).toBe(W_MIN);
    expect(veryLate).toBeGreaterThan(0);
  });
});

describe("Reaktivierung", () => {
  it("Gewicht steigt nach erneuter Aktivierung", () => {
    const decayed = currentWeight({ ...base, now: NOW + 200 * HOUR });
    const again = reactivate({ ...base, now: NOW + 200 * HOUR }, reinforcement(0.5));
    expect(again).toBeGreaterThan(decayed);
  });

  it("Kernszenario: Erinnerung → Verfall → bleibt → Reaktivierung → stärker", () => {
    const created = { ...base, weight: 0.6, lastActivatedAt: NOW };
    const after = { ...created, now: NOW + 500 * HOUR };
    const weak = currentWeight(after);
    expect(weak).toBeLessThan(0.6); // vergessen
    expect(weak).toBeGreaterThanOrEqual(W_MIN); // aber nicht gelöscht
    const revived = reactivate(after, reinforcement(0.9));
    expect(revived).toBeGreaterThan(weak);
  });

  it("Verstärkung überschreitet nie die Obergrenze", () => {
    expect(reactivate({ ...base, weight: 1 }, 5)).toBeLessThanOrEqual(1);
  });
});

describe("Wichtigkeit und Lernereignis", () => {
  it("Schlüsselwörter erhöhen die Wichtigkeit", () => {
    expect(scoreImportance("Bitte merken: mein Ziel ist B2")).toBeGreaterThan(
      scoreImportance("ok"),
    );
  });

  it("Fehler wird als Lernereignis erkannt und hoch bewertet", () => {
    expect(isLearningEvent("Das war falsch")).toBe(true);
    expect(scoreImportance("Das war falsch", { isLearningEvent: true })).toBeGreaterThan(0.5);
  });

  it("nur bedeutende Erfahrungen werden dauerhaft", () => {
    expect(shouldPersist(0.1)).toBe(false);
    expect(shouldPersist(0.8)).toBe(true);
  });
});

describe("Zustand, Entscheidung, Gesicht", () => {
  it("Zustandswerte bleiben zwischen 0 und 1", () => {
    const s = nextState(state, { importance: 1, isQuestion: true, isLearning: true, recalled: 5 });
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("Frage ohne Erinnerung führt zu Nachfragen", () => {
    expect(decide({ state, recalled: 0, isQuestion: true, isLearning: false }).decision).toBe(
      "ask",
    );
  });

  it("wenig Energie führt zum Schweigen", () => {
    expect(
      decide({
        state: { ...state, energy: 0.05 },
        recalled: 3,
        isQuestion: false,
        isLearning: false,
      }).decision,
    ).toBe("stay_silent");
  });

  it("mehrere Erinnerungen führen zum Erinnern", () => {
    expect(decide({ state, recalled: 3, isQuestion: false, isLearning: false }).decision).toBe(
      "remind",
    );
  });

  it("Gesicht folgt dem Zustand, nicht dem Zufall", () => {
    const happy = faceFromState({ ...state, joy: 0.95, fear: 0 });
    const afraid = faceFromState({ ...state, joy: 0.1, fear: 0.9 });
    expect(happy.mouthCurve).toBeGreaterThan(afraid.mouthCurve);
    expect(afraid.motion).toBeLessThan(happy.motion);
    const curious = faceFromState({ ...state, curiosity: 1 });
    expect(curious.eyeOpen).toBeGreaterThan(faceFromState({ ...state, curiosity: 0 }).eyeOpen);
  });
});

describe("Abruf", () => {
  it("Wortüberlappung erkennt ähnliche Erfahrungen", () => {
    expect(textOverlap("Ich lerne Griechisch", "Griechisch lernen macht Spass")).toBeGreaterThan(0);
    expect(textOverlap("Hund", "Auto")).toBe(0);
  });

  it("Relevanz steigt mit Gewicht, Wichtigkeit und Ähnlichkeit", () => {
    expect(relevanceScore(0.8, 0.9, 1)).toBeGreaterThan(relevanceScore(0.2, 0.1, 0.1));
  });

  it("starke und schwache Verbindungen werden unterschieden", () => {
    expect(isStrong(0.9)).toBe(true);
    expect(isStrong(0.1)).toBe(false);
    expect(clamp01(2)).toBe(1);
  });
});
