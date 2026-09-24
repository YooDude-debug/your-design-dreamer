/**
 * ORB Core – P5-A: Nachverfolgung „abgerufen → tatsächlich an das Modell“.
 *
 * Reine Diagnose. Liest nur bereits berechnete Listen, schreibt nichts,
 * verändert weder Aktivierung, Wichtigkeit, Sicherheit, Level noch Auswahl.
 * Enthält ausschliesslich technische IDs und Zahlen – keine Inhalte.
 */

export type MemoryUsageTrace = {
  recalledMemoryCount: number;
  modelVisibleMemoryCount: number;
  modelVisibleMemoryIds: string[];
  recalledButNotVisibleMemoryIds: string[];
};

/**
 * @param recalledIds IDs aus `recalled` (Reihenfolge wie dort)
 * @param visible     endgültige Modell-Liste, je Objekt mit ID
 * @param modelCalled ob die Sprachschicht die Liste tatsächlich erhalten hat
 */
export function traceMemoryUsage(
  recalledIds: string[],
  visible: { id: string | null }[],
  modelCalled: boolean,
): MemoryUsageTrace {
  const visibleIds = modelCalled
    ? visible.map((v) => v.id).filter((id): id is string => id !== null)
    : [];
  const visibleSet = new Set(visibleIds);
  return {
    recalledMemoryCount: recalledIds.length,
    modelVisibleMemoryCount: visibleIds.length,
    modelVisibleMemoryIds: visibleIds,
    recalledButNotVisibleMemoryIds: recalledIds.filter((id) => !visibleSet.has(id)),
  };
}

/**
 * P5-C: Turn → tatsächlich model-visible Memory-IDs.
 *
 * Gespeichert wird ausschließlich im bestehenden `orb_messages.state_snapshot`
 * der ORB-Zeile (Turn-ID = `orb_messages.id`). Nur IDs, keine Inhalte.
 * Keine Bestätigungs-, Korrektur- oder Zustandslogik.
 */
export const TURN_VISIBLE_IDS_KEY = "model_visible_memory_ids" as const;

/**
 * IDs, die dem ORB-Turn zugeordnet werden dürfen. Bei Unsicherheit
 * (kein Modellaufruf, Fehler, Fallback, fehlende Messung) → [].
 */
export function turnVisibleMemoryIds(
  trace: MemoryUsageTrace | null | undefined,
  answer: { status?: string; fallbackUsed?: boolean } | null | undefined,
): string[] {
  if (!trace || !answer) return [];
  if (answer.status !== "ok" || answer.fallbackUsed === true) return [];
  return [...new Set(trace.modelVisibleMemoryIds)];
}

export type OrbTurnMemoryRef = {
  turnId: string;
  createdAt: string;
  /** null = Turn ohne Tracking (alt oder unbekannt) – nicht als leer deuten. */
  modelVisibleMemoryIds: string[] | null;
};

type MessageRow = {
  id: string;
  role: string;
  created_at: string;
  state_snapshot?: unknown;
};

export function readTurnMemoryRef(row: MessageRow): OrbTurnMemoryRef | null {
  if (row.role !== "orb") return null;
  const snap =
    row.state_snapshot && typeof row.state_snapshot === "object"
      ? (row.state_snapshot as Record<string, unknown>)
      : {};
  const raw = snap[TURN_VISIBLE_IDS_KEY];
  const ids =
    Array.isArray(raw) && raw.every((x) => typeof x === "string") ? (raw as string[]) : null;
  return { turnId: row.id, createdAt: row.created_at, modelVisibleMemoryIds: ids };
}

/**
 * Direkt vorheriger ORB-Turn vor einem Zeitpunkt, bestimmt über die stabile
 * Zeilen-ID und die serverseitige Reihenfolge (created_at, dann id).
 * Liefert null, wenn kein ORB-Turn existiert.
 */
export function findPreviousOrbTurn(
  rows: MessageRow[],
  before?: string,
): OrbTurnMemoryRef | null {
  const orb = rows
    .filter((r) => r.role === "orb" && (before == null || r.created_at < before))
    .sort((a, b) =>
      a.created_at === b.created_at ? (a.id < b.id ? 1 : -1) : a.created_at < b.created_at ? 1 : -1,
    );
  return orb.length ? readTurnMemoryRef(orb[0]) : null;
}
