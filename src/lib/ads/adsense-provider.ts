/**
 * AdSense als Werbequelle des Y-Dude Werbekernels.
 *
 * AdSense rendert seine Anzeigen selbst (iFrame) und liefert dem Kernel keine
 * Creative-Daten. Die Quelle liefert deshalb nur einen fremdgerenderten
 * Werbeplatz; die Auswahl der Anzeige übernimmt Google, die Platzierung bleibt
 * beim Kernel.
 *
 * Der Platz entsteht nur, wenn ALLE Bedingungen erfüllt sind:
 *   1. Publisher-ID konfiguriert und formal gültig,
 *   2. AdSense ausdrücklich scharfgeschaltet (`VITE_ADSENSE_ENABLED=true`),
 *   3. Consent-Gate erlaubt das Laden (echte CMP-Entscheidung).
 * Heute ist Bedingung 2 und 3 bewusst NICHT erfüllt → AdSense liefert nichts.
 */

import type { AdPlanSlot } from "../ad-catalog.shared";
import { isAdsenseConfigured } from "./adsense.config";
import { adsenseLoadAllowed, type AdsConsentState } from "./adsense-consent";
import type { AdProvider, AdSlotRequest } from "./provider.shared";

/** Ein fremdgerenderter Platz: die adId benennt die AdSense-Anzeigenfläche. */
export const ADSENSE_FEED_UNIT = "adsense-feed";

export function adsenseSlotFor(request: AdSlotRequest): AdPlanSlot {
  return {
    afterIndex: request.afterIndex,
    // AdSense-Flächen im Feed sind Displayflächen, keine Videowerbung.
    kind: "image",
    adId: ADSENSE_FEED_UNIT,
    source: "adsense",
  };
}

/** Ist die AdSense-Quelle in dieser Umgebung einsatzbereit? */
export function adsenseAvailable(consent: AdsConsentState): boolean {
  return isAdsenseConfigured() && adsenseLoadAllowed(consent);
}

/**
 * Darf serverseitig ein AdSense-Platz VORGESEHEN werden?
 *
 * Bewusst ohne Consent-Prüfung: der Server kennt die CMP-Entscheidung nicht und
 * darf sie nicht erfinden. Er sagt nur „für diesen Platztyp ist AdSense
 * grundsätzlich vorgesehen“. Ob tatsächlich ein Anzeigen-Script geladen und ein
 * Google-Request gestellt wird, entscheidet ausschließlich das bestehende
 * Browser-Gate (`AdSenseSlot` → `adsenseLoadAllowed` → `adsense-loader`).
 */
export function adsensePlannable(): boolean {
  return isAdsenseConfigured();
}

export function createAdsenseProvider(consent: AdsConsentState): AdProvider {
  return {
    source: "adsense",
    label: "Google AdSense",
    available: () => adsenseAvailable(consent),
    fill: (request) => (adsenseAvailable(consent) ? adsenseSlotFor(request) : null),
  };
}

/**
 * Serverseitige Planungsvariante derselben Quelle: reserviert den Platz, ohne
 * eine Einwilligung anzunehmen. Kein Google-Kontakt, keine Impression.
 */
export function createAdsenseServerProvider(): AdProvider {
  return {
    source: "adsense",
    label: "Google AdSense",
    available: () => adsensePlannable(),
    fill: (request) => (adsensePlannable() ? adsenseSlotFor(request) : null),
  };
}

