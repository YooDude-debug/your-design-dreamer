/**
 * ORB Synaptic Lab (P9) – Langzeitgedächtnis & Reaktivierung. SIMULATION.
 *
 * Reine, deterministische Erweiterung von simulation.ts – nutzt dieselbe
 * stepModel-Mechanik (kein zweites Rechenmodell). Kein Datenbank-, Netz-,
 * Speicher- oder Tab-Signal-Weg. Ergebnisse existieren nur im Arbeitsspeicher.
 *
 * Phasen (für alle Modelle identische Ereignisse):
 *  1 build   – Hypothesen wachsen; beobachtete Verbindungen werden mit
 *              unterschiedlicher Intensität (jeder 1./2./3. Schritt) aktiviert.
 *  2 rest    – KEINE Aktivierungen und kein Wachstum; nur Verfall läuft.
 *  3 recall  – gezielter Abruf aller beobachteten Verbindungen je Schritt,
 *              plus einmaliger Abruf von Kontrollpaaren, die nie erzeugt wurden.
 *
 * Entfernte Verbindungen werden durch einen Abruf NICHT wiederhergestellt
 * (stepModel überspringt sie; Neuerzeugung desselben Schlüssels ist gesperrt).
 */
import {
  LAB_MODELS,
  BYTES_PER_CANDIDATE,
  BYTES_PER_TOMBSTONE,
  isLive,
  S_INITIAL,
  WEAK_THRESHOLD,
  buildPool,
  initModel,
  prng,
  stepModel,
  strengthAt,
  type LabEvents,
  type LabModelId,
  type LabParams,
  type LabSnapshot,
  type Lifecycle,
  type ModelState,
  type PoolEntry,
} from "./simulation";

export type LtPhase = "build" | "rest" | "recall";

export type LongTermParams = {
  buildSteps: number;
  restSteps: number;
  recallSteps: number;
  trackedCount: number;
  /** Definierte Zielstärke für „wiederhergestellt“. */
  recoveryStrength: number;
};

export const LT_LIMITS = {
  buildSteps: [1, 200],
  restSteps: [0, 400],
  recallSteps: [1, 100],
  trackedCount: [1, 60],
  recoveryStrength: [0.05, 1],
} as const;

export const DEFAULT_LT_PARAMS: LongTermParams = {
  buildSteps: 20,
  restSteps: 15,
  recallSteps: 10,
  trackedCount: 12,
  recoveryStrength: S_INITIAL,
};

export type LtEvent = LabEvents & { phase: LtPhase };

export type LtPlan = {
  events: LtEvent[];
  tracked: string[];
  /** Pool-Schlüssel, die nie erzeugt werden – Prüfung auf falsche Reaktivierung. */
  controls: string[];
  /** Aktivierungsintervall je beobachteter Verbindung in Phase 1. */
  intensity: Record<string, number>;
};

export function clampLtParams(p: LongTermParams): LongTermParams {
  const c = (v: number, [lo, hi]: readonly [number, number]) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  return {
    buildSteps: Math.round(c(p.buildSteps, LT_LIMITS.buildSteps)),
    restSteps: Math.round(c(p.restSteps, LT_LIMITS.restSteps)),
    recallSteps: Math.round(c(p.recallSteps, LT_LIMITS.recallSteps)),
    trackedCount: Math.round(c(p.trackedCount, LT_LIMITS.trackedCount)),
    recoveryStrength: c(p.recoveryStrength, LT_LIMITS.recoveryStrength),
  };
}

/** Ereignisplan nur aus Seed + Parametern + Pool – identisch für A/B/C. */
export function planLongTerm(pool: PoolEntry[], p: LabParams, lt: LongTermParams): LtPlan {
  const rnd = prng(p.seed);
  const order = pool.map((e) => e.key);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const growable = Math.min(order.length, p.growthRate * lt.buildSteps);
  const tracked = order.slice(0, Math.min(lt.trackedCount, growable));
  const trackedSet = new Set(tracked);
  const controls = order.slice(growable, growable + tracked.length);
  const intensity: Record<string, number> = {};
  tracked.forEach((k, i) => (intensity[k] = (i % 3) + 1));

  const events: LtEvent[] = [];
  let cursor = 0;
  for (let s = 0; s < lt.buildSteps; s++) {
    const grow: string[] = [];
    for (let g = 0; g < p.growthRate && cursor < growable; g++) grow.push(order[cursor++]!);
    const activate: string[] = [];
    // Gezielte Aktivierung: nur bereits gewachsene beobachtete Verbindungen.
    for (const k of tracked) {
      if (order.indexOf(k) < cursor && s % intensity[k]! === 0) activate.push(k);
    }
    // Hintergrund-Aktivierungen (nicht beobachtete Kandidaten), seed-gesteuert.
    const others = cursor - tracked.length;
    for (let a = 0; a < p.activationRate && others > 0; a++) {
      const k = order[tracked.length + Math.floor(rnd() * others)]!;
      if (!trackedSet.has(k)) activate.push(k);
    }
    events.push({ phase: "build", grow, activate });
  }
  for (let s = 0; s < lt.restSteps; s++) events.push({ phase: "rest", grow: [], activate: [] });
  for (let s = 0; s < lt.recallSteps; s++) {
    events.push({
      phase: "recall",
      grow: [],
      activate: s === 0 ? [...tracked, ...controls] : [...tracked],
    });
  }
  return { events, tracked, controls, intensity };
}

