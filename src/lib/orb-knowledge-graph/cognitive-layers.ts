/**
 * Cognitive Globe – reine Mapping-Schicht (nur Darstellung).
 *
 * Verdichtet die bereits vorhandene, flüchtige Cognitive Observation aus dem
 * Rundenergebnis zu einer kompakten Ansicht für die Ebenen des Globes.
 * - Nichts wird berechnet, bewertet, sortiert oder ergänzt.
 * - Fehlende Werte bleiben null bzw. leer.
 * - `maximumOverlap` bleibt `maximumOverlap`; Coverage bleibt Coverage.
 * - Strategy `available` ist KEINE Auswahl.
 * - Kein Speichern, keine DB, kein Modellaufruf.
 */
import type { OrbCognitiveObservation } from "@/orb-sdk";

/** Browser-Kanal ORB-Kanal → Globe (nur Admins, nur flüchtig). */
export const COGNITIVE_CHANNEL = "orb-cognitive";

export const COGNITIVE_FACTOR_KEYS = [
  "relevance",
  "novelty",
  "uncertainty",
  "goalPressure",
  "attention",
  "experience",
  "contradiction",
] as const;
export type CognitiveFactorKey = (typeof COGNITIVE_FACTOR_KEYS)[number];

export const COVERAGE_KEYS = [
  "relevanceCoverage",
  "noveltyCoverage",
  "uncertaintyCoverage",
  "goalPressureCoverage",
  "attentionCoverage",
  "experienceCoverage",
  "contradictionCoverage",
] as const;
export type CoverageKey = (typeof COVERAGE_KEYS)[number];

export const STRATEGY_KEYS = [
  "continue_focus",
  "ask_clarification",
  "explore_gap",
  "resolve_conflict",
  "switch_focus",
  "defer",
  "observe",
  "follow_up",
] as const;

export type CognitiveLayerId =
  | "memory"
  | "factors"
  | "candidates"
  | "competition"
  | "snapshot"
  | "strategy"
  | "decision"
  | "action"
  | "outcome"
  | "adaptation";

/** Reihenfolge = räumliche Schale von innen nach aussen (keine Wertung). */
export const COGNITIVE_LAYERS: { id: CognitiveLayerId; label: string }[] = [
  { id: "memory", label: "Memory Core" },
  { id: "factors", label: "Cognitive Factors" },
  { id: "candidates", label: "Candidates" },
  { id: "competition", label: "Competition" },
  { id: "snapshot", label: "Snapshot" },
  { id: "strategy", label: "Strategy" },
  { id: "decision", label: "Decision Foundation" },
  { id: "action", label: "Action" },
  { id: "outcome", label: "Outcome" },
  { id: "adaptation", label: "Adaptation" },
];

export type CognitiveView = {
  path: "chat" | "proactive_question";
  receivedAt: string;
  candidates: {
    id: string | null;
    memoryId: string | null;
    sourceType: string;
    /** Nur ob eine Dimension vorliegt – nie ein Wert. */
    factors: Record<CognitiveFactorKey, boolean>;
  }[];
  truncated: boolean;
  competitions: {
    leftCandidateId: string | null;
    rightCandidateId: string | null;
    maximumOverlap: number | null;
  }[];
  snapshot: {
    currentFocus: { kind: string; id: string } | null;
    attentionAvailability: number | null;
    goals: number;
    experiences: number;
    conflicts: number;
  };
  strategies: { type: string; available: boolean }[];
  /** Nur wenn alle Decision-Candidates denselben Wert tragen, sonst null. */
  coverage: Record<CoverageKey, number | null>;
  actionPlans: { strategy: string; action: string; executable: boolean }[];
  outcome: null;
  adaptation: null;
};

