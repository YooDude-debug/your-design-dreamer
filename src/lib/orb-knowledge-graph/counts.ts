/**
 * Anzeige Gesamtzahl vs. visualisiert. Gesamtzahl kommt ausschliesslich aus
 * dem DB-Count; fehlt er, wird nichts geschätzt.
 */
export const TOTAL_NA = "Gesamtzahl nicht verfügbar";

export function countLabel(total: number | null | undefined, visible: number): string {
  if (typeof total !== "number") return `${TOTAL_NA} · ${visible} sichtbar`;
  return `${total} gesamt · ${visible} sichtbar`;
}
