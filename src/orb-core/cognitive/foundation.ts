/**
 * ORB Core – Phase 1: Cognitive State Foundation (rein strukturell).
 *
 * Isolierte, rückbaubare Schicht. Wird von KEINEM bestehenden ORB-Pfad
 * importiert: kein Verhalten, keine DB, keine LLM-/API-Aufrufe.
 *
 * - energy wird NICHT neu berechnet, sondern nur aus dem bestehenden
 *   OrbState gelesen (Adapter `energyFromOrbState`).
 * - Keine Relevanzformel (bewusst, Phase 1).
 * - Ziele sind ausschliesslich benutzerkontrolliert.
 * - Eine Inference ist niemals Direct Memory.
 * - Namensraum "Cognitive…" trennt diese Impulse vom bestehenden
 *   `impulse.ts` (Proactive Impulse Decision), das unverändert bleibt.
 */
import type { OrbState } from "@/orb-core/core";

/** Endlicher Wert auf [0,1]; NaN/Infinity/Nicht-Zahl → null. */
export function unitOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

export function isUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

// ---------------------------------------------------------------- State

export const COGNITIVE_KEYS = [
  "relevance",
  "novelty",
  "uncertainty",
  "goalPressure",
  "attention",
  "confidence",
  "socialFeedback",
  "frustration",
  "energy",
] as const;

export type OrbCognitiveKey = (typeof COGNITIVE_KEYS)[number];
export type OrbCognitiveState = Record<OrbCognitiveKey, number>;

/** Read-Adapter: bestehende Energy unverändert übernehmen (nur begrenzt). */
export function energyFromOrbState(state: Pick<OrbState, "energy">): number {
  return unitOrNull(state.energy) ?? 0;
}

/**
 * Validiert/normalisiert einen Kandidaten. Ungültige Einzelwerte → 0.
 * Liefert zusätzlich die Liste der ungültigen Schlüssel.
 */
export function normalizeCognitiveState(input: Partial<Record<OrbCognitiveKey, unknown>>): {
  state: OrbCognitiveState;
  invalid: OrbCognitiveKey[];
} {
  const invalid: OrbCognitiveKey[] = [];
  const state = {} as OrbCognitiveState;
  for (const key of COGNITIVE_KEYS) {
    const raw = input[key];
    const v = unitOrNull(raw);
    if (v === null || v !== raw) invalid.push(key);
    state[key] = v ?? 0;
  }
  return { state, invalid };
}

export function isCognitiveState(value: unknown): value is OrbCognitiveState {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return COGNITIVE_KEYS.every((k) => isUnit(rec[k]));
}

// ---------------------------------------------------------------- Goals

export const GOAL_STATUSES = ["active", "paused", "completed"] as const;
export type OrbGoalStatus = (typeof GOAL_STATUSES)[number];

/** Benutzerkontrolliert – ORB erzeugt/ändert Ziele in Phase 1 nicht. */
export type OrbGoal = {
  id: string;
  title: string;
  description?: string;
  priority: number;
  status: OrbGoalStatus;
  createdAt: string;
  updatedAt: string;
};

export function isGoalStatus(value: unknown): value is OrbGoalStatus {
  return typeof value === "string" && (GOAL_STATUSES as readonly string[]).includes(value);
}

export function isValidGoalPriority(value: unknown): value is number {
  return isUnit(value);
}

export function isOrbGoal(value: unknown): value is OrbGoal {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.id === "string" &&
    g.id.length > 0 &&
    typeof g.title === "string" &&
    g.title.trim().length > 0 &&
    (g.description === undefined || typeof g.description === "string") &&
    isValidGoalPriority(g.priority) &&
    isGoalStatus(g.status) &&
    typeof g.createdAt === "string" &&
    typeof g.updatedAt === "string"
  );
}

// ---------------------------------------------------------------- Provenance

export type OrbInformationSource =
  | { type: "memory"; memoryId: string }
  | { type: "conversation"; messageId: string }
  | { type: "inference"; sourceIds: string[] }
  | { type: "unknown" };

export type OrbProvenanceKind = "direct_memory" | "current_conversation" | "inference" | "unknown";

export function isInformationSource(value: unknown): value is OrbInformationSource {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  switch (s.type) {
    case "memory":
      return typeof s.memoryId === "string" && s.memoryId.length > 0;
    case "conversation":
      return typeof s.messageId === "string" && s.messageId.length > 0;
    case "inference":
      // Inference braucht nachvollziehbare Quellen.
      return (
        Array.isArray(s.sourceIds) &&
        s.sourceIds.length > 0 &&
        s.sourceIds.every((id) => typeof id === "string" && id.length > 0)
      );
    case "unknown":
      return true;
    default:
      return false;
  }
}

export function provenanceKind(source: OrbInformationSource): OrbProvenanceKind {
  switch (source.type) {
    case "memory":
      return "direct_memory";
    case "conversation":
      return "current_conversation";
    case "inference":
      return "inference";
    default:
      return "unknown";
  }
}

/** Nur echte Memory-Quellen gelten als Direct Memory – nie eine Inference. */
export function isDirectMemory(source: OrbInformationSource): boolean {
  return source.type === "memory";
}

// ---------------------------------------------------------------- Impulses (Schnittstelle)

export const COGNITIVE_IMPULSE_TYPES = [
  "knowledge_gap",
  "goal_relevance",
  "novelty",
  "contradiction",
  "experience",
  "follow_up",
] as const;
export type OrbCognitiveImpulseType = (typeof COGNITIVE_IMPULSE_TYPES)[number];

export type OrbCognitiveImpulse = {
  id: string;
  type: OrbCognitiveImpulseType;
  score: number;
  reason: string;
};

export function isCognitiveImpulse(value: unknown): value is OrbCognitiveImpulse {
  if (!value || typeof value !== "object") return false;
  const i = value as Record<string, unknown>;
  return (
    typeof i.id === "string" &&
    i.id.length > 0 &&
    typeof i.type === "string" &&
    (COGNITIVE_IMPULSE_TYPES as readonly string[]).includes(i.type) &&
    isUnit(i.score) &&
    typeof i.reason === "string"
  );
}

// ---------------------------------------------------------------- Experience (Schnittstelle)

export type OrbExperience = {
  actionId: string;
  expectedOutcome?: string;
  actualOutcome?: string;
  success: number;
  usefulness: number;
  userFeedback?: number;
  createdAt: string;
};

export function isOrbExperience(value: unknown): value is OrbExperience {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.actionId === "string" &&
    e.actionId.length > 0 &&
    (e.expectedOutcome === undefined || typeof e.expectedOutcome === "string") &&
    (e.actualOutcome === undefined || typeof e.actualOutcome === "string") &&
    isUnit(e.success) &&
    isUnit(e.usefulness) &&
    (e.userFeedback === undefined || isUnit(e.userFeedback)) &&
    typeof e.createdAt === "string"
  );
}
