/**
 * ORB Core – Phase 11: Cognitive Snapshot (passive Momentbeschreibung).
 *
 * "Welche kognitiven Informationen liegen in diesem Moment gemeinsam vor?"
 * – keine Entscheidung, keine Auswahl, keine Strategie, kein Score.
 *
 * - Alles nur aus explizitem Input; fehlend → null bzw. [].
 * - currentFocus: nur expliziter, gültiger Fokus (kind+id), sonst null.
 *   Nie aus Relevance/Attention/Goal Pressure/Candidates abgeleitet.
 * - attentionAvailability: nur endliche Zahl in [0,1], sonst null.
 *   Nie aus Energy oder Candidates berechnet, nicht geklemmt.
 * - Listen: Reihenfolge erhalten, nicht sortiert/dedupliziert/gefiltert/
 *   neu berechnet; tief kopiert (Array- und Objekt-Isolation).
 * - Provenance bleibt unverändert (structuredClone).
 * - Keine Zeit, kein Zufall, keine DB/API/LLM. Von keinem Modul importiert.
 */
import type { OrbGoal } from "@/orb-core/cognitive/foundation";
import type { OrbAttentionFocus } from "./attention";
import type { OrbExperienceAssessment } from "./experience";
import type { OrbContradictionResult } from "./contradiction";
import type { OrbCognitiveCandidate } from "./candidate";
import type { OrbCompetitionRelationship } from "./competition.ts";

export type OrbCognitiveSnapshot = {
  currentFocus: OrbAttentionFocus | null;
  attentionAvailability: number | null;
  candidates: OrbCognitiveCandidate[];
  competitions: OrbCompetitionRelationship[];
  goals: OrbGoal[];
  experiences: OrbExperienceAssessment[];
  conflicts: OrbContradictionResult[];
};

export type OrbCognitiveSnapshotInput = {
  currentFocus?: unknown;
  attentionAvailability?: unknown;
  candidates?: OrbCognitiveCandidate[] | null;
  competitions?: OrbCompetitionRelationship[] | null;
  goals?: OrbGoal[] | null;
  experiences?: OrbExperienceAssessment[] | null;
  conflicts?: OrbContradictionResult[] | null;
};

const FOCUS_KINDS = ["conversation", "task", "thread", "user_set"];

function readFocus(v: unknown): OrbAttentionFocus | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  if (typeof f.kind !== "string" || !FOCUS_KINDS.includes(f.kind)) return null;
  if (typeof f.id !== "string" || f.id.length === 0) return null;
  return { kind: f.kind as OrbAttentionFocus["kind"], id: f.id };
}

function readAvailability(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
}

function list<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? structuredClone(v) : [];
}

export function createCognitiveSnapshot(
  input: OrbCognitiveSnapshotInput = {},
): OrbCognitiveSnapshot {
  return {
    currentFocus: readFocus(input.currentFocus),
    attentionAvailability: readAvailability(input.attentionAvailability),
    candidates: list(input.candidates),
    competitions: list(input.competitions),
    goals: list(input.goals),
    experiences: list(input.experiences),
    conflicts: list(input.conflicts),
  };
}
