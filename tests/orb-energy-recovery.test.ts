import { describe, expect, it } from "vitest";
import {
  ENERGY_MAX,
  ENERGY_RECOVERY_HIGH_PER_MIN,
  ENERGY_RECOVERY_LOW_PER_MIN,
  ENERGY_RECOVERY_THRESHOLD,
  recoverEnergy,
  nextState,
} from "@/orb-core/core";
import { decideCuriosity, CURIOSITY_MIN_ENERGY } from "@/orb-core/curiosity";
import type { KnowledgeGap } from "@/orb-core/curiosity";

const MIN = 60_000;
const at = (minutes: number) => recoverEnergy(0, 0, minutes * MIN);

describe("Energie-Erholung (zweistufig, zeitbasiert, gedeckelt bei 100 %)", () => {
  it("bleibt bei 0 Minuten unverändert", () => {
    expect(at(0)).toBe(0);
  });

  it("folgt unter 50 % der Rate 0.03 pro Minute", () => {
    expect(at(1)).toBeCloseTo(0.03, 10);
    expect(at(5)).toBeCloseTo(0.15, 10);
    expect(at(7.5)).toBeCloseTo(0.225, 10);
  });

  it("Beispiel: 0 % nach 10 Minuten Ruhe → 30 %", () => {
    expect(at(10)).toBeCloseTo(0.3, 10);
  });

  it("Beispiel: 50 % nach 10 Minuten Ruhe → 70 %", () => {
    expect(recoverEnergy(0.5, 0, 10 * MIN)).toBeCloseTo(0.7, 10);
  });

  it("Beispiel: 90 % nach 10 Minuten Ruhe → 100 % (Maximum)", () => {
    expect(recoverEnergy(0.9, 0, 10 * MIN)).toBe(ENERGY_MAX);
  });

  it("Beispiel: 100 % bleibt bei 100 %", () => {
    expect(recoverEnergy(1, 0, 10 * MIN)).toBe(1);
    expect(recoverEnergy(1, 0, 10_000 * MIN)).toBe(1);
  });

  it("teilt ein Intervall über dem 50-%-Übergang exakt auf", () => {
    // 40 % → 50 % in 10/3 min mit 3 %/min, Rest 20/3 min mit 2 %/min:
    // 0.5 + (20/3) * 0.02 = 0.6333…
    expect(recoverEnergy(0.4, 0, 10 * MIN)).toBeCloseTo(0.5 + (20 / 3) * 0.02, 10);
  });

  it("Grenzwert 49 %: startet mit 3 %/min und wechselt bei 50 %", () => {
    // 1 min mit 3 %/min bis 50 %, 9 min mit 2 %/min → 0.68
    expect(recoverEnergy(0.49, 0, 10 * MIN)).toBeCloseTo(0.68, 10);
  });

  it("Grenzwert 51 %: komplett mit 2 %/min", () => {
    expect(recoverEnergy(0.51, 0, 10 * MIN)).toBeCloseTo(0.71, 10);
  });

  it("Grenzwert 99 %: steigt auf 100 %, nie darüber", () => {
    expect(recoverEnergy(0.99, 0, 10 * MIN)).toBe(ENERGY_MAX);
    expect(recoverEnergy(0.99, 0, 0.4 * MIN)).toBeCloseTo(0.998, 10);
  });

  it("überschreitet 100 % nie, auch nach sehr langer Ruhe", () => {
    expect(at(600)).toBe(ENERGY_MAX);
    expect(at(10_000)).toBe(ENERGY_MAX);
    expect(recoverEnergy(0.999, 0, 60 * MIN)).toBe(ENERGY_MAX);
  });

  it("erzeugt keine negative Energie und senkt nie", () => {
    expect(recoverEnergy(0, 0, 0)).toBe(0);
    expect(recoverEnergy(0.8, 0, 5 * MIN)).toBeGreaterThan(0.8);
    expect(recoverEnergy(0.5, 0, 5 * MIN)).toBeCloseTo(0.6, 10);
  });

  it("ist monoton und aufrufunabhängig (identischer Zeitstempel ⇒ identischer Wert)", () => {
    const a = recoverEnergy(0.05, 0, 4 * MIN);
    const b = recoverEnergy(0.05, 0, 4 * MIN);
    expect(a).toBe(b);
    expect(recoverEnergy(0.05, 0, 2 * MIN)).toBeLessThanOrEqual(a);
  });

  it("wiederholte Abfragen mit identischem Zeitstempel erzeugen keine Energie", () => {
    let v = recoverEnergy(0.1, 0, 5 * MIN);
    for (let i = 0; i < 10; i += 1) {
      expect(recoverEnergy(0.1, 0, 5 * MIN)).toBe(v);
    }
    expect(v).toBeCloseTo(0.25, 10);
  });

  it("mehrere Minuten ohne Aktivität summieren sich zeitbasiert", () => {
    // 30 min ab 0: 50/3 min mit 3 %/min bis 50 %, Rest 40/3 min mit 2 %/min
    expect(at(30)).toBeCloseTo(0.5 + (40 / 3) * 0.02, 10);
  });

  it("behandelt negative oder ungültige Zeitdifferenzen sicher", () => {
    expect(recoverEnergy(0.1, 5 * MIN, 0)).toBeCloseTo(0.1, 10);
    expect(recoverEnergy(0.1, Number.NaN, 0)).toBeCloseTo(0.1, 10);
  });

  it("Verbrauch und anschliessende Regeneration arbeiten zusammen", () => {
    const base = {
      curiosity: 0.5,
      joy: 0.5,
      fear: 0.1,
      trust: 0.5,
      uncertainty: 0.3,
      energy: 0.6,
    };
    const after = nextState(base, {
      importance: 0.5,
      isQuestion: false,
      isLearning: false,
      recalled: 0,
    });
    // Verbrauch unverändert: -0.03 - 0.04 * 0.5
    expect(after.energy).toBeCloseTo(0.55, 10);
    // 5 min Ruhe ab 55 %: 5 * 0.02 = 0.10 → 0.65
    expect(recoverEnergy(after.energy, 0, 5 * MIN)).toBeCloseTo(0.65, 10);
  });

  it("ändert die Parameter nicht versehentlich", () => {
    expect(ENERGY_RECOVERY_LOW_PER_MIN).toBe(0.03);
    expect(ENERGY_RECOVERY_HIGH_PER_MIN).toBe(0.02);
    expect(ENERGY_RECOVERY_THRESHOLD).toBe(0.5);
    expect(ENERGY_MAX).toBe(1);
    expect(CURIOSITY_MIN_ENERGY).toBe(0.15);
  });
});