export type TrackedSample = {
  present: boolean;
  strength: number | null;
  lifecycle: Lifecycle | null;
};

export type LtTrace = {
  model: LabModelId;
  /** samples[step][i] – Zustand der i-ten beobachteten Verbindung nach Schritt step+1. */
  samples: TrackedSample[][];
  states: ModelState[];
};

function sampleOf(s: ModelState, key: string, p: LabParams): TrackedSample {
  const c = s.candidates.get(key);
  if (!c || !isLive(c))
    return { present: false, strength: null, lifecycle: c?.lifecycle ?? null };
  return {
    present: true,
    strength: strengthAt(c, s.step, s.model, p.decay),
    lifecycle: c.lifecycle,
  };
}

export function traceModel(
  model: LabModelId,
  plan: LtPlan,
  poolMap: ReadonlyMap<string, PoolEntry>,
  p: LabParams,
): LtTrace {
  let s = initModel(model);
  const samples: TrackedSample[][] = [];
  const states: ModelState[] = [];
  for (const ev of plan.events) {
    s = stepModel(s, ev, poolMap, p);
    states.push(s);
    samples.push(plan.tracked.map((k) => sampleOf(s, k, p)));
  }
  return { model, samples, states };
}

export type LtMetrics = {
  tracked: number;
  /** Nie beobachtete Kontrollpaare (dürfen nie entstehen/reaktiviert werden). */
  controls: number;
  controlsPresent: number;
  retrievabilityBeforeRest: number | null;
  retrievabilityAfterRest: number | null;
  retrievabilityEnd: number | null;
  survivalShare: number | null;
  weakShareAfterRest: number | null;
  /** Vorhanden + schwach/inaktiv nach der Ruhe (Basis der Reaktivierungsquote). */
  weakPresentAfterRest: number;
  /** Nach der Ruhe experimentell entfernt (inkl. dormant/expired). */
  removedAfterRest: number;
  /** Modell D: beobachtete Verbindungen nach der Ruhe ruhend (dormant). */
  dormantAfterRest: number;
  /** Modell D: aus dormant rekonstruiert (Zustandsänderung, kein Reaktivierungserfolg). */
  restored: number;
  /** Modell D: rekonstruiert UND danach Zielstärke erreicht. */
  restoredReachedTarget: number;
  /** Modell D: beobachtete Verbindungen wegen abgelaufener Aufbewahrung endgültig verloren. */
  expired: number;
  /** Am Ende: aktive Verbindungen gesamt / schwach (vorhanden) gesamt / dormant gesamt. */
  activeEnd: number;
  weakEnd: number;
  dormantEnd: number;
  activeBytes: number;
  dormantBytes: number;
  tombstoneBytes: number;
  reactivated: number;
  reactivationRate: number | null;
  /** Ø Abrufschritte – nur über „nach Wiederaktivierung erreicht“. */
  meanStepsToRecovery: number | null;
  /** Zielstärke erst nach Wiederaktivierung erreicht (echter Wiederherstellungserfolg). */
  recovered: number;
  /** Zielstärke vor der Ruhe erreicht und gehalten – kein Wiederherstellungserfolg. */
  targetHeld: number;
  /** Zielstärke nie erreicht (inkl. entfernt). */
  targetNotReached: number;
  lost: number;
  falseReactivations: number;
  hypothesesCreated: number;
  approxBytes: number;
  ops: number;
};

const share = (n: number, d: number) => (d ? n / d : null);

