/**
 * ORB Synaptic Lab (P13) – Importance Protection. SIMULATION.
 *
 * Nur synthetischer Laborgraph, keine ORB-Memories, kein DB-/Netz-/Signalweg.
 * Nutzt planAdaptive + runAdaptiveModel (gleiche stepModel-Mechanik wie D/E/F);
 * G und H setzen nur die Dormant-Frist je Verbindung. F bleibt Baseline.
 *
 *  F – unverändert: Score aus Relevanz + Wichtigkeit + gemessener Nutzung → [min, max]
 *  G – Importance Protection: Score_G = max(Score_F, Wichtigkeit) → [min, max].
 *      Hohe Wichtigkeit hebt die Frist auch bei seltener Nutzung an (bis max).
 *  H – Bounded Importance Protection: Frist_F + Bonus, nur wenn Wichtigkeit ≥ Schwelle.
 *      Bonus = round(protectionCap · (Wichtigkeit − Schwelle) / (1 − Schwelle)),
 *      gedeckelt auf max. Additiv zur F-Frist: die Reuse-Bewertung wird nie ersetzt.
 * Geplanter Recall fließt in keine Frist ein (Attr.reuse zählt nur die Nutzungsphase).
 * Wichtigkeit zählt nie als Recall-Erfolg; gemessen wird nur der Zustand.
 */
import { DEFAULT_LAB_PARAMS, type LabParams, type LabSnapshot } from "./simulation";
import {
  ADAPTIVE_SEED_COUNT,
  DEFAULT_ADAPTIVE_PARAMS,
  IMPORTANT_THRESHOLD,
  clampAdaptiveParams,
  planAdaptive,
  retentionFor,
  retentionFromScore,
  runAdaptiveModel,
  syntheticSnapshot,
  type AdaptiveMetrics,
  type AdaptiveParams,
  type Attr,
  type Profile,
} from "./adaptive";

export type ProtectionModelId = "F" | "G" | "H";
export const PROTECTION_MODELS: readonly ProtectionModelId[] = ["F", "G", "H"];
export const PROTECTION_REST_STEPS = [5, 10, 20, 40, 60, 80] as const;
/** H: höchste Schutzverlängerung in Schritten (zusätzlich durch max gedeckelt). */
export const DEFAULT_PROTECTION_CAP = 20;

/** Pflichtprofile P13 (Relevanz überall 0,5, damit nur Wichtigkeit/Nutzung variieren). */
export const PROTECTION_PROFILES: readonly Profile[] = [
  { id: "hi_rare", label: "Hohe Wichtigkeit, seltene Nutzung", relevance: 0.5, importance: 0.9, usageEvery: 6 },
  { id: "hi_freq", label: "Hohe Wichtigkeit, häufige Nutzung", relevance: 0.5, importance: 0.9, usageEvery: 1 },
  { id: "lo_freq", label: "Niedrige Wichtigkeit, häufige Nutzung", relevance: 0.5, importance: 0.1, usageEvery: 1 },
  { id: "lo_rare", label: "Niedrige Wichtigkeit, seltene Nutzung", relevance: 0.5, importance: 0.1, usageEvery: 6 },
  { id: "eq_ru_imp_hi", label: "Gleiche Relevanz + Nutzung (jeden 3.), Wichtigkeit 0,8", relevance: 0.5, importance: 0.8, usageEvery: 3 },
  { id: "eq_ru_imp_lo", label: "Gleiche Relevanz + Nutzung (jeden 3.), Wichtigkeit 0,3", relevance: 0.5, importance: 0.3, usageEvery: 3 },
  { id: "eq_imp_reuse_hi", label: "Gleiche Wichtigkeit 0,6, Nutzung jeden 2.", relevance: 0.5, importance: 0.6, usageEvery: 2 },
  { id: "eq_imp_reuse_lo", label: "Gleiche Wichtigkeit 0,6, Nutzung jeden 10.", relevance: 0.5, importance: 0.6, usageEvery: 10 },
];

export function protectionRetention(
  model: ProtectionModelId,
  attr: Attr,
  a: AdaptiveParams,
  p: LabParams,
  cap = DEFAULT_PROTECTION_CAP,
): { retention: number; base: number; extension: number } {
  const base = retentionFor("F", attr, a, p);
  let retention = base;
  if (model === "G") {
    const w = a.weightRelevance + a.weightImportance + a.weightReuse || 1;
    const reuseNorm = Math.min(1, Math.max(0, attr.reuse / Math.max(1, a.buildSteps)));
    const scoreF =
      (a.weightRelevance * attr.relevance + a.weightImportance * attr.importance + a.weightReuse * reuseNorm) / w;
    retention = retentionFromScore(Math.max(scoreF, attr.importance), a);
  } else if (model === "H" && attr.importance >= IMPORTANT_THRESHOLD) {
    const bonus = Math.round(
      Math.max(0, cap) * ((attr.importance - IMPORTANT_THRESHOLD) / (1 - IMPORTANT_THRESHOLD)),
    );
    retention = Math.min(a.maxRetention, base + bonus);
  }
  retention = Math.min(a.maxRetention, Math.max(a.minRetention, retention));
  return { retention, base, extension: retention - base };
}

