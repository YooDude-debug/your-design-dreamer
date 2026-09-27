/**
 * ORB Core – flüchtiges Retrieval-Event (nur Beobachtung).
 *
 * Dokumentiert ausschliesslich: „Diese Memories wurden bei diesem echten
 * Recall-Vorgang (processInput → selectByLevel) abgerufen.“ Nichts wird neu
 * berechnet, sortiert oder gespeichert; keine Inhalte, nur IDs und bereits
 * vorhandene Werte. Wird nie persistiert.
 */
import type { MemoryLevel } from "./memory";

export const RETRIEVAL_CHANNEL = "orb-retrieval";
export const RETRIEVAL_PULSE_LOCK_MS = 1200;

export type OrbRetrievalEvent = {
  kind: "orb.retrieval";
  event_id: string;
  at: string;
  memory_ids: string[];
  rank: number[];
  level: MemoryLevel[];
  score: number[];
  model_visible_ids: string[];
  activation_excluded_ids: string[];
};

/** Nur bei `recalled.length > 0`; übernimmt Reihenfolge und Werte unverändert. */
export function buildRetrievalEvent(input: {
  eventId: string;
  nowMs: number;
  recalled: { id: string; level: MemoryLevel; score: number }[];
  modelVisibleIds: (string | null)[];
  activationExcludedIds: Iterable<string>;
}): OrbRetrievalEvent | null {
  if (input.recalled.length === 0) return null;
  return {
    kind: "orb.retrieval",
    event_id: input.eventId,
    at: new Date(input.nowMs).toISOString(),
    memory_ids: input.recalled.map((r) => r.id),
    rank: input.recalled.map((_, i) => i + 1),
    level: input.recalled.map((r) => r.level),
    score: input.recalled.map((r) => r.score),
    model_visible_ids: input.modelVisibleIds.filter((id): id is string => id !== null),
    activation_excluded_ids: [...input.activationExcludedIds],
  };
}

const isStrArr = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const isNumArr = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));

/** Strikte Prüfung; alles Unbekannte oder Unvollständige → false. */
export function isRetrievalEvent(v: unknown): v is OrbRetrievalEvent {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  if (e.kind !== "orb.retrieval") return false;
  if (typeof e.event_id !== "string" || e.event_id.length === 0) return false;
  if (typeof e.at !== "string" || Number.isNaN(Date.parse(e.at))) return false;
  if (!isStrArr(e.memory_ids) || e.memory_ids.length === 0) return false;
  const n = e.memory_ids.length;
  if (!isNumArr(e.rank) || e.rank.length !== n) return false;
  if (!isNumArr(e.score) || e.score.length !== n) return false;
  if (
    !Array.isArray(e.level) ||
    e.level.length !== n ||
    !e.level.every((l) => l === "A" || l === "B" || l === "C")
  )
    return false;
  if (!isStrArr(e.model_visible_ids) || !isStrArr(e.activation_excluded_ids)) return false;
  return true;
}

/** Sperrzeit gegen Flackern: true = jetzt pulsieren. */
export function createRetrievalPulseGate(lockMs = RETRIEVAL_PULSE_LOCK_MS) {
  let last = -Infinity;
  return (nowMs: number): boolean => {
    if (nowMs - last < lockMs) return false;
    last = nowMs;
    return true;
  };
}