export function ltMetrics(
  trace: LtTrace,
  plan: LtPlan,
  p: LabParams,
  lt: LongTermParams,
): LtMetrics {
  const n = plan.tracked.length;
  const at = (idx: number) => (idx >= 0 ? trace.samples[idx] : undefined);
  const retr = (row: TrackedSample[] | undefined) =>
    row ? share(row.filter((x) => x.present && x.strength! >= p.pruneThreshold).length, n) : null;
  const endBuild = at(lt.buildSteps - 1);
  const endRest = at(lt.buildSteps + lt.restSteps - 1);
  const last = at(trace.samples.length - 1);
  const recallStart = lt.buildSteps + lt.restSteps;

  const eligible = endRest
    ? plan.tracked.map((_, i) => endRest[i]!).map((x) => x.present && x.strength! < WEAK_THRESHOLD)
    : [];
  let reactivated = 0;
  let recovered = 0;
  let recoverySum = 0;
  let falseReact = 0;
  // P10: Zielstärke-Klassifikation – „bereits erreicht“ ist KEIN Wiederherstellungserfolg.
  let targetHeld = 0; // vor der Ruhe erreicht und bis Abrufbeginn nie darunter gefallen
  let targetNotReached = 0;
  let restored = 0;
  let restoredReachedTarget = 0;
  plan.tracked.forEach((key, i) => {
    let firstRecovery: number | null = null;
    let didReactivate = false;
    let heldThroughRest = true;
    for (let s = lt.buildSteps - 1; s < recallStart && s >= 0; s++) {
      const x = trace.samples[s]?.[i];
      if (!x || !x.present || x.strength! < lt.recoveryStrength) heldThroughRest = false;
    }
    for (let s = recallStart; s < trace.samples.length; s++) {
      const x = trace.samples[s]![i]!;
      const c = trace.states[s]!.candidates.get(key);
      if (!x.present) {
        // Nicht vorhandene Verbindung darf nie als reaktiviert gelten.
        if (c?.lifecycle === "reactivated") falseReact++;
        continue;
      }
      if (eligible[i] && x.lifecycle === "reactivated") didReactivate = true;
      if (firstRecovery === null && x.strength! >= lt.recoveryStrength)
        firstRecovery = s - recallStart + 1;
    }
    if (didReactivate) reactivated++;
    const lastState = trace.states[trace.states.length - 1]?.candidates.get(key);
    const restoreStep = lastState?.restoredStep ?? null;
    if (restoreStep !== null && restoreStep > recallStart - 1) {
      restored++;
      for (let s = restoreStep - 1; s < trace.samples.length; s++) {
        const x = trace.samples[s]![i]!;
        if (x.present && x.strength! >= lt.recoveryStrength) {
          restoredReachedTarget++;
          break;
        }
      }
    }
    if (heldThroughRest) targetHeld++;
    else if (firstRecovery !== null) {
      recovered++;
      recoverySum += firstRecovery;
    } else targetNotReached++;
  });
  // Kontrollpaare wurden nie erzeugt – jeder vorhandene Eintrag wäre falsch.
  const final = trace.states[trace.states.length - 1];
  let controlsPresent = 0;
  for (const k of plan.controls)
    if (final?.candidates.get(k)) {
      falseReact++;
      controlsPresent++;
    }

  const weakPresent = eligible.filter(Boolean).length;
  return {
    tracked: n,
    controls: plan.controls.length,
    controlsPresent,
    retrievabilityBeforeRest: retr(endBuild),
    retrievabilityAfterRest: retr(endRest),
    retrievabilityEnd: retr(last),
    survivalShare: endRest ? share(endRest.filter((x) => x.present).length, n) : null,
    weakShareAfterRest: endRest ? share(weakPresent, n) : null,
    weakPresentAfterRest: weakPresent,
    removedAfterRest: endRest ? endRest.filter((x) => !x.present).length : 0,
    dormantAfterRest: endRest ? endRest.filter((x) => x.lifecycle === "dormant").length : 0,
    restored,
    restoredReachedTarget,
    expired: last ? last.filter((x) => x.lifecycle === "expired").length : 0,
    ...endCounts(final, p),
    reactivated,
    reactivationRate: share(reactivated, weakPresent),
    meanStepsToRecovery: recovered ? recoverySum / recovered : null,
    recovered,
    targetHeld,
    targetNotReached,
    lost: last ? last.filter((x) => !x.present).length : 0,
    falseReactivations: falseReact,
    hypothesesCreated: final ? final.candidates.size : 0,
    approxBytes: (final ? final.candidates.size : 0) * BYTES_PER_CANDIDATE,
    ops: final?.ops ?? 0,
  };
}

function endCounts(final: ModelState | undefined, p: LabParams) {
  const all = final ? [...final.candidates.values()] : [];
  const live = all.filter(isLive);
  const weak = live.filter(
    (c) => strengthAt(c, final!.step, final!.model, p.decay) < WEAK_THRESHOLD,
  ).length;
  const dormant = all.filter((c) => c.lifecycle === "dormant").length;
  return {
    activeEnd: live.length - weak,
    weakEnd: weak,
    dormantEnd: dormant,
    activeBytes: live.length * BYTES_PER_CANDIDATE,
    dormantBytes: dormant * BYTES_PER_CANDIDATE,
    tombstoneBytes: (all.length - live.length - dormant) * BYTES_PER_TOMBSTONE,
  };
}

/** Vollständiger Langzeitlauf aller drei Modelle mit identischem Plan. */
export function runLongTerm(snapshot: LabSnapshot, p: LabParams, lt: LongTermParams) {
  const pool = buildPool(snapshot);
  const poolMap = new Map(pool.map((e) => [e.key, e]));
  const plan = planLongTerm(pool, p, lt);
  const traces = LAB_MODELS.map((m) => traceModel(m, plan, poolMap, p));
  const metrics = traces.map((t) => ltMetrics(t, plan, p, lt));
  return { plan, traces, metrics };
}

/** Vergleich mehrerer Seeds (gleiche übrigen Parameter). */
export function compareSeeds(
  snapshot: LabSnapshot,
  p: LabParams,
  lt: LongTermParams,
  seeds: number[],
) {
  return seeds.map((seed) => ({
    seed,
    metrics: runLongTerm(snapshot, { ...p, seed }, lt).metrics,
  }));
}
