/**
 * ORB Core – Kandidatenschema der Kontextanalyse (rein, deterministisch).
 *
 * Die KI liefert Vorschläge, keine Wahrheit. Diese Datei ist die Schleuse: sie
 * prüft, begrenzt und normalisiert jedes Feld, bevor irgendetwas weiterläuft.
 *
 * Bewusst NICHT hier: Wichtigkeit, Speicherschwelle (0.35), Relevanzformel,
 * Verfall und Reaktivierung – diese bestehenden Formeln bleiben unberührt.
 */

export type OrbTemporalScope = "persistent" | "long_term" | "temporary" | "one_time";

export const TEMPORAL_SCOPES: OrbTemporalScope[] = [
  "persistent",
  "long_term",
  "temporary",
  "one_time",
];

/** Erlaubte Absichten eines Kandidaten – mehr kann die Analyse nicht verlangen. */
export type OrbCandidateAction = "create_or_update" | "reinforce" | "forget";

export const CANDIDATE_ACTIONS: OrbCandidateAction[] = ["create_or_update", "reinforce", "forget"];

/** Erlaubte Kategorien; alles andere wird auf „other“ abgebildet. */
export const CANDIDATE_CATEGORIES = [
  "identity",
  "address_preference",
  "preference",
  "interest",
  "project",
  "goal",
  "habit",
  "relationship",
  "decision",
  "task",
  "fact",
  "other",
] as const;

export type OrbCandidateCategory = (typeof CANDIDATE_CATEGORIES)[number];

/** Harte Obergrenzen (Kosten-, Missbrauchs- und Datenminimierungsschutz). */
export const CANDIDATE_MAX_COUNT = 8;
export const CANDIDATE_KEY_MAX_CHARS = 60;
export const CANDIDATE_VALUE_MAX_CHARS = 200;
export const CANDIDATE_REFERENCE_MAX_CHARS = 200;

export type MemoryCandidate = {
  key: string;
  value: string;
  category: OrbCandidateCategory;
  relevance: number;
  longTermValue: number;
  confidence: number;
  temporalScope: OrbTemporalScope;
  decayRate: number;
  source: "conversation";
  sourceReference: string;
  relatedNodeIds: string[];
  action: OrbCandidateAction;
};

/** Vorgabe-Verfallsraten je Zeitbezug. Persistent verliert kein Gewicht. */
export const SCOPE_DECAY: Record<OrbTemporalScope, number> = {
  persistent: 0,
  long_term: 0.01,
  temporary: 0.12,
  one_time: 0.3,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Text säubern: Steuerzeichen und Zeilenumbrüche entfernen, kürzen. Damit kann
 * ein Kandidat keine zusätzlichen Prompt-Zeilen oder Anweisungen einschmuggeln.
 */
function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function clamp01(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function scopeOf(value: unknown): OrbTemporalScope {
  return TEMPORAL_SCOPES.includes(value as OrbTemporalScope)
    ? (value as OrbTemporalScope)
    : "long_term";
}

function categoryOf(value: unknown): OrbCandidateCategory {
  return (CANDIDATE_CATEGORIES as readonly string[]).includes(value as string)
    ? (value as OrbCandidateCategory)
    : "other";
}

function actionOf(value: unknown): OrbCandidateAction {
  return CANDIDATE_ACTIONS.includes(value as OrbCandidateAction)
    ? (value as OrbCandidateAction)
    : "create_or_update";
}

/** Nur eigene Knoten-Kennungen im gültigen Format – nie fremde Verweise. */
function relatedIdsOf(value: unknown, allowedIds: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string" || !UUID_RE.test(raw)) continue;
    if (!allowedIds.has(raw)) continue;
    if (!out.includes(raw)) out.push(raw);
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Rohantwort der Analyse → geprüfte Kandidaten. Unbekannte Felder fallen weg,
 * Werte werden begrenzt, fehlerhafte Einträge werden verworfen (nie geraten).
 */
export function sanitizeCandidates(raw: unknown, allowedNodeIds: string[] = []): MemoryCandidate[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { candidates?: unknown[] } | null)?.candidates)
      ? (raw as { candidates: unknown[] }).candidates
      : [];
  const allowed = new Set(allowedNodeIds);
  const seen = new Set<string>();
  const out: MemoryCandidate[] = [];

  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const key = cleanText(e["key"], CANDIDATE_KEY_MAX_CHARS).toLowerCase();
    const value = cleanText(e["value"], CANDIDATE_VALUE_MAX_CHARS);
    if (key.length < 2 || value.length < 2) continue;
    if (seen.has(key)) continue;
    seen.add(key);

    const temporalScope = scopeOf(e["temporal_scope"] ?? e["temporalScope"]);
    const rawDecay = e["decay_rate"] ?? e["decayRate"];
    const decayRate =
      typeof rawDecay === "number" && Number.isFinite(rawDecay)
        ? clamp01(rawDecay, SCOPE_DECAY[temporalScope])
        : SCOPE_DECAY[temporalScope];

    out.push({
      key,
      value,
      category: categoryOf(e["category"]),
      relevance: clamp01(e["relevance"]),
      longTermValue: clamp01(e["long_term_value"] ?? e["longTermValue"]),
      confidence: clamp01(e["confidence"]),
      temporalScope,
      decayRate,
      // Quelle ist immer das Gespräch: die Analyse darf keine Herkunft behaupten.
      source: "conversation",
      sourceReference: cleanText(
        e["source_reference"] ?? e["sourceReference"],
        CANDIDATE_REFERENCE_MAX_CHARS,
      ),
      relatedNodeIds: relatedIdsOf(e["related_nodes"] ?? e["relatedNodes"], allowed),
      action: actionOf(e["action"]),
    });
    if (out.length >= CANDIDATE_MAX_COUNT) break;
  }
  return out;
}
