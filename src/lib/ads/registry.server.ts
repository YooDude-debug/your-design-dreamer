/**
 * Quellenregister des Werbekernels (serverseitig).
 *
 * Einzige Stelle, an der Werbequellen angeschlossen werden. Der Kernel fragt sie
 * in Prioritätsreihenfolge (`AD_SOURCE_PRIORITY`); jede Quelle prüft selbst, ob
 * sie einsatzbereit ist.
 *
 * Stand heute:
 * - `internal`         Business-Kampagnen aus `ad_campaigns` sind angebunden;
 *                      die Quelle wird in `buildFeedAdPlan` (ad-plan.server)
 *                      vor diesen Quellen registriert, weil sie den geladenen
 *                      Kampagnenbestand des Betrachters benötigt.
 * - `market_promotion` läuft über den eigenen Market-Pfad → hier noch nicht
 *                      registriert.
 * - `adsense`          als Platz planbar, sobald konfiguriert und scharfgeschaltet;
 *                      die Auslieferung bleibt vollständig am Browser-Consent.
 * - `demo`             nur Admin + Werbe-Testmodus (bestehende Regel).
 */

import { createAdsenseServerProvider } from "./adsense-provider";
import { createAdsensePreviewProvider } from "./adsense-preview-provider";
import type { AdProvider } from "./provider.shared";

/**
 * Serverseitig ist keine Consent-Entscheidung bekannt: der Zustand kommt aus
 * dem Browser (CMP). Der Server plant deshalb nur einen VORGESEHENEN
 * AdSense-Platz (Konfiguration + Scharfschaltung), ohne eine Einwilligung
 * anzunehmen. Ob der Platz tatsächlich AdSense lädt, entscheidet allein das
 * bestehende Browser-Gate (CMP/TCF → `AdSenseSlot` → `adsense-loader`).
 */
export function adProviders(options: { demoAllowed?: boolean } = {}): AdProvider[] {
  return [
    createAdsenseServerProvider(),
    // Rein visueller Entwicklungs-Platzhalter: gleiche Freigabe wie der
    // Demobestand (Admin + Werbe-Testmodus), kein Google-Kontakt.
    createAdsensePreviewProvider(Boolean(options.demoAllowed)),
  ];
}
