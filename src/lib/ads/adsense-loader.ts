/**
 * Zentraler AdSense-Script-Loader – genau EINE Initialisierung pro Seite.
 *
 * Der von Google gelieferte Script-Tag wird nirgends direkt in eine Seite,
 * `index.html` oder eine Komponente kopiert. Stattdessen lädt ausschließlich
 * dieses Modul das Script, und nur wenn Konfiguration und Consent es zulassen.
 * Mehrfachaufrufe teilen dieselbe Zusage; Fehler werden als Zustand gemeldet,
 * nicht geworfen.
 */

import { ADSENSE_CLIENT_ID, adsenseScriptUrl, isAdsenseConfigured } from "./adsense.config";

export type AdsenseLoadState = "idle" | "loading" | "ready" | "blocked" | "error";

const SCRIPT_ID = "ydude-adsense-loader";

let state: AdsenseLoadState = "idle";
let pending: Promise<AdsenseLoadState> | null = null;

export function adsenseLoadState(): AdsenseLoadState {
  return state;
}

/** Nur für Tests: Loader-Zustand zurücksetzen. */
export function resetAdsenseLoaderForTests(): void {
  state = "idle";
  pending = null;
}

/**
 * Lädt das AdSense-Script einmalig.
 *
 * @param consentAllowed Ergebnis des Consent-Gates. Ohne Freigabe wird nichts
 *   geladen und der Zustand ist `blocked` – ohne Netzwerkkontakt zu Google.
 */
export function loadAdsense(consentAllowed: boolean): Promise<AdsenseLoadState> {
  if (typeof document === "undefined") return Promise.resolve("blocked");
  if (!consentAllowed || !isAdsenseConfigured() || !ADSENSE_CLIENT_ID) {
    state = "blocked";
    return Promise.resolve(state);
  }
  if (state === "ready" || state === "error") return Promise.resolve(state);
  if (pending) return pending;

  state = "loading";
  pending = new Promise<AdsenseLoadState>((resolve) => {
    // Doppelte Initialisierung ausschließen: ein bereits vorhandener Tag
    // (etwa nach einer Navigation) wird wiederverwendet.
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.id = SCRIPT_ID;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = adsenseScriptUrl(ADSENSE_CLIENT_ID);
    }
    script.addEventListener("load", () => {
      state = "ready";
      resolve(state);
    });
    script.addEventListener("error", () => {
      // Werbeblocker oder Netzfehler: saubere Fehlermeldung, keine Ausnahme.
      state = "error";
      resolve(state);
    });
    if (!existing) document.head.appendChild(script);
  });
  return pending;
}
