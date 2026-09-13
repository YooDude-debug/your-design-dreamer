/**
 * Anschluss an die veröffentlichte Google-CMP (Privacy & Messaging) über die
 * IAB-TCF-API (`window.__tcfapi`).
 *
 * Y-Dude baut KEINE eigene Consent-Plattform. Die Einwilligung wird
 * ausschließlich bei Google eingeholt; hier wird der echte TCF-Zustand nur
 * gelesen und auf den bestehenden internen Zustand (`AdsConsentState`)
 * abgebildet. Es wird nie eine Zustimmung erfunden: fehlt die TCF-API oder ist
 * keine Nutzerentscheidung getroffen, bleibt der Zustand „unknown“ und damit
 * die bestehende Sperre aktiv.
 *
 * Geladen wird ausschließlich das CMP-Script von Google (Funding Choices) –
 * nicht das Anzeigen-Script. Das Anzeigen-Script lädt weiterhin nur
 * `adsense-loader.ts`, und erst nach gültiger Entscheidung.
 */

import { ADSENSE_CLIENT_ID, isAdsenseConfigured } from "./adsense.config";
import { DEFAULT_ADS_CONSENT, type AdsConsentState } from "./adsense-consent";

/** Google Advertising Products im TCF-Vendor-Register. */
export const GOOGLE_TCF_VENDOR_ID = 755;

type TcfPurposeMap = Record<string, boolean | undefined>;

export type TcData = {
  tcString?: string;
  gdprApplies?: boolean;
  eventStatus?: string;
  cmpStatus?: string;
  purpose?: { consents?: TcfPurposeMap; legitimateInterests?: TcfPurposeMap };
  vendor?: { consents?: TcfPurposeMap };
};

type TcfApi = (
  command: string,
  version: number,
  callback: (data: TcData | undefined, success: boolean) => void,
  parameter?: unknown,
) => void;

const CMP_SCRIPT_ID = "ydude-google-cmp";

/** Steht eine echte Nutzerentscheidung der CMP fest? */
function decisionSettled(data: TcData): boolean {
  return data.eventStatus === "tcloaded" || data.eventStatus === "useractioncomplete";
}

/**
 * Echten TCF-Zustand auf den internen Zustand abbilden.
 *
 * - keine Entscheidung / CMP-Oberfläche noch offen → `unknown` (Sperre bleibt)
 * - GDPR nicht anwendbar → Auslieferung erlaubt
 * - ohne Zweck 1 oder ohne Google-Vendor-Consent → `denied`
 * - mit Zweck 3 und 4 → personalisiert, sonst nicht personalisiert
 */
export function mapTcDataToConsent(data: TcData | undefined | null): AdsConsentState {
  if (!data || !decisionSettled(data)) return DEFAULT_ADS_CONSENT;
  if (data.gdprApplies === false) {
    return { decision: "personalized", fromCmp: true, minor: false };
  }
  if (data.gdprApplies !== true || typeof data.tcString !== "string" || data.tcString === "") {
    return DEFAULT_ADS_CONSENT;
  }
  const purposes = data.purpose?.consents ?? {};
  const storageAllowed = purposes["1"] === true;
  const googleAllowed = data.vendor?.consents?.[String(GOOGLE_TCF_VENDOR_ID)] === true;
  if (!storageAllowed || !googleAllowed) {
    return { decision: "denied", fromCmp: true, minor: false };
  }
  const personalized = purposes["3"] === true && purposes["4"] === true;
  return {
    decision: personalized ? "personalized" : "non_personalized",
    fromCmp: true,
    minor: false,
  };
}

/** Ist die TCF-API der CMP im Browser erreichbar? */
export function tcfApiAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as { __tcfapi?: unknown }).__tcfapi === "function"
  );
}

function tcfApi(): TcfApi | null {
  if (!tcfApiAvailable()) return null;
  return (window as unknown as { __tcfapi: TcfApi }).__tcfapi;
}

/**
 * CMP-Script von Google einmalig laden (nur bei Scharfschaltung).
 * Ohne Publisher-ID oder ohne Scharfschaltung passiert nichts.
 */
export function loadGoogleCmp(): boolean {
  if (typeof document === "undefined") return false;
  if (!isAdsenseConfigured() || !ADSENSE_CLIENT_ID) return false;
  if (document.getElementById(CMP_SCRIPT_ID)) return true;
  const pub = ADSENSE_CLIENT_ID.replace(/^ca-/, "");
  const script = document.createElement("script");
  script.id = CMP_SCRIPT_ID;
  script.async = true;
  script.src = `https://fundingchoicesmessages.google.com/i/${encodeURIComponent(pub)}?ers=1`;
  document.head.appendChild(script);
  return true;
}

/**
 * Echten CMP-Zustand beobachten. Liefert eine Abmeldefunktion.
 * Solange keine TCF-API erscheint, wird der Zustand nie geändert.
 */
export function subscribeTcfConsent(onChange: (state: AdsConsentState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  let alive = true;
  let listenerId: unknown = null;

  const attach = () => {
    const api = tcfApi();
    if (!api || !alive) return false;
    api("addEventListener", 2, (data, success) => {
      if (!alive || !success || !data) return;
      if (typeof (data as { listenerId?: unknown }).listenerId !== "undefined") {
        listenerId = (data as { listenerId?: unknown }).listenerId;
      }
      onChange(mapTcDataToConsent(data));
    });
    return true;
  };

  if (!attach()) {
    // Die CMP registriert `__tcfapi` asynchron; kurz beobachten, nicht endlos.
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (!alive || attach() || Date.now() - started > 15000) window.clearInterval(timer);
    }, 250);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }

  return () => {
    alive = false;
    const api = tcfApi();
    if (api && listenerId !== null) api("removeEventListener", 2, () => {}, listenerId);
  };
}
