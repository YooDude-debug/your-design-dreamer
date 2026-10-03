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

/** A unbegrenzt · B Verfall · C Verfall+Verstärkung · D C + reversibles Pruning (P11). */
export type LabModelId = "A" | "B" | "C" | "D";
export const LAB_MODELS: readonly LabModelId[] = ["A", "B", "C", "D"];
/** Modelle mit Verstärkung bei Abruf. */
const REINFORCING: ReadonlySet<LabModelId> = new Set(["C", "D"]);

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
  /** Nur Modell D: Schritte, die eine ruhende (dormant) Verbindung aufbewahrt wird, danach expired. */
  dormantRetention: number;
};

export const LAB_LIMITS = {
  growthRate: [0, 20],
  decay: [0, 1],
  reinforcement: [0, 1],
  activationRate: [0, 30],
  pruneThreshold: [0.01, 0.9],
  maxCandidates: [1, 2000],
  dormantRetention: [0, 400],
} as const;

export const DEFAULT_LAB_PARAMS: LabParams = {
  seed: 42,
  growthRate: 4,
  decay: 0.08,
  reinforcement: 0.35,
  activationRate: 5,
  pruneThreshold: 0.1,
  maxCandidates: 300,
  dormantRetention: 40,
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
export type Lifecycle =
  | "active"
  | "weak"
  | "inactive"
  | "reactivated"
  | "removed"
  | "dormant"
  | "expired";

/** Im Graphen aktiv (abrufbar). removed/dormant/expired sind es nicht. */
export function isLive(c: { lifecycle: Lifecycle }): boolean {
  return c.lifecycle !== "removed" && c.lifecycle !== "dormant" && c.lifecycle !== "expired";
}

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
  /** Modell D: Schritt des Übergangs nach dormant (sonst null). */
  dormantSince: number | null;
  /** Modell D: Anzahl Rekonstruktionen aus dormant (kein automatischer Reaktivierungserfolg). */
  restoredCount: number;
  restoredStep: number | null;
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

export type PoolEntry = Pick<
  LabCandidate,
  "key" | "source" | "target" | "relation" | "origin" | "confidence"
>;

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
    for (let g = 0; g < params.growthRate && cursor < order.length; g++)
      grow.push(order[cursor++]!);
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
export function strengthAt(
  c: LabCandidate,
  step: number,
  model: LabModelId,
  decay: number,
): number {
  if (model === "A") return c.anchorStrength;
  return c.anchorStrength * Math.exp(-decay * Math.max(0, step - c.lastActivatedStep));
}

function lifecycleFor(s: number, p: LabParams): Lifecycle {
  if (s < p.pruneThreshold) return "inactive";
  if (s < WEAK_THRESHOLD) return "weak";
  return "active";
}

/**
 * Optionaler Haken (P12, nur Modell D-Mechanik): Aufbewahrungsfrist je Verbindung.
 * Ohne Angabe gilt unverändert `p.dormantRetention`.
 */
export type StepOptions = { retention?: (c: LabCandidate) => number };

/** Ein Simulationsschritt – reine Funktion, liefert neuen Zustand. */
export function stepModel(
  prev: ModelState,
  ev: LabEvents,
  pool: ReadonlyMap<string, PoolEntry>,
  p: LabParams,
  opts?: StepOptions,
): ModelState {
  const retentionOf = (c: LabCandidate) => (opts?.retention ? opts.retention(c) : p.dormantRetention);
  const step = prev.step + 1;
  const cands = new Map<string, LabCandidate>();
  for (const [k, c] of prev.candidates) cands.set(k, { ...c });
  let ops = prev.ops;
  let hits = prev.hits;
  let lookups = prev.lookups;
  let added = 0;

  for (const key of ev.grow) {
    ops++;
    const live = [...cands.values()].filter(isLive).length;
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
      dormantSince: null,
      restoredCount: 0,
      restoredStep: null,
    });
    added++;
  }

  for (const key of ev.activate) {
    ops++;
    lookups++;
    const c = cands.get(key);
    if (!c) continue;
    let restored = false;
    if (prev.model === "D" && c.lifecycle === "dormant") {
      // Rekonstruktion anhand der ursprünglichen Identität (gleicher Schlüssel/Metadaten),
      // Start an der Pruning-Schwelle. Zählt NICHT als Treffer und nicht als Reaktivierung.
      c.anchorStrength = p.pruneThreshold;
      c.lastActivatedStep = step;
      c.lifecycle = "inactive";
      c.dormantSince = null;
      c.belowSince = null;
      c.restoredCount++;
      c.restoredStep = step;
      restored = true;
    }
    if (!isLive(c)) continue;
    const s = strengthAt(c, step, prev.model, p.decay);
    if (!restored && s >= p.pruneThreshold) hits++;
    c.activationCount++;
    if (REINFORCING.has(prev.model)) {
      const wasLow = !restored && (c.lifecycle === "weak" || c.lifecycle === "inactive");
      c.anchorStrength = Math.min(S_MAX, s + p.reinforcement * 1);
      c.lastActivatedStep = step;
      if (wasLow && c.anchorStrength >= WEAK_THRESHOLD) {
        c.lifecycle = "reactivated";
        c.everReactivated = true;
      }
    }
  }

  for (const c of cands.values()) {
    if (c.lifecycle === "dormant") {
      // Aufbewahrungsfrist: danach endgültig expired (nur noch Statistik, nicht rekonstruierbar).
      if (step - c.dormantSince! >= retentionOf(c)) c.lifecycle = "expired";
      ops++;
      continue;
    }
    if (!isLive(c)) continue;
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
        if (prev.model === "D") {
          c.lifecycle = "dormant";
          c.dormantSince = step;
          if (retentionOf(c) === 0) c.lifecycle = "expired";
        } else c.lifecycle = "removed";
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
  /** Endgültig entfernt (nur lifecycle "removed"); ohne dormant und expired. */
  removed: number;
  /** Abrufbar und nicht schwach (inkl. im aktuellen Schritt reaktivierter). */
  activeCount: number;
  weakCount: number;
  /** Im aktuellen Schritt als "reactivated" markiert (Teilmenge von activeCount/weakCount). */
  reactivatedCount: number;
  dormant: number;
  expired: number;
  storedRecords: number;
  activeBytes: number;
  dormantBytes: number;
  tombstoneBytes: number;
  approxBytes: number;
  ops: number;
};

