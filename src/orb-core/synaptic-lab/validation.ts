/**
 * ORB Synaptic Lab (P10) – Robustheits- und Langzeitvalidierung. SIMULATION.
 *
 * Rein deterministisch auf Basis von runLongTerm (P9). Kein Datenbank-, Netz-,
 * Speicher- oder Tab-Signal-Weg; Ergebnisse nur im Arbeitsspeicher.
 * Je Seed bekommen A/B/C denselben Ereignisplan (planLongTerm).
 */
import { LAB_MODELS, type LabModelId, type LabParams, type LabSnapshot } from "./simulation";
import { runLongTerm, type LongTermParams, type LtMetrics } from "./longterm";

export const VALIDATION_REST_STEPS = [5, 10, 20, 40, 80] as const;
export const VALIDATION_SEED_COUNT = 10;

export type Stats = { mean: number; min: number; max: number; std: number; n: number };

export function stats(values: number[]): Stats | null {
  if (!values.length) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return {
    mean,
    min: Math.min(...values),
    max: Math.max(...values),
    std: Math.sqrt(variance),
    n: values.length,
  };
}

export type ModelAggregate = {
  model: LabModelId;
  retrievability: Stats | null;
  /** Summe reaktiviert / Summe schwach-vorhanden über alle Seeds. */
  reactivationRate: number | null;
  lost: number;
  falseReactivations: number;
  controlsPresent: number;
  targetHeld: number;
  recovered: number;
  targetNotReached: number;
  restored: number;
  restoredReachedTarget: number;
  expired: number;
  dormantEnd: number;
  /** Mittelwerte je Seed (KB). */
  activeKb: number;
  dormantKb: number;
  hypothesesCreated: number;
};

export type SeedRow = { seed: number; metrics: LtMetrics[] };

export type RestResult = {
  restSteps: number;
  seeds: SeedRow[];
  aggregate: ModelAggregate[];
  /** Seeds, bei denen C eine geringere End-Wiederauffindbarkeit als A oder B hat. */
  cWorseSeeds: number[];
  /** Seeds, bei denen D besser / schlechter als C abschneidet. */
  dBetterSeeds: number[];
  dWorseSeeds: number[];
};

export function seedList(base: number, count = VALIDATION_SEED_COUNT): number[] {
  return Array.from({ length: count }, (_, i) => base + i);
}

export function runValidation(
  snapshot: LabSnapshot,
  p: LabParams,
  lt: LongTermParams,
  restOptions: readonly number[] = VALIDATION_REST_STEPS,
  seeds: number[] = seedList(p.seed),
): RestResult[] {
  return restOptions.map((restSteps) => {
    const rows: SeedRow[] = seeds.map((seed) => ({
      seed,
      metrics: runLongTerm(snapshot, { ...p, seed }, { ...lt, restSteps }).metrics,
    }));
    const aggregate = LAB_MODELS.map((model, mi): ModelAggregate => {
      const ms = rows.map((r) => r.metrics[mi]!);
      const sum = (f: (m: LtMetrics) => number) => ms.reduce((a, m) => a + f(m), 0);
      const weak = sum((m) => m.weakPresentAfterRest);
      return {
        model,
        retrievability: stats(
          ms.map((m) => m.retrievabilityEnd).filter((v): v is number => v !== null),
        ),
        reactivationRate: weak ? sum((m) => m.reactivated) / weak : null,
        lost: sum((m) => m.lost),
        falseReactivations: sum((m) => m.falseReactivations),
        controlsPresent: sum((m) => m.controlsPresent),
        targetHeld: sum((m) => m.targetHeld),
        recovered: sum((m) => m.recovered),
        targetNotReached: sum((m) => m.targetNotReached),
        restored: sum((m) => m.restored),
        restoredReachedTarget: sum((m) => m.restoredReachedTarget),
        expired: sum((m) => m.expired),
        dormantEnd: sum((m) => m.dormantEnd),
        activeKb: sum((m) => m.activeBytes) / ms.length / 1024,
        dormantKb: sum((m) => m.dormantBytes) / ms.length / 1024,
        hypothesesCreated: sum((m) => m.hypothesesCreated) / ms.length,
      };
    });
    const cWorseSeeds = rows
      .filter((r) => {
        const [a, b, c] = r.metrics.map((m) => m.retrievabilityEnd ?? 0);  // A, B, C (D separat)
        return c! < a! || c! < b!;
      })
      .map((r) => r.seed);
    const end = (r: SeedRow, m: LabModelId) =>
      r.metrics[LAB_MODELS.indexOf(m)]!.retrievabilityEnd ?? 0;
    const dBetterSeeds = rows.filter((r) => end(r, "D") > end(r, "C")).map((r) => r.seed);
    const dWorseSeeds = rows.filter((r) => end(r, "D") < end(r, "C")).map((r) => r.seed);
    return { restSteps, seeds: rows, aggregate, cWorseSeeds, dBetterSeeds, dWorseSeeds };
  });
}
