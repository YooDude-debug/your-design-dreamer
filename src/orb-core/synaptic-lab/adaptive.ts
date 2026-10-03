/**
 * ORB Synaptic Lab (P12) – adaptive Dormant-Aufbewahrung. SIMULATION.
 *
 * Nur synthetische Labordaten (eigener Graph, keine ORB-Memories). Nutzt dieselbe
 * stepModel-Mechanik wie Modell D; E und F setzen nur die Aufbewahrungsfrist je
 * Verbindung über den StepOptions-Haken. Kein DB-, Netz-, Speicher- oder Signalweg.
 *
 *  D – feste Frist p.dormantRetention (Baseline, unverändert)
 *  E – Frist aus vorgegebener Relevanz + Wichtigkeit
 *  F – Frist aus Relevanz + Wichtigkeit + gemessener Wiederverwendung
 * Relevanz/Wichtigkeit sind explizite Simulationsparameter je Verbindung.
 * Wiederverwendung = Aktivierungen in der Nutzungsphase, getrennt vom geplanten Recall.
 * Hohe Wichtigkeit gilt nie als Retrieval-Erfolg: gemessen wird nur der Zustand.
 */
import {
  BYTES_PER_CANDIDATE,
  DEFAULT_LAB_PARAMS,
  S_INITIAL,
  buildPool,
  initModel,
  isLive,
  prng,
  stepModel,
  strengthAt,
  type LabCandidate,
  type LabEvents,
  type LabParams,
  type LabSnapshot,
  type ModelState,
} from "./simulation";

export type AdaptiveModelId = "D" | "E" | "F";
export const ADAPTIVE_MODELS: readonly AdaptiveModelId[] = ["D", "E", "F"];
export const ADAPTIVE_REST_STEPS = [5, 10, 20, 40, 80] as const;
export const ADAPTIVE_SEED_COUNT = 10;
/** Ab hier gilt eine Verbindung als „wichtig“ (für Verlust wichtiger Verbindungen). */
export const IMPORTANT_THRESHOLD = 0.7;

export type AdaptiveParams = {
  minRetention: number;
  maxRetention: number;
  weightRelevance: number;
  weightImportance: number;
  weightReuse: number;
  buildSteps: number;
  recallSteps: number;
  recoveryStrength: number;
};

export const ADAPTIVE_LIMITS = {
  minRetention: [0, 400],
  maxRetention: [0, 400],
  weightRelevance: [0, 1],
  weightImportance: [0, 1],
  weightReuse: [0, 1],
} as const;

export const DEFAULT_ADAPTIVE_PARAMS: AdaptiveParams = {
  minRetention: 10,
  maxRetention: 80,
  weightRelevance: 0.35,
  weightImportance: 0.35,
  weightReuse: 0.3,
  buildSteps: 20,
  recallSteps: 10,
  recoveryStrength: S_INITIAL,
};

export function clampAdaptiveParams(a: AdaptiveParams): AdaptiveParams {
  const c = (v: number, [lo, hi]: readonly [number, number]) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  const min = Math.round(c(a.minRetention, ADAPTIVE_LIMITS.minRetention));
  const max = Math.max(min, Math.round(c(a.maxRetention, ADAPTIVE_LIMITS.maxRetention)));
  return {
    ...a,
    minRetention: min,
    maxRetention: max,
    weightRelevance: c(a.weightRelevance, ADAPTIVE_LIMITS.weightRelevance),
    weightImportance: c(a.weightImportance, ADAPTIVE_LIMITS.weightImportance),
    weightReuse: c(a.weightReuse, ADAPTIVE_LIMITS.weightReuse),
  };
}

/** Testprofile: explizite Simulationswerte, keine ORB-Echtzeitwerte. */
export type Profile = {
  id: string;
  label: string;
  relevance: number;
  importance: number;
  /** Nutzung jeden n-ten Schritt der Nutzungsphase. */
  usageEvery: number;
};
export const PROFILES: readonly Profile[] = [
  { id: "hr_lu", label: "Hohe Relevanz, seltene Nutzung", relevance: 0.9, importance: 0.9, usageEvery: 6 },
  { id: "lr_hu", label: "Niedrige Relevanz, häufige Nutzung", relevance: 0.1, importance: 0.1, usageEvery: 1 },
  { id: "hr_hu", label: "Hohe Relevanz, häufige Nutzung", relevance: 0.9, importance: 0.9, usageEvery: 1 },
  { id: "lr_lu", label: "Niedrige Relevanz, seltene Nutzung", relevance: 0.1, importance: 0.1, usageEvery: 6 },
  { id: "mr_hu", label: "Gleiche Relevanz 0,5, häufige Nutzung", relevance: 0.5, importance: 0.5, usageEvery: 1 },
  { id: "mr_lu", label: "Gleiche Relevanz 0,5, seltene Nutzung", relevance: 0.5, importance: 0.5, usageEvery: 6 },
];
export const PER_PROFILE = 2;

