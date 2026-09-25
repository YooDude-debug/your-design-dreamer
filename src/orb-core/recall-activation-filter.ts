/**
 * ORB Core – B3: Recall-Aktivierung nur für model-visible Memories.
 *
 * Liefert ausschliesslich die IDs, deren Recall-Aktivierung (activation +1,
 * last_accessed_at, importance-Aktualisierung) in diesem Zug entfällt, weil
 * P2 V2 sie aus der finalen Modell-Liste entfernt hat. Nichts wird neu
 * gesucht, gewählt, sortiert oder nachgefüllt; die Aktivierung selbst bleibt
 * für alle übrigen Einträge unverändert.
 *
 * Nur DIRECT_ANSWER ist beweisbar an die finale P2-V2-Liste gebunden (nur dort
 * entfernt P2 V2). Alle anderen Modi: leere Menge → Verhalten unverändert.
 */
export function recallActivationExclusions(
  mode: string,
  reliableIds: string[],
  visibleIds: (string | null)[],
): Set<string> {
  if (mode !== "DIRECT_ANSWER") return new Set();
  const visible = new Set(visibleIds.filter((id): id is string => id !== null));
  return new Set(reliableIds.filter((id) => !visible.has(id)));
}
