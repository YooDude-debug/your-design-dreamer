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

/** Herkunft der Aktivierung: Antwort (Recall in processInput) oder autonome Frage. */
export type OrbActivationType = "reply" | "autonomous_question";

export type OrbRetrievalEvent = {
  kind: "orb.retrieval";
  /** Fehlt bei älteren Events ⇒ "reply". */
  activation?: OrbActivationType;
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
  excludedFromActivation: Iterable<string>;
}): OrbRetrievalEvent | null {
  if (input.recalled.length === 0) return null;
  return {
    kind: "orb.retrieval",
    activation: "reply",
    event_id: input.eventId,
    at: new Date(input.nowMs).toISOString(),
    memory_ids: input.recalled.map((r) => r.id),
    rank: input.recalled.map((_, i) => i + 1),
    level: input.recalled.map((r) => r.level),
    score: input.recalled.map((r) => r.score),
    model_visible_ids: input.modelVisibleIds.filter((id): id is string => id !== null),
    activation_excluded_ids: [...input.excludedFromActivation],
  };
}

/**
 * Autonome Frage: genau die Quell-Memory, die in den Formulierungs-Prompt
 * übernommen wurde (Stufe „in Kontext übernommen“). Keine Verbindungen –
 * der Laufzeitpfad nutzt keine Kanten, also wird keine als durchlaufen gemeldet.
 */
export function buildQuestionActivationEvent(input: {
  eventId: string;
  nowMs: number;
  memoryId: string | null | undefined;
}): OrbRetrievalEvent | null {
  if (!input.memoryId) return null;
  return {
    kind: "orb.retrieval",
    activation: "autonomous_question",
    event_id: input.eventId,
    at: new Date(input.nowMs).toISOString(),
    memory_ids: [input.memoryId],
    rank: [1],
    level: ["A"],
    score: [1],
    model_visible_ids: [input.memoryId],
    activation_excluded_ids: [],
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
  if (
    e.activation !== undefined &&
    e.activation !== "reply" &&
    e.activation !== "autonomous_question"
  )
    return false;
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

/** Abstand zwischen nacheinander hervorgehobenen Knoten (ms). */
export const RETRIEVAL_STEP_MS = 320;
/** Höchstzahl gleichzeitig wartender Knoten – ältere fallen weg, nichts stapelt sich. */
export const RETRIEVAL_QUEUE_MAX = 24;

/**
 * Rein: hängt die IDs eines Events an die Warteschlange an. Bereits wartende
 * IDs werden zusammengefasst (Herkunft = Liste der Event-IDs bleibt erhalten).
 */
export function enqueueActivation(
  queue: { id: string; events: string[] }[],
  memoryIds: readonly string[],
  eventId: string,
  max = RETRIEVAL_QUEUE_MAX,
): { id: string; events: string[] }[] {
  const out = queue.map((q) => ({ id: q.id, events: [...q.events] }));
  for (const id of memoryIds) {
    const hit = out.find((q) => q.id === id);
    if (hit) {
      if (!hit.events.includes(eventId)) hit.events.push(eventId);
    } else out.push({ id, events: [eventId] });
  }
  return out.slice(Math.max(0, out.length - max));
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
