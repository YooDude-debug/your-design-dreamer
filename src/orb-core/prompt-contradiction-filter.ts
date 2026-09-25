/**
 * ORB Core – B2: Contradiction-Referenzen auf model-visible Memories begrenzen.
 *
 * Läuft NACH der bestehenden Auswahl, NACH der Antwortart-Entscheidung und
 * NACH P2 V2. Entfernt nur Referenzen, nie hinzufügen, keine Nachrücker, keine
 * neue Erkennung. Die Widerspruchserkennung, Polarität, Schwellen, Themen,
 * Speicherung (`persistContradictions`) und der Zustand bleiben unverändert:
 * gefiltert wird ausschliesslich die Liste, die an den Prompt geht.
 *
 * Nur der Modus DIRECT_ANSWER ist hier beweisbar an die finale P2-V2-Liste
 * gebunden. Alle anderen Modi bleiben unverändert (UNKNOWN).
 */

export type ContradictionRef = { nodeId: string };

/**
 * @param mode           bereits entschiedene Antwortart (wird nicht verändert)
 * @param contradictions bestehende, unveränderte Widerspruchsliste
 * @param visibleIds     finale model-visible Memory-IDs (nach P2 V2)
 */
export function filterContradictionsForPrompt<T extends ContradictionRef>(
  mode: string,
  contradictions: T[],
  visibleIds: (string | null)[],
): T[] {
  if (mode !== "DIRECT_ANSWER") return contradictions;
  const visible = new Set(visibleIds.filter((id): id is string => id !== null));
  return contradictions.filter((c) => visible.has(c.nodeId));
}
