/**
 * Abbildung des echten TCF-Zustands der Google-CMP auf den internen
 * Consent-Zustand. Kernaussage: ohne echte Entscheidung bleibt die Sperre.
 */

import { describe, expect, it } from "vitest";
import { adsenseLoadAllowed, adsensePersonalizationAllowed } from "../src/lib/ads/adsense-consent";
import { GOOGLE_TCF_VENDOR_ID, mapTcDataToConsent, type TcData } from "../src/lib/ads/tcf-consent";

const tc = (over: Partial<TcData> = {}): TcData => ({
  eventStatus: "useractioncomplete",
  gdprApplies: true,
  tcString: "CPabc",
  purpose: { consents: { "1": true, "3": true, "4": true } },
  vendor: { consents: { [String(GOOGLE_TCF_VENDOR_ID)]: true } },
  ...over,
});

describe("TCF-Consent der Google-CMP", () => {
  it("ohne Daten: keine Entscheidung, Laden gesperrt", () => {
    const state = mapTcDataToConsent(undefined);
    expect(state.decision).toBe("unknown");
    expect(state.fromCmp).toBe(false);
    expect(adsenseLoadAllowed(state)).toBe(false);
  });

  it("CMP-Oberfläche noch offen: gesperrt", () => {
    const state = mapTcDataToConsent(tc({ eventStatus: "cmpuishown" }));
    expect(adsenseLoadAllowed(state)).toBe(false);
  });

  it("volle Einwilligung: personalisiert erlaubt", () => {
    const state = mapTcDataToConsent(tc());
    expect(state).toEqual({ decision: "personalized", fromCmp: true, minor: false });
    expect(adsensePersonalizationAllowed(state)).toBe(true);
  });

  it("ohne Zwecke 3/4: nur nicht personalisiert", () => {
    const state = mapTcDataToConsent(tc({ purpose: { consents: { "1": true } } }));
    expect(state.decision).toBe("non_personalized");
    expect(adsenseLoadAllowed(state)).toBe(true);
    expect(adsensePersonalizationAllowed(state)).toBe(false);
  });

  it("ohne Zweck 1 oder ohne Google-Vendor: abgelehnt", () => {
    expect(mapTcDataToConsent(tc({ purpose: { consents: { "3": true } } })).decision).toBe(
      "denied",
    );
    expect(mapTcDataToConsent(tc({ vendor: { consents: {} } })).decision).toBe("denied");
    expect(adsenseLoadAllowed(mapTcDataToConsent(tc({ vendor: { consents: {} } })))).toBe(false);
  });

  it("GDPR nicht anwendbar: Auslieferung erlaubt", () => {
    const state = mapTcDataToConsent(tc({ gdprApplies: false, tcString: undefined }));
    expect(adsenseLoadAllowed(state)).toBe(true);
  });

  it("fehlender Consent-String bei GDPR: gesperrt", () => {
    expect(adsenseLoadAllowed(mapTcDataToConsent(tc({ tcString: "" })))).toBe(false);
  });
});
