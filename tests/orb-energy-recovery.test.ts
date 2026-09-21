import { describe, expect, it } from "vitest";
import {
  ENERGY_RECOVERY_CAP,
  ENERGY_RECOVERY_PER_MIN,
  recoverEnergy,
  nextState,
} from "@/orb-core/core";
import { decideCuriosity, CURIOSITY_MIN_ENERGY } from "@/orb-core/curiosity";
import type { KnowledgeGap } from "@/orb-core/curiosity";

const MIN = 60_000;
const at = (minutes: number) => recoverEnergy(0, 0, minutes * MIN);

describe("Energie-Erholung (zeitbasiert, gedeckelt)", () => {
  it("bleibt bei 0 Minuten unverändert", () => {
    expect(at(0)).toBe(0);
  });

  it("folgt der Rate 0.02 pro Minute", () => {
    expect(at(1)).toBeCloseTo(0.02, 10);
    expect(at(5)).toBeCloseTo(0.1, 10);
    expect(at(7.5)).toBeCloseTo(0.15, 10);
    expect(at(10)).toBeCloseTo(0.2, 10);
    expect(at(12.5)).toBeCloseTo(0.25, 10);
  });

  it("überschreitet den Cap nie", () => {
    expect(at(13)).toBe(ENERGY_RECOVERY_CAP);
    expect(at(600)).toBe(ENERGY_RECOVERY_CAP);
    expect(at(10_000)).toBe(ENERGY_RECOVERY_CAP);
  });

  it("ist monoton und aufrufunabhängig", () => {
    const a = recoverEnergy(0.05, 0, 4 * MIN);
    const b = recoverEnergy(0.05, 0, 4 * MIN);
    expect(a).toBe(b);
    expect(recoverEnergy(0.05, 0, 2 * MIN)).toBeLessThanOrEqual(a);
  });

  it("senkt einen Wert über dem Cap nicht", () => {
    expect(recoverEnergy(0.8, 0, 5 * MIN)).toBe(0.8);
    expect(recoverEnergy(0.25, 0, 5 * MIN)).toBe(0.25);
  });

  it("behandelt negative oder ungültige Zeitdifferenzen sicher", () => {
    expect(recoverEnergy(0.1, 5 * MIN, 0)).toBeCloseTo(0.1, 10);
    expect(recoverEnergy(0.1, Number.NaN, 0)).toBeCloseTo(0.1, 10);
  });

  it("lässt den bestehenden Verbrauch unverändert", () => {
    const base = {
      curiosity: 0.5,
      joy: 0.5,
      fear: 0.1,
      trust: 0.5,
      uncertainty: 0.3,
      energy: 0.25,
    };
    const after = nextState(base, {
      importance: 0.5,
      isQuestion: false,
      isLearning: false,
      recalled: 0,
    });
    expect(after.energy).toBeCloseTo(0.25 - 0.03 - 0.02, 10);
  });

  it("ändert die Parameter nicht versehentlich", () => {
    expect(ENERGY_RECOVERY_PER_MIN).toBe(0.02);
    expect(ENERGY_RECOVERY_CAP).toBe(0.25);
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

  it("bleibt ohne Kandidaten auch am Cap still", () => {
    const d = decideCuriosity({
      curiosity: 0.99,
      energy: ENERGY_RECOVERY_CAP,
      gaps: [],
      lastQuestionAt: null,
      openQuestion: false,
      now: 0,
    });
    expect(d.action).toBe("DO_NOTHING");
  });

  it("bleibt bei schwachem Kandidaten am Cap still", () => {
    const d = decideCuriosity({
      curiosity: 0.99,
      energy: ENERGY_RECOVERY_CAP,
      gaps: [gap(0.1)],
      lastQuestionAt: null,
      openQuestion: false,
      now: 0,
    });
    expect(d.action).toBe("WAIT");
  });

  it("bleibt bei offener Frage am Cap still", () => {
    const d = decideCuriosity({
      curiosity: 0.99,
      energy: ENERGY_RECOVERY_CAP,
      gaps: [gap(0.63)],
      lastQuestionAt: null,
      openQuestion: true,
      now: 0,
    });
    expect(d.action).toBe("WAIT");
  });

  it("respektiert den Cooldown am Cap", () => {
    const d = decideCuriosity({
      curiosity: 0.99,
      energy: ENERGY_RECOVERY_CAP,
      gaps: [gap(0.63)],
      lastQuestionAt: 0,
      openQuestion: false,
      now: 60_000,
    });
    expect(d.action).toBe("WAIT");
  });
});
