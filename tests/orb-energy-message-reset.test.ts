import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENERGY_RECOVERY_CAP, nextState, recoverEnergy } from "@/orb-core/core";

const ENGINE = readFileSync("src/orb-core/engine.server.ts", "utf8");
const MIN = 60_000;

/**
 * Regression: ein Schreibvorgang auf `orb_state` setzt den Zeitstempel neu
 * (Trigger `set_updated_at`). Schreibt er die bereits erholte Energie nicht
 * mit, verfällt die Ruhezeit und die sichtbare Energie fällt auf den
 * gespeicherten Basiswert – im Extremfall auf 0.
 */
describe("Energie: normale Nachricht setzt den Zustand nicht auf 0", () => {
  it("jeder orb_state-Update-Aufruf im Kern schreibt auch energy", () => {
    const blocks = ENGINE.split('.from("orb_state")').slice(1);
    const updates = blocks.filter((b) => b.trimStart().startsWith(".update("));
    expect(updates.length).toBeGreaterThanOrEqual(3);
    for (const block of updates) {
      const body = block.slice(0, block.indexOf(".eq("));
      expect(body).toContain("energy");
    }
  });

  it("A) Energie > 0 bleibt nach einer Nachricht erhalten (nur Nachrichtenkosten)", () => {
    const stored = 0.2;
    const after = nextState(
      { curiosity: 0.5, joy: 0.5, fear: 0.2, trust: 0.5, uncertainty: 0.3, energy: stored },
      { importance: 0.5, isQuestion: false, isLearning: false, recalled: 1 },
    );
    expect(after.energy).toBeCloseTo(stored - 0.03 - 0.04 * 0.5, 10);
    expect(after.energy).toBeGreaterThan(0);
  });

  it("B) mehrere Nachrichten senken nur um die bestehenden Kosten", () => {
    let energy = 0.25;
    for (let i = 0; i < 3; i += 1) {
      const next = nextState(
        { curiosity: 0.5, joy: 0.5, fear: 0.2, trust: 0.5, uncertainty: 0.3, energy },
        { importance: 0, isQuestion: false, isLearning: false, recalled: 0 },
      );
      expect(next.energy).toBeCloseTo(energy - 0.03, 10);
      energy = next.energy;
    }
    expect(energy).toBeCloseTo(0.16, 10);
  });

  it("C) niedrige Energie wird durch eine Nachricht nicht künstlich genullt", () => {
    const recovered = recoverEnergy(0, 0, 5 * MIN);
    expect(recovered).toBeCloseTo(0.1, 10);
    const after = nextState(
      { curiosity: 0.5, joy: 0.5, fear: 0.2, trust: 0.5, uncertainty: 0.3, energy: recovered },
      { importance: 0, isQuestion: false, isLearning: false, recalled: 0 },
    );
    expect(after.energy).toBeCloseTo(0.07, 10);
  });

  it("D) Erholung bleibt über einen zwischenzeitlichen Schreibvorgang hinweg erhalten", () => {
    // 6 Minuten Ruhe → 0.12. Ein Snapshot-Write speichert diesen Wert und
    // setzt den Zeitstempel neu; danach zählt die Erholung weiter.
    const persisted = recoverEnergy(0, 0, 6 * MIN);
    expect(persisted).toBeCloseTo(0.12, 10);
    const later = recoverEnergy(persisted, 6 * MIN, 9 * MIN);
    expect(later).toBeCloseTo(0.18, 10);
  });

  it("E) Obergrenze bleibt 0.25", () => {
    expect(recoverEnergy(0.24, 0, 60 * MIN)).toBe(ENERGY_RECOVERY_CAP);
  });
});