describe("Erholung öffnet nur das Aktivierungstor", () => {
  const gap = (score: number): KnowledgeGap => ({
    kind: "detail",
    topic: "reisen",
    gap: "Details fehlen",
    question: "Wohin reist du am liebsten?",
    score,
    reason: "Lücke erkannt.",
    nodeId: null,
  });

  it("fragt bei 0.149 nicht und bei 0.150 möglich", () => {
    const input = {
      curiosity: 0.99,
      gaps: [gap(0.63)],
      lastQuestionAt: null,
      openQuestion: false,
      now: 0,
    };
    expect(decideCuriosity({ ...input, energy: 0.149 }).action).toBe("WAIT");
    expect(decideCuriosity({ ...input, energy: 0.15 }).action).toBe("ASK");
  });

  it("bleibt ohne Kandidaten auch bei voller Energie still", () => {
    const d = decideCuriosity({
      curiosity: 0.99,
      energy: ENERGY_MAX,
      gaps: [],
      lastQuestionAt: null,
      openQuestion: false,
      now: 0,
    });
    expect(d.action).toBe("DO_NOTHING");
  });

  it("bleibt bei schwachem Kandidaten bei voller Energie still", () => {
    const d = decideCuriosity({
      curiosity: 0.99,
      energy: ENERGY_MAX,
      gaps: [gap(0.1)],
      lastQuestionAt: null,
      openQuestion: false,
      now: 0,
    });
    expect(d.action).toBe("WAIT");
  });

  it("bleibt bei offener Frage bei voller Energie still", () => {
    const d = decideCuriosity({
      curiosity: 0.99,
      energy: ENERGY_MAX,
      gaps: [gap(0.63)],
      lastQuestionAt: null,
      openQuestion: true,
      now: 0,
    });
    expect(d.action).toBe("WAIT");
  });

  it("respektiert den Cooldown bei voller Energie", () => {
    const d = decideCuriosity({
      curiosity: 0.99,
      energy: ENERGY_MAX,
      gaps: [gap(0.63)],
      lastQuestionAt: 0,
      openQuestion: false,
      now: 60_000,
    });
    expect(d.action).toBe("WAIT");
  });
});
