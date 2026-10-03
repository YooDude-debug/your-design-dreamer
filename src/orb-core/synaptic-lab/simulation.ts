/**
 * ORB Synaptic Lab (P8) – reine, deterministische Simulation.
 *
 * Forschungsexperiment, KEINE produktive Kognition:
 * - Eingabe ist ein eingefrorener, nur gelesener Snapshot des eigenen Graphen.
 * - Alle Kandidaten, Stärken und Ereignisse existieren nur in diesem Modul
 *   (Arbeitsspeicher des Browsers). Es gibt keinen Schreibweg zur Datenbank.
 * - Simulierte Aktivierungen sind Zufallsereignisse aus einem Seed, keine
 *   echten ORB-Abrufe oder Gedanken.
 * - Hypothesen werden nie automatisch bestätigt; nur `confirmCandidate`
 *   (ausdrückliche Aktion im Labor) setzt den experimentellen Status.
 *
 * Modell:  S(t) = S₀ · e^(−λ·Δt)      Verstärkung (nur C): S = min(S_max, S(t) + η·R)
 */

export type LabModelId = "A" | "B" | "C";
export const LAB_MODELS: readonly LabModelId[] = ["A", "B", "C"];

export type LabParams = {
  seed: number;
  /** Neue Kandidaten pro Schritt (Wachstumsrate). */
  growthRate: number;
  /** λ pro Schritt. */
  decay: number;
  /** η – Verstärkungsfaktor. */
  reinforcement: number;
  /** Simulierte Aktivierungen pro Schritt. */
  activationRate: number;
  /** Unterhalb gilt eine Verbindung als inaktiv; nach `removeAfter` Schritten experimentell entfernt. */
  pruneThreshold: number;
  /** Obergrenze experimenteller Kandidaten je Modell. */
  maxCandidates: number;
};

export const LAB_LIMITS = {
  growthRate: [0, 20],
  decay: [0, 1],
  reinforcement: [0, 1],
  activationRate: [0, 30],
  pruneThreshold: [0.01, 0.9],
  maxCandidates: [1, 2000],
} as const;

export const DEFAULT_LAB_PARAMS: LabParams = {
  seed: 42,
  growthRate: 4,
  decay: 0.08,
  reinforcement: 0.35,
  activationRate: 5,
  pruneThreshold: 0.1,
  maxCandidates: 300,
};

export const S_MAX = 1;
export const S_INITIAL = 0.4;
/** Ab hier schwach (zwischen Pruning-Schwelle und diesem Wert). */
export const WEAK_THRESHOLD = 0.3;
/** Schritte unter der Pruning-Schwelle bis zur experimentellen Entfernung. */
export const REMOVE_AFTER_STEPS = 5;
/** Maximale Grösse des Kandidatenpools (Schutz gegen kombinatorische Explosion). */
export const POOL_MAX = 5000;

export type LabNode = { id: string; group: string | null };
export type LabEdge = { source: string; target: string };
export type LabSnapshot = { nodes: LabNode[]; edges: LabEdge[] };

export type HypothesisStatus = "hypothesis" | "confirmed" | "rejected" | "weakened";
export type Lifecycle = "active" | "weak" | "inactive" | "reactivated" | "removed";

export type LabCandidate = {
  key: string;
  source: string;
  target: string;
  relation: "same_group" | "shared_neighbor";
  origin: string;
  confidence: number;
  /** Stärke beim letzten Anker (S₀). */
  anchorStrength: number;
  createdStep: number;
  lastActivatedStep: number;
  activationCount: number;
  status: HypothesisStatus;
  lifecycle: Lifecycle;
  belowSince: number | null;
  everReactivated: boolean;
};

export type LabEvents = { grow: string[]; activate: string[] };

export type ModelState = {
  model: LabModelId;
  step: number;
  candidates: Map<string, LabCandidate>;
  ops: number;
  hits: number;
  lookups: number;
  addedLastStep: number;
};

/** Mulberry32 – kleiner, deterministischer PRNG. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export type PoolEntry = Pick<LabCandidate, "key" | "source" | "target" | "relation" | "origin" | "confidence">;

/**
 * Deterministischer, begrenzter Kandidatenpool: Paare ohne bestehende Kante,
 * die dieselbe Gruppe teilen oder einen gemeinsamen Nachbarn haben.
 */
