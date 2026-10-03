/**
 * P11.1 – exakte Aufbewahrungsgrenze von Modell D (SIMULATION, nur Arbeitsspeicher).
 *
 * Reihenfolge innerhalb eines stepModel-Schritts (aus der bestehenden Implementierung):
 *   1. Hypothesenbildung (ev.grow)
 *   2. Recall (ev.activate) – eine noch "dormant" Verbindung wird hier rekonstruiert
 *   3. Decay (Stärke/Lifecycle aller abrufbaren Verbindungen)
 *   4. Deadline-/Expiry-Prüfung (dormant → expired, wenn step − dormantSince ≥ Retention)
 * Folge: Schläft eine Verbindung ab Schritt d ein, ist ein Recall bis einschließlich
 * Schritt d + R erfolgreich; ab Schritt d + R + 1 ist sie expired und nicht rekonstruierbar.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAB_PARAMS,
  buildPool,
  initModel,
  metricsOf,
  stepModel,
  type LabParams,
  type LabSnapshot,
  type ModelState,
} from "@/orb-core/synaptic-lab/simulation";

const snap: LabSnapshot = {
  nodes: Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, group: "g" })),
  edges: [
    { source: "n0", target: "n1" },
    { source: "n1", target: "n2" },
  ],
};
const pool = buildPool(snap);
const pm = new Map(pool.map((e) => [e.key, e]));
const k = pool[0]!.key;
const idle = { grow: [], activate: [] };

function sleep(R: number): { s: ModelState; d: number; P: LabParams } {
  const P: LabParams = { ...DEFAULT_LAB_PARAMS, decay: 0.2, dormantRetention: R };
  let s = stepModel(initModel("D"), { grow: [k], activate: [] }, pm, P);
  while (s.candidates.get(k)!.lifecycle !== "dormant") s = stepModel(s, idle, pm, P);
  const d = s.candidates.get(k)!.dormantSince!;
  expect(d).toBe(s.step);
  return { s, d, P };
}
const idleTo = (s: ModelState, P: LabParams, step: number) => {
  while (s.step < step) s = stepModel(s, idle, pm, P);
  return s;
};

describe("P11.1 Grenze Aufbewahrung 39/40/41 (tatsächliche Schlafdauer)", () => {
  for (const R of [39, 40, 41]) {
    it(`R=${R}: Recall bei Schlafdauer R erfolgreich, bei R+1 expired`, () => {
      const { s, d, P } = sleep(R);
      // Recall genau im Schritt d+R (Schlafdauer = R): Recall läuft vor der Fristprüfung.
      let a = idleTo(s, P, d + R - 1);
      expect(a.candidates.get(k)!.lifecycle).toBe("dormant");
      a = stepModel(a, { grow: [], activate: [k] }, pm, P);
      expect(a.step).toBe(d + R);
      expect(a.candidates.get(k)!.restoredCount).toBe(1);
      expect(a.candidates.get(k)!.everReactivated).toBe(false);
      expect(a.candidates.get(k)!.lifecycle).not.toBe("expired");

      // Ohne Recall: am Ende von Schritt d+R expired.
      const b = idleTo(s, P, d + R);
      expect(b.candidates.get(k)!.lifecycle).toBe("expired");

      // Recall im Schritt d+R+1: nicht mehr rekonstruierbar, auch nicht per grow.
      const c = stepModel(b, { grow: [k], activate: [k] }, pm, P);
      expect(c.candidates.get(k)!.lifecycle).toBe("expired");
      expect(c.candidates.get(k)!.restoredCount).toBe(0);
      const m = metricsOf(c, snap, P);
      expect(m.expired).toBe(1);
      expect(m.removed).toBe(0);
      expect(m.dormant).toBe(0);
    });
  }
});

describe("P11.1 Statistik ohne Doppelzählung", () => {
  it("Dormant zählt nicht als entfernt; Kategorien disjunkt", () => {
    const { s, P } = sleep(10);
    const m = metricsOf(s, snap, P);
    expect(m.dormant).toBe(1);
    expect(m.removed).toBe(0);
    expect(m.expired).toBe(0);
    expect(m.activeCount + m.weakCount + m.dormant + m.expired + m.removed).toBe(m.candidates);
  });
  it("Modell C: removed zählt endgültig entfernte", () => {
    const P = { ...DEFAULT_LAB_PARAMS, decay: 0.2 };
    let s = stepModel(initModel("C"), { grow: [k], activate: [] }, pm, P);
    for (let i = 0; i < 30; i++) s = stepModel(s, idle, pm, P);
    const m = metricsOf(s, snap, P);
    expect(m.removed).toBe(1);
    expect(m.dormant + m.expired).toBe(0);
  });
});