export type ProtectionRestResult = {
  restSteps: number;
  seeds: { seed: number; metrics: AdaptiveMetrics[] }[];
};

function runRest(
  p: LabParams,
  a: AdaptiveParams,
  restSteps: number,
  seedCount: number,
  snapshot: LabSnapshot,
  cap: number,
  models: readonly ProtectionModelId[] = PROTECTION_MODELS,
  perModelA?: Partial<Record<ProtectionModelId, AdaptiveParams>>,
): ProtectionRestResult {
  return {
    restSteps,
    seeds: Array.from({ length: seedCount }, (_, i) => {
      const seed = p.seed + i;
      const ps = { ...p, seed };
      // Plan aus den gemeinsamen Parametern: identisch für F/G/H.
      const plan = planAdaptive(snapshot, ps, a, restSteps, PROTECTION_PROFILES);
      return {
        seed,
        metrics: models.map((m) => {
          const am = perModelA?.[m] ?? a;
          return runAdaptiveModel(
            "F",
            plan,
            snapshot,
            ps,
            am,
            (at) => protectionRetention(m, at, am, ps, cap).retention,
            m,
          );
        }),
      };
    }),
  };
}

export function runProtectionValidation(
  p: LabParams = DEFAULT_LAB_PARAMS,
  a: AdaptiveParams = DEFAULT_ADAPTIVE_PARAMS,
  cap = DEFAULT_PROTECTION_CAP,
  restOptions: readonly number[] = PROTECTION_REST_STEPS,
  seedCount = ADAPTIVE_SEED_COUNT,
  snapshot: LabSnapshot = syntheticSnapshot(),
): ProtectionRestResult[] {
  const ac = clampAdaptiveParams(a);
  return restOptions.map((r) => runRest(p, ac, r, seedCount, snapshot, cap));
}

export type BudgetRow = {
  restSteps: number;
  /** Speicherbudget = Ø Σ ruhende Verbindungen × Schritte von F. */
  budget: number;
  models: {
    model: ProtectionModelId;
    /** Höchstfrist, die unter dem Budget bleibt (F = Originalwert). */
    maxRetention: number;
    used: number;
    importantRetrievable: number;
    important: number;
    unimportantLost: number;
    /** Nur durch eine höhere Höchstfrist als F erreichbar? (nie bei Budget-Lauf) */
    withinBudget: boolean;
  }[];
};

const mean = (ms: AdaptiveMetrics[], f: (m: AdaptiveMetrics) => number) =>
  ms.reduce((x, m) => x + f(m), 0) / Math.max(1, ms.length);

/**
 * Gleiches Speicherbudget: G/H erhalten die größte Höchstfrist (≤ F-Höchstfrist),
 * deren Ø Speicher × Zeit das von F nicht übersteigt (deterministische Suche
 * von oben nach unten in ganzen Schritten). Dann Vergleich wichtiger abrufbarer Verbindungen.
 */
export function runBudgetComparison(
  p: LabParams = DEFAULT_LAB_PARAMS,
  a: AdaptiveParams = DEFAULT_ADAPTIVE_PARAMS,
  cap = DEFAULT_PROTECTION_CAP,
  restOptions: readonly number[] = PROTECTION_REST_STEPS,
  seedCount = ADAPTIVE_SEED_COUNT,
  snapshot: LabSnapshot = syntheticSnapshot(),
): BudgetRow[] {
  const ac = clampAdaptiveParams(a);
  return restOptions.map((restSteps) => {
    const at = (m: ProtectionModelId, max: number) => {
      const am = { ...ac, maxRetention: max };
      const r = runRest(p, ac, restSteps, seedCount, snapshot, cap, [m], { [m]: am });
      return r.seeds.map((s) => s.metrics[0]!);
    };
    const fMs = at("F", ac.maxRetention);
    const budget = mean(fMs, (m) => m.dormantStepSum);
    const row = (m: ProtectionModelId, max: number, ms: AdaptiveMetrics[]) => {
      const used = mean(ms, (x) => x.dormantStepSum);
      return {
        model: m,
        maxRetention: max,
        used,
        importantRetrievable: ms.reduce((x, y) => x + y.importantRetrievable, 0),
        important: ms.reduce((x, y) => x + y.important, 0),
        unimportantLost: ms.reduce((x, y) => x + y.unimportantLost, 0),
        withinBudget: used <= budget + 1e-9,
      };
    };
    const models: BudgetRow["models"] = [row("F", ac.maxRetention, fMs)];
    for (const m of ["G", "H"] as const) {
      let max = ac.maxRetention;
      let ms = at(m, max);
      while (max > ac.minRetention && mean(ms, (x) => x.dormantStepSum) > budget + 1e-9) {
        max--;
        ms = at(m, max);
      }
      models.push(row(m, max, ms));
    }
    return { restSteps, budget, models };
  });
}
