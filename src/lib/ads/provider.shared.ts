/**
 * Adaptervertrag für Werbequellen (browsersicher, ohne Netzwerkzugriff).
 *
 * Der Y-Dude Werbekernel bleibt die einzige Entscheidungsschicht: er bestimmt
 * WO Werbung erscheint (Abstände, Caps, Werbepause, Master-Schalter) und WELCHE
 * Quelle einen Platz füllt. Eine Werbequelle liefert nur Bestand für einen
 * angefragten Platz – sie entscheidet nie über Platzierung oder Ranking.
 *
 * Neue Partner werden ausschließlich hier angeschlossen, niemals in einzelnen
 * Seiten oder Komponenten.
 */

import type { AdKind, AdPlanSlot, AdSource } from "../ad-catalog.shared";

export type { AdSource };

/** Anfrage des Kernels an eine Werbequelle. */
export type AdSlotRequest = {
  /** Gewünschte Werbeart. */
  kind: AdKind;
  /** Nullbasierter Index des Beitrags, NACH dem der Platz liegt. */
  afterIndex: number;
  /** Themen-Slugs des Nutzers (bereits gefiltert durch die Werbeeinstellung). */
  interests: string[];
  /** Region des Nutzers ("" = unbekannt). */
  region: string;
  /** Bereits ausgespielte Werbe-IDs dieser Sitzung. */
  seen: string[];
};

/**
 * Eine Werbequelle. `fill` gibt `null` zurück, wenn die Quelle für diesen Platz
 * keinen Bestand hat – der Kernel fragt dann die nächste Quelle.
 */
export type AdProvider = {
  source: AdSource;
  /** Menschlich lesbare Bezeichnung (Diagnose, Admin-Cockpit). */
  label: string;
  /**
   * Ist die Quelle in dieser Umgebung überhaupt einsatzbereit?
   * Falsch = die Quelle wird gar nicht erst gefragt (z. B. AdSense ohne
   * Freigabe, Consent oder Publisher-ID).
   */
  available: () => boolean | Promise<boolean>;
  fill: (request: AdSlotRequest) => AdPlanSlot | null | Promise<AdPlanSlot | null>;
};

/** Reihenfolge der Quellen: die erste passende Quelle füllt den Platz. */
export const AD_SOURCE_PRIORITY: AdSource[] = [
  "internal",
  "market_promotion",
  "adsense",
  "demo",
];

/** Priorität einer Quelle (kleiner = früher gefragt). */
export function adSourceRank(source: AdSource): number {
  const i = AD_SOURCE_PRIORITY.indexOf(source);
  return i < 0 ? AD_SOURCE_PRIORITY.length : i;
}

/**
 * Kernel-Auswahl: fragt die verfügbaren Quellen in Prioritätsreihenfolge, bis
 * eine Quelle den Platz füllt. Einzige Stelle, an der Quellen konkurrieren.
 */
export async function fillSlot(
  providers: AdProvider[],
  request: AdSlotRequest,
): Promise<AdPlanSlot | null> {
  const ordered = [...providers].sort((a, b) => adSourceRank(a.source) - adSourceRank(b.source));
  for (const provider of ordered) {
    if (!(await provider.available())) continue;
    const slot = await provider.fill(request);
    if (slot) return { ...slot, source: provider.source };
  }
  return null;
}