/** Synthetischer Labor-Graph (Kette + zwei Gruppen). Keine echten Daten. */
export function syntheticSnapshot(n = 40): LabSnapshot {
  const id = (i: number) => `s${String(i).padStart(2, "0")}`;
  return {
    nodes: Array.from({ length: n }, (_, i) => ({ id: id(i), group: i % 2 ? "x" : "y" })),
    edges: Array.from({ length: n - 1 }, (_, i) => ({ source: id(i), target: id(i + 1) })),
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Frist innerhalb [min, max]; Score ∈ [0,1]. */
export function retentionFromScore(score: number, a: AdaptiveParams): number {
  return Math.round(a.minRetention + (a.maxRetention - a.minRetention) * clamp01(score));
}

export type Attr = { relevance: number; importance: number; reuse: number; profile: string | null };

export function retentionFor(
  model: AdaptiveModelId,
  attr: Attr,
  a: AdaptiveParams,
  p: LabParams,
): number {
  if (model === "D") return p.dormantRetention;
  if (model === "E") return retentionFromScore((attr.relevance + attr.importance) / 2, a);
  const w = a.weightRelevance + a.weightImportance + a.weightReuse || 1;
  const reuseNorm = clamp01(attr.reuse / Math.max(1, a.buildSteps));
  return retentionFromScore(
    (a.weightRelevance * attr.relevance +
      a.weightImportance * attr.importance +
      a.weightReuse * reuseNorm) /
      w,
    a,
  );
}

export type AdaptivePlan = {
  events: (LabEvents & { phase: "build" | "rest" | "recall" })[];
  tracked: string[];
  controls: string[];
  attrs: Map<string, Attr>;
};

/** Ein Plan pro Seed – identisch für D/E/F. */
export function planAdaptive(
  snapshot: LabSnapshot,
  p: LabParams,
  a: AdaptiveParams,
  restSteps: number,
): AdaptivePlan {
  const pool = buildPool(snapshot);
  const rnd = prng(p.seed);
  const order = pool.map((e) => e.key);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const nTracked = Math.min(order.length, PROFILES.length * PER_PROFILE);
  const tracked = order.slice(0, nTracked);
  const background = order.slice(nTracked, nTracked + p.growthRate * a.buildSteps);
  const controls = order.slice(nTracked + background.length, nTracked + background.length + nTracked);
  const attrs = new Map<string, Attr>();
  tracked.forEach((k, i) => {
    const pr = PROFILES[Math.floor(i / PER_PROFILE)]!;
    attrs.set(k, { relevance: pr.relevance, importance: pr.importance, reuse: 0, profile: pr.id });
  });
  const events: AdaptivePlan["events"] = [];
  let cursor = 0;
  for (let s = 0; s < a.buildSteps; s++) {
    const grow = s === 0 ? [...tracked] : [];
    for (let g = 0; g < p.growthRate && cursor < background.length; g++) grow.push(background[cursor++]!);
    const activate: string[] = [];
    tracked.forEach((k, i) => {
      if (s > 0 && s % PROFILES[Math.floor(i / PER_PROFILE)]!.usageEvery === 0) {
        activate.push(k);
        attrs.get(k)!.reuse++; // Wiederverwendung: nur Nutzungsphase, nie Recall
      }
    });
    for (let x = 0; x < p.activationRate && cursor > 0; x++)
      activate.push(background[Math.floor(rnd() * cursor)]!);
    events.push({ phase: "build", grow, activate });
  }
  for (let s = 0; s < restSteps; s++) events.push({ phase: "rest", grow: [], activate: [] });
  for (let s = 0; s < a.recallSteps; s++)
    events.push({ phase: "recall", grow: [], activate: s === 0 ? [...tracked, ...controls] : [...tracked] });
  return { events, tracked, controls, attrs };
}

export type AdaptiveMetrics = {
  model: AdaptiveModelId;
  tracked: number;
  retrievabilityAfterRest: number;
  retrievabilityEnd: number;
  /** Zielstärke am Ende des Recalls erreicht (Zustand, nicht Wichtigkeit). */
  targetReached: number;
  important: number;
  importantLost: number;
  expired: number;
  dormantEverTracked: number;
  restored: number;
  reconstructionRate: number | null;
  falseReconstructions: number;
  dormantPeak: number;
  dormantEnd: number;
  dormantPeakBytes: number;
  activeEndBytes: number;
  perProfile: Record<string, { retrievable: number; n: number; retention: number }>;
};

export function runAdaptiveModel(
  model: AdaptiveModelId,
  plan: AdaptivePlan,
  snapshot: LabSnapshot,
  p: LabParams,
  a: AdaptiveParams,
): AdaptiveMetrics {
  const poolMap = new Map(buildPool(snapshot).map((e) => [e.key, e]));
  const none: Attr = { relevance: 0, importance: 0, reuse: 0, profile: null };
  const ret = (c: LabCandidate) => retentionFor(model, plan.attrs.get(c.key) ?? none, a, p);
  let s: ModelState = initModel("D");
  let dormantPeak = 0;
  const everDormant = new Set<string>();
  let afterRest: ModelState | null = null;
  plan.events.forEach((ev, i) => {
    s = stepModel(s, ev, poolMap, p, { retention: ret });
    let d = 0;
    for (const c of s.candidates.values())
      if (c.lifecycle === "dormant") {
        d++;
        if (plan.attrs.has(c.key)) everDormant.add(c.key);
      }
    dormantPeak = Math.max(dormantPeak, d);
    if (ev.phase === "rest" && plan.events[i + 1]?.phase !== "rest") afterRest = s;
    if (ev.phase === "build" && plan.events[i + 1]?.phase === "recall") afterRest = s;
  });
  const retrievable = (st: ModelState, k: string) => {
    const c = st.candidates.get(k);
    return !!c && isLive(c) && strengthAt(c, st.step, "D", p.decay) >= p.pruneThreshold;
  };
  const n = plan.tracked.length;
  const perProfile: AdaptiveMetrics["perProfile"] = {};
  let important = 0,
    importantLost = 0,
    expired = 0,
    restored = 0,
    targetReached = 0;
  for (const k of plan.tracked) {
    const at = plan.attrs.get(k)!;
    const c = s.candidates.get(k);
    const pp = (perProfile[at.profile!] ??= { retrievable: 0, n: 0, retention: retentionFor(model, at, a, p) });
    pp.n++;
    if (retrievable(s, k)) pp.retrievable++;
    if (c?.lifecycle === "expired") expired++;
    if (c && c.restoredCount > 0) restored++;
    if (c && isLive(c) && strengthAt(c, s.step, "D", p.decay) >= a.recoveryStrength) targetReached++;
    if (at.importance >= IMPORTANT_THRESHOLD) {
      important++;
      if (c?.lifecycle === "expired") importantLost++;
    }
  }
  // Falsche Rekonstruktion: Kontrollpaar vorhanden/rekonstruiert oder expired wieder belebt.
  let falseRec = 0;
  for (const k of plan.controls) if (s.candidates.get(k)) falseRec++;
  let dormantEnd = 0,
    live = 0;
  for (const c of s.candidates.values()) {
    if (c.lifecycle === "dormant") dormantEnd++;
    if (isLive(c)) live++;
  }
  const ar = afterRest ?? s;
  return {
    model,
    tracked: n,
    retrievabilityAfterRest: n ? plan.tracked.filter((k) => retrievable(ar, k)).length / n : 0,
    retrievabilityEnd: n ? plan.tracked.filter((k) => retrievable(s, k)).length / n : 0,
    targetReached,
    important,
    importantLost,
    expired,
    dormantEverTracked: everDormant.size,
    restored,
    reconstructionRate: everDormant.size ? restored / everDormant.size : null,
    falseReconstructions: falseRec,
    dormantPeak,
    dormantEnd,
    dormantPeakBytes: dormantPeak * BYTES_PER_CANDIDATE,
    activeEndBytes: live * BYTES_PER_CANDIDATE,
    perProfile,
  };
}

export type AdaptiveRestResult = {
  restSteps: number;
  seeds: { seed: number; metrics: AdaptiveMetrics[] }[];
};

export function runAdaptiveValidation(
  p: LabParams = DEFAULT_LAB_PARAMS,
  a: AdaptiveParams = DEFAULT_ADAPTIVE_PARAMS,
  restOptions: readonly number[] = ADAPTIVE_REST_STEPS,
  seedCount = ADAPTIVE_SEED_COUNT,
  snapshot: LabSnapshot = syntheticSnapshot(),
): AdaptiveRestResult[] {
  const ac = clampAdaptiveParams(a);
  return restOptions.map((restSteps) => ({
    restSteps,
    seeds: Array.from({ length: seedCount }, (_, i) => {
      const seed = p.seed + i;
      const ps = { ...p, seed };
      const plan = planAdaptive(snapshot, ps, ac, restSteps);
      return { seed, metrics: ADAPTIVE_MODELS.map((m) => runAdaptiveModel(m, plan, snapshot, ps, ac)) };
    }),
  }));
}
