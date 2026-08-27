/**
 * Entwicklungs-Platzhalter für AdSense-Plätze (rein visuell).
 *
 * Zweck: im Feed sichtbar machen, WO der Werbekernel später einen echten
 * AdSense-Platz planen würde – ohne AdSense zu aktivieren.
 *
 * Diese Quelle:
 *   - nimmt NIE Kontakt zu Google auf,
 *   - lädt kein `adsbygoogle.js`,
 *   - erzeugt keine AdSense-Impressionen, Klicks oder Metriken,
 *   - ist ausschließlich verfügbar, wenn der Demo-/Testbestand freigegeben ist
 *     (Admin + aktiver Werbe-Testmodus, gleiche Regel wie `demo`).
 *
 * Die Platzierung selbst kommt unverändert vom Kernel (`ad-plan.server.ts`):
 * Abstände, Frequency Caps, Werbepause und Master-Schalter bleiben gültig.
 */

import type { AdPlanSlot } from "../ad-catalog.shared";
import type { AdProvider, AdSlotRequest } from "./provider.shared";

/** Kennung des Platzhalters – bewusst kein echter AdSense-Anzeigenblock. */
export const ADSENSE_PREVIEW_UNIT = "adsense-dev-feed";

export function adsensePreviewSlotFor(request: AdSlotRequest): AdPlanSlot {
  return {
    afterIndex: request.afterIndex,
    // AdSense-Feedflächen sind Displayflächen, keine Videowerbung.
    kind: "image",
    adId: ADSENSE_PREVIEW_UNIT,
    source: "adsense_preview",
  };
}

/**
 * @param allowed Demo-/Testfreigabe (Admin + Werbe-Testmodus).
 *
 * Der Platzhalter belegt nur jeden zweiten Displayplatz, damit der bestehende
 * Demobestand im Testmodus weiterhin sichtbar bleibt.
 */
export function createAdsensePreviewProvider(allowed: boolean): AdProvider {
  let displaySlots = 0;
  return {
    source: "adsense_preview",
    label: "AdSense – Development Slot",
    available: () => allowed,
    fill: (request) => {
      if (!allowed || request.kind !== "image") return null;
      displaySlots += 1;
      return displaySlots % 2 === 1 ? adsensePreviewSlotFor(request) : null;
    },
  };
}
