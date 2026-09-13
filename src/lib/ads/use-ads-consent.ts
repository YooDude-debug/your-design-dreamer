/**
 * Einwilligungszustand für Werbung im Browser.
 *
 * Quelle ist ausschließlich die veröffentlichte Google-CMP (TCF-API). Ist keine
 * CMP erreichbar oder liegt keine Entscheidung vor, bleibt der zuvor
 * gespeicherte Zustand bzw. „unknown“ – also die bestehende Sperre.
 */

import { useEffect, useState } from "react";
import {
  DEFAULT_ADS_CONSENT,
  readStoredAdsConsent,
  setAdsConsentState,
  type AdsConsentState,
} from "./adsense-consent";
import { loadGoogleCmp, subscribeTcfConsent } from "./tcf-consent";

export function useAdsConsent(): AdsConsentState {
  // Start bewusst ohne Entscheidung (kein SSR-Opt-in).
  const [consent, setConsent] = useState<AdsConsentState>(DEFAULT_ADS_CONSENT);

  useEffect(() => {
    setConsent(readStoredAdsConsent());
    loadGoogleCmp();
    return subscribeTcfConsent((next) => {
      setConsent(next);
      // Nur echte CMP-Entscheidungen werden gemerkt.
      if (next.fromCmp) setAdsConsentState(next);
    });
  }, []);

  return consent;
}
