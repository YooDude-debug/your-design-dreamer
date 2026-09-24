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
