/**
 * Consent-Zustand für Google AdSense.
 *
 * Y-Dude hat heute KEINE zertifizierte Consent-Plattform (CMP mit TCF v2.2),
 * wie sie Google für Besucher aus EU/EWR/UK/CH verlangt. Deshalb ist der
 * Zustand bewusst „unknown“ und die Auslieferung gesperrt – es wird keine
 * Einwilligung vorgetäuscht und kein Consent-Signal erfunden.
 *
 * Sobald eine CMP existiert, schreibt sie ihren Zustand über
 * `setAdsConsentState()` (oder liefert ihn beim Start über
 * `readStoredAdsConsent()`) – der Rest der Werbearchitektur bleibt unverändert.
 */

export type AdsConsentDecision = "unknown" | "denied" | "non_personalized" | "personalized";

export type AdsConsentState = {
  decision: AdsConsentDecision;
  /** Wurde die Entscheidung von einer echten CMP gesetzt? */
  fromCmp: boolean;
  /** Konto als minderjährig markiert → niemals personalisierte Werbung. */
  minor: boolean;
};

export const ADS_CONSENT_STORAGE_KEY = "ydude.ads.consent";

/** Standard: nichts entschieden, keine CMP vorhanden. */
export const DEFAULT_ADS_CONSENT: AdsConsentState = {
  decision: "unknown",
  fromCmp: false,
  minor: false,
};

/**
 * Darf AdSense überhaupt geladen werden? Nur mit einer CMP-Entscheidung, die
 * mindestens nicht personalisierte Werbung erlaubt.
 */
export function adsenseLoadAllowed(state: AdsConsentState): boolean {
  if (!state.fromCmp) return false;
  return state.decision === "personalized" || state.decision === "non_personalized";
}

/** Personalisierte Werbung erlaubt? Minderjährige nie. */
export function adsensePersonalizationAllowed(state: AdsConsentState): boolean {
  if (!adsenseLoadAllowed(state)) return false;
  if (state.minor) return false;
  return state.decision === "personalized";
}

/** Google-Parameter: 1 = ausschließlich nicht personalisierte Werbung. */
export function adsenseNonPersonalizedFlag(state: AdsConsentState): 0 | 1 {
  return adsensePersonalizationAllowed(state) ? 0 : 1;
}

/** Gespeicherte CMP-Entscheidung lesen (kein Fallback auf „erlaubt“). */
export function readStoredAdsConsent(): AdsConsentState {
  if (typeof window === "undefined") return DEFAULT_ADS_CONSENT;
  try {
    const raw = window.localStorage.getItem(ADS_CONSENT_STORAGE_KEY);
    if (!raw) return DEFAULT_ADS_CONSENT;
    const parsed = JSON.parse(raw) as Partial<AdsConsentState> | null;
    const decision = parsed?.decision;
    if (
      decision !== "denied" &&
      decision !== "non_personalized" &&
      decision !== "personalized" &&
      decision !== "unknown"
    ) {
      return DEFAULT_ADS_CONSENT;
    }
    return {
      decision,
      fromCmp: parsed?.fromCmp === true,
      minor: parsed?.minor === true,
    };
  } catch {
    return DEFAULT_ADS_CONSENT;
  }
}

/** Entscheidung einer CMP übernehmen (Widerruf = `denied`). */
export function setAdsConsentState(state: AdsConsentState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADS_CONSENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Speicher nicht verfügbar: Entscheidung gilt dann nur für diese Seite. */
  }
}