/** Grobe Speicherschätzung je Kandidat (Schlüssel + Zahlenfelder). */
export const BYTES_PER_CANDIDATE = 160;
/** Grobe Schätzung eines Endzustands-Eintrags (nur Schlüssel + Zustand, Sperre gegen Neuerzeugung). */
export const BYTES_PER_TOMBSTONE = 40;

export function metricsOf(state: ModelState, snapshot: LabSnapshot, p: LabParams): LabMetrics {
  const all = [...state.candidates.values()];
  const live = all.filter(isLive);
  const dormant = all.filter((c) => c.lifecycle === "dormant").length;
  const ended = all.length - live.length - dormant;
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
    // Nur endgültig entfernte (B/C, lifecycle "removed"); dormant und expired separat.
    removed: all.filter((c) => c.lifecycle === "removed").length,
    activeCount: live.length - weak.length,
    weakCount: weak.length,
    reactivatedCount: live.filter((c) => c.lifecycle === "reactivated").length,
    dormant,
    expired: all.filter((c) => c.lifecycle === "expired").length,
    storedRecords: all.length,
    activeBytes: live.length * BYTES_PER_CANDIDATE,
    dormantBytes: dormant * BYTES_PER_CANDIDATE,
    tombstoneBytes: ended * BYTES_PER_TOMBSTONE,
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
    dormantRetention: Math.round(
      c(p.dormantRetention ?? DEFAULT_LAB_PARAMS.dormantRetention, LAB_LIMITS.dormantRetention),
    ),
  };
}
