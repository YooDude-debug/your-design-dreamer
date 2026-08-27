/**
 * Quellenregister des Werbekernels (serverseitig).
 *
 * Einzige Stelle, an der Werbequellen angeschlossen werden. Der Kernel fragt sie
 * in Prioritätsreihenfolge (`AD_SOURCE_PRIORITY`); jede Quelle prüft selbst, ob
 * sie einsatzbereit ist.
 *
 * Stand heute:
 * - `internal`         `ad_campaigns` existiert, ist aber noch nicht an das
 *                      Serving angebunden → Quelle noch nicht registriert.
 * - `market_promotion` läuft über den eigenen Market-Pfad → hier noch nicht
 *                      registriert.
 * - `adsense`          registriert, aber bewusst inaktiv (keine Scharfschaltung,
 *                      keine serverseitige CMP-Entscheidung).
 * - `demo`             nur Admin + Werbe-Testmodus (bestehende Regel).
 */

import { DEFAULT_ADS_CONSENT } from "./adsense-consent";
import { createAdsenseProvider } from "./adsense-provider";
import { createAdsensePreviewProvider } from "./adsense-preview-provider";
import type { AdProvider } from "./provider.shared";

/**
 * Serverseitig ist keine Consent-Entscheidung bekannt: der Zustand kommt aus
 * dem Browser (CMP). Der Server plant deshalb keine AdSense-Plätze, solange es
 * keine CMP gibt – die Quelle bleibt registriert und wird nur nicht verfügbar.
 */
export function adProviders(options: { demoAllowed?: boolean } = {}): AdProvider[] {
  return [
    createAdsenseProvider(DEFAULT_ADS_CONSENT),
    // Rein visueller Entwicklungs-Platzhalter: gleiche Freigabe wie der
    // Demobestand (Admin + Werbe-Testmodus), kein Google-Kontakt.
    createAdsensePreviewProvider(Boolean(options.demoAllowed)),
  ];
}