export function buildPool(snapshot: LabSnapshot): PoolEntry[] {
  const nodes = [...snapshot.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const existing = new Set(snapshot.edges.map((e) => pairKey(e.source, e.target)));
  const nb = new Map<string, Set<string>>();
  for (const e of snapshot.edges) {
    if (!nb.has(e.source)) nb.set(e.source, new Set());
    if (!nb.has(e.target)) nb.set(e.target, new Set());
    nb.get(e.source)!.add(e.target);
    nb.get(e.target)!.add(e.source);
  }
  const out: PoolEntry[] = [];
  for (let i = 0; i < nodes.length && out.length < POOL_MAX; i++) {
    for (let j = i + 1; j < nodes.length && out.length < POOL_MAX; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const key = pairKey(a.id, b.id);
      if (existing.has(key)) continue;
      const na = nb.get(a.id);
      const nbb = nb.get(b.id);
      let shared = 0;
      if (na && nbb) for (const x of na) if (nbb.has(x)) shared++;
      if (shared > 0) {
        out.push({
          key,
          source: a.id < b.id ? a.id : b.id,
          target: a.id < b.id ? b.id : a.id,
          relation: "shared_neighbor",
          origin: `${shared} gemeinsame Nachbarn im Snapshot`,
          confidence: Math.min(0.9, 0.3 + 0.15 * shared),
        });
      } else if (a.group && a.group === b.group) {
        out.push({
          key,
          source: a.id < b.id ? a.id : b.id,
          target: a.id < b.id ? b.id : a.id,
          relation: "same_group",
          origin: "gleiches Thema/Kategorie im Snapshot",
          confidence: 0.25,
        });
      }
    }
  }
  return out;
}

/** Identischer Ereignisverlauf für alle Modelle (nur aus Seed + Parametern). */
export function generateEvents(pool: PoolEntry[], params: LabParams, steps: number): LabEvents[] {
  const rnd = prng(params.seed);
  const order = pool.map((p) => p.key);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const events: LabEvents[] = [];
  let cursor = 0;
  for (let s = 0; s < steps; s++) {
    const grow: string[] = [];
    for (let g = 0; g < params.growthRate && cursor < order.length; g++) grow.push(order[cursor++]!);
    const activate: string[] = [];
    // Aktivierungen nur auf bereits vorgeschlagene Paare (sonst ohne Bedeutung).
    for (let a = 0; a < params.activationRate && cursor > 0; a++) {
      activate.push(order[Math.floor(rnd() * cursor)]!);
    }
    events.push({ grow, activate });
  }
  return events;
}

export function initModel(model: LabModelId): ModelState {
  return { model, step: 0, candidates: new Map(), ops: 0, hits: 0, lookups: 0, addedLastStep: 0 };
}

/** S(t) = S₀ · e^(−λ·Δt); Modell A verfällt nicht. */
export function strengthAt(c: LabCandidate, step: number, model: LabModelId, decay: number): number {
  if (model === "A") return c.anchorStrength;
  return c.anchorStrength * Math.exp(-decay * Math.max(0, step - c.lastActivatedStep));
}

function lifecycleFor(s: number, p: LabParams): Lifecycle {
  if (s < p.pruneThreshold) return "inactive";
  if (s < WEAK_THRESHOLD) return "weak";
  return "active";
}

/** Ein Simulationsschritt – reine Funktion, liefert neuen Zustand. */
export function stepModel(
  prev: ModelState,
  ev: LabEvents,
  pool: ReadonlyMap<string, PoolEntry>,
  p: LabParams,
): ModelState {
  const step = prev.step + 1;
  const cands = new Map<string, LabCandidate>();
  for (const [k, c] of prev.candidates) cands.set(k, { ...c });
  let ops = prev.ops;
  let hits = prev.hits;
  let lookups = prev.lookups;
  let added = 0;

  for (const key of ev.grow) {
    ops++;
    const live = [...cands.values()].filter((c) => c.lifecycle !== "removed").length;
    if (cands.has(key) || live >= p.maxCandidates) continue;
    const base = pool.get(key);
    if (!base) continue;
    cands.set(key, {
      ...base,
      anchorStrength: S_INITIAL,
      createdStep: step,
      lastActivatedStep: step,
      activationCount: 0,
      status: "hypothesis",
      lifecycle: "active",
      belowSince: null,
      everReactivated: false,
    });
    added++;
  }

  for (const key of ev.activate) {
    ops++;
    lookups++;
    const c = cands.get(key);
    if (!c || c.lifecycle === "removed") continue;
    const s = strengthAt(c, step, prev.model, p.decay);
    if (s >= p.pruneThreshold) hits++;
    c.activationCount++;
    if (prev.model === "C") {
      const wasLow = c.lifecycle === "weak" || c.lifecycle === "inactive";
      c.anchorStrength = Math.min(S_MAX, s + p.reinforcement * 1);
      c.lastActivatedStep = step;
      if (wasLow && c.anchorStrength >= WEAK_THRESHOLD) {
        c.lifecycle = "reactivated";
        c.everReactivated = true;
      }
    }
  }

  for (const c of cands.values()) {
    if (c.lifecycle === "removed") continue;
    const s = strengthAt(c, step, prev.model, p.decay);
    const lc = lifecycleFor(s, p);
    if (c.lifecycle === "reactivated" && lc === "active") {
      // bleibt im Schritt der Reaktivierung sichtbar markiert
      if (c.lastActivatedStep !== step) c.lifecycle = "active";
    } else {
      c.lifecycle = lc;
    }
    if (lc === "inactive") {
      c.belowSince = c.belowSince ?? step;
      // Bestätigte Fakten werden durch Nichtbenutzung nicht falsch und nicht entfernt.
      if (c.status !== "confirmed" && step - c.belowSince >= REMOVE_AFTER_STEPS) {
        c.lifecycle = "removed";
      }
    } else {
      c.belowSince = null;
    }
    if (c.status === "hypothesis" && lc !== "active" && c.lifecycle !== "reactivated") {
      c.status = "weakened";
    } else if (c.status === "weakened" && (lc === "active" || c.lifecycle === "reactivated")) {
      c.status = "hypothesis";
    }
    ops++;
  }

  return { model: prev.model, step, candidates: cands, ops, hits, lookups, addedLastStep: added };
}

/** Ausdrückliche, rein experimentelle Bestätigung/Verwerfung im Labor. */
export function setCandidateStatus(
  state: ModelState,
  key: string,
  status: "confirmed" | "rejected",
): ModelState {
  const c = state.candidates.get(key);
  if (!c) return state;
  const cands = new Map(state.candidates);
  cands.set(key, { ...c, status });
  return { ...state, candidates: cands };
}

export type LabMetrics = {
  nodes: number;
  baseEdges: number;
  candidates: number;
  liveCandidates: number;
  growthLastStep: number;
  weakShare: number;
  reactivatedShare: number;
  retrievability: number | null;
  unconfirmed: number;
  rejected: number;
  removed: number;
  storedRecords: number;
  approxBytes: number;
  ops: number;
};

/** Grobe Speicherschätzung je Kandidat (Schlüssel + Zahlenfelder). */
export const BYTES_PER_CANDIDATE = 160;

export function metricsOf(state: ModelState, snapshot: LabSnapshot, p: LabParams): LabMetrics {
  const all = [...state.candidates.values()];
  const live = all.filter((c) => c.lifecycle !== "removed");
  const weak = live.filter((c) => {
    const s = strengthAt(c, state.step, state.model, p.decay);
    return s < WEAK_THRESHOLD;
  });
  return {
    nodes: snapshot.nodes.length,
    baseEdges: snapshot.edges.length,
    candidates: all.length,
    liveCandidates: live.length,
    growthLastStep: state.addedLastStep,
    weakShare: live.length ? weak.length / live.length : 0,
    reactivatedShare: live.length ? live.filter((c) => c.everReactivated).length / live.length : 0,
    retrievability: state.lookups ? state.hits / state.lookups : null,
    unconfirmed: all.filter((c) => c.status === "hypothesis" || c.status === "weakened").length,
    rejected: all.filter((c) => c.status === "rejected").length,
    removed: all.length - live.length,
    storedRecords: all.length,
    approxBytes: all.length * BYTES_PER_CANDIDATE,
    ops: state.ops,
  };
}

/** Komplettlauf aller drei Modelle mit identischem Snapshot und Ereignisverlauf. */
export function runComparison(snapshot: LabSnapshot, p: LabParams, steps: number) {
  const pool = buildPool(snapshot);
  const poolMap = new Map(pool.map((e) => [e.key, e]));
  const events = generateEvents(pool, p, steps);
  const states = LAB_MODELS.map((m) => {
    let s = initModel(m);
    for (const ev of events) s = stepModel(s, ev, poolMap, p);
    return s;
  });
  return { pool, events, states };
}

/** Snapshot-Adapter: übernimmt nur IDs, Gruppe und Kantenenden (keine Inhalte). */
export function toLabSnapshot(input: {
  nodes: { id: string; topic: string | null; category: string | null }[];
  edges: { sourceNodeId: string; targetNodeId: string }[];
}): LabSnapshot {
  const ids = new Set(input.nodes.map((n) => n.id));
  return {
    nodes: input.nodes.map((n) => ({ id: n.id, group: n.topic ?? n.category ?? null })),
    edges: input.edges
      .filter((e) => ids.has(e.sourceNodeId) && ids.has(e.targetNodeId))
      .map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId })),
  };
}

export function clampParams(p: LabParams): LabParams {
  const c = (v: number, [lo, hi]: readonly [number, number]) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  return {
    seed: Number.isFinite(p.seed) ? Math.trunc(p.seed) : 1,
    growthRate: Math.round(c(p.growthRate, LAB_LIMITS.growthRate)),
    decay: c(p.decay, LAB_LIMITS.decay),
    reinforcement: c(p.reinforcement, LAB_LIMITS.reinforcement),
    activationRate: Math.round(c(p.activationRate, LAB_LIMITS.activationRate)),
    pruneThreshold: c(p.pruneThreshold, LAB_LIMITS.pruneThreshold),
    maxCandidates: Math.round(c(p.maxCandidates, LAB_LIMITS.maxCandidates)),
  };
}