const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Rein: Observation → kompakte Ansicht; ungültig/fehlgeschlagen → null. */
export function toCognitiveView(obs: unknown, receivedAt: string): CognitiveView | null {
  if (!obs || typeof obs !== "object") return null;
  const o = obs as OrbCognitiveObservation;
  if (o.kind !== "orb.cognitive_observation" || o.status !== "observed") return null;
  const snap = o.snapshot;
  const candidates = (snap?.candidates ?? []).map((c) => {
    const factors = {} as Record<CognitiveFactorKey, boolean>;
    for (const k of COGNITIVE_FACTOR_KEYS) factors[k] = c[k] !== null && c[k] !== undefined;
    return {
      id: c.id,
      memoryId: c.source?.type === "memory" ? (c.source.memoryId ?? null) : null,
      sourceType: c.source?.type ?? "unknown",
      factors,
    };
  });
  const coverage = {} as Record<CoverageKey, number | null>;
  const dc = o.decision?.candidates ?? [];
  for (const k of COVERAGE_KEYS) {
    const vals = dc.map((d) => numOrNull(d.decisionInputs?.[k]));
    const first = vals[0] ?? null;
    coverage[k] = first !== null && vals.every((v) => v === first) ? first : null;
  }
  return {
    path: o.path === "proactive_question" ? "proactive_question" : "chat",
    receivedAt,
    candidates,
    truncated: o.truncated === true,
    competitions: (snap?.competitions ?? []).map((c) => ({
      leftCandidateId: c.leftCandidateId,
      rightCandidateId: c.rightCandidateId,
      maximumOverlap: numOrNull(c.maximumOverlap),
    })),
    snapshot: {
      currentFocus: snap?.currentFocus
        ? { kind: snap.currentFocus.kind, id: snap.currentFocus.id }
        : null,
      attentionAvailability: numOrNull(snap?.attentionAvailability),
      goals: snap?.goals?.length ?? 0,
      experiences: snap?.experiences?.length ?? 0,
      conflicts: snap?.conflicts?.length ?? 0,
    },
    strategies: (o.strategies?.strategies ?? []).map((s) => ({
      type: s.type,
      available: s.available === true,
    })),
    coverage,
    actionPlans: (o.actionPlans ?? []).map((a) => ({
      strategy: a.strategy,
      action: a.action,
      executable: a.executable === true,
    })),
    outcome: null,
    adaptation: null,
  };
}

/** Strikte Prüfung der über den Browser-Kanal empfangenen Ansicht. */
export function isCognitiveView(v: unknown): v is CognitiveView {
  if (!v || typeof v !== "object") return false;
  const x = v as Record<string, unknown>;
  return (
    (x.path === "chat" || x.path === "proactive_question") &&
    typeof x.receivedAt === "string" &&
    Array.isArray(x.candidates) &&
    Array.isArray(x.competitions) &&
    Array.isArray(x.strategies) &&
    Array.isArray(x.actionPlans) &&
    !!x.snapshot &&
    !!x.coverage &&
    x.outcome === null &&
    x.adaptation === null
  );
}

/** Welche Layer tragen aktuell tatsächlich Daten (für Anzeige "leer"). */
export function layerHasData(view: CognitiveView | null, id: CognitiveLayerId): boolean {
  if (id === "memory") return true;
  if (!view) return false;
  switch (id) {
    case "factors":
      return view.candidates.some((c) => COGNITIVE_FACTOR_KEYS.some((k) => c.factors[k]));
    case "candidates":
      return view.candidates.length > 0;
    case "competition":
      return view.competitions.length > 0;
    case "snapshot":
      return (
        view.snapshot.currentFocus !== null ||
        view.snapshot.attentionAvailability !== null ||
        view.snapshot.goals + view.snapshot.experiences + view.snapshot.conflicts > 0 ||
        view.candidates.length > 0
      );
    case "strategy":
      return view.strategies.length > 0;
    case "decision":
      return COVERAGE_KEYS.some((k) => view.coverage[k] !== null);
    case "action":
      return view.actionPlans.length > 0;
    default:
      return false;
  }
}
