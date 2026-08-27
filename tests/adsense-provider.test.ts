/**
 * AdSense-Integration: Adaptervertrag, Consent-Gate und zentraler Loader.
 *
 * Kernaussage dieser Tests: AdSense ist technisch angeschlossen, liefert aber
 * ohne Scharfschaltung und ohne echte CMP-Entscheidung KEINEN Werbeplatz und
 * laedt kein Google-Script.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADSENSE_PREVIEW_UNIT,
  createAdsensePreviewProvider,
} from "@/lib/ads/adsense-preview-provider";
import {
  DEFAULT_ADS_CONSENT,
  adsenseLoadAllowed,
  adsenseNonPersonalizedFlag,
  adsensePersonalizationAllowed,
  readStoredAdsConsent,
  type AdsConsentState,
} from "@/lib/ads/adsense-consent";
import {
  ADSENSE_CLIENT_ID,
  ADSENSE_ENABLED,
  adsTxtLine,
  isAdsenseConfigured,
  isValidAdsenseClientId,
} from "@/lib/ads/adsense.config";
import { adsenseAvailable, createAdsenseProvider } from "@/lib/ads/adsense-provider";
import {
  AD_SOURCE_PRIORITY,
  adSourceRank,
  fillSlot,
  type AdProvider,
  type AdSlotRequest,
} from "@/lib/ads/provider.shared";
import {
  adsenseLoadState,
  loadAdsense,
  resetAdsenseLoaderForTests,
} from "@/lib/ads/adsense-loader";
import { demoInventoryAllowed } from "@/lib/ads/demo-inventory";

const request: AdSlotRequest = {
  kind: "image",
  afterIndex: 5,
  interests: ["travel"],
  region: "DE",
  seen: [],
};

const consent = (over: Partial<AdsConsentState> = {}): AdsConsentState => ({
  ...DEFAULT_ADS_CONSENT,
  ...over,
});

describe("Publisher-ID / Konfiguration", () => {
  it("fuehrt die Publisher-ID als oeffentliche Build-Konfiguration", () => {
    expect(ADSENSE_CLIENT_ID).toBe("ca-pub-9048855502038895");
    expect(isValidAdsenseClientId(ADSENSE_CLIENT_ID)).toBe(true);
  });

  it("bleibt bewusst nicht scharfgeschaltet", () => {
    expect(ADSENSE_ENABLED).toBe(false);
    expect(isAdsenseConfigured()).toBe(false);
  });

  it("weist ungueltige Publisher-IDs ab", () => {
    expect(isValidAdsenseClientId(undefined)).toBe(false);
    expect(isValidAdsenseClientId("pub-9048855502038895")).toBe(false);
  });

  it("bildet die von Google vorgegebene ads.txt-Zeile", () => {
    expect(adsTxtLine("ca-pub-9048855502038895")).toBe(
      "google.com, pub-9048855502038895, DIRECT, f08c47fec0942fa0",
    );
  });
});

describe("Consent-Gate", () => {
  it("erlaubt ohne CMP-Entscheidung nichts", () => {
    expect(adsenseLoadAllowed(DEFAULT_ADS_CONSENT)).toBe(false);
    expect(adsensePersonalizationAllowed(DEFAULT_ADS_CONSENT)).toBe(false);
  });

  it("wertet eine Entscheidung ohne CMP-Herkunft nicht als Einwilligung", () => {
    expect(adsenseLoadAllowed(consent({ decision: "personalized", fromCmp: false }))).toBe(false);
  });

  it("erlaubt nach echter Einwilligung Laden und Personalisierung", () => {
    const state = consent({ decision: "personalized", fromCmp: true });
    expect(adsenseLoadAllowed(state)).toBe(true);
    expect(adsensePersonalizationAllowed(state)).toBe(true);
    expect(adsenseNonPersonalizedFlag(state)).toBe(0);
  });

  it("laedt bei Ablehnung nicht und personalisiert bei Minderjaehrigen nie", () => {
    expect(adsenseLoadAllowed(consent({ decision: "denied", fromCmp: true }))).toBe(false);
    const minor = consent({ decision: "personalized", fromCmp: true, minor: true });
    expect(adsenseLoadAllowed(minor)).toBe(true);
    expect(adsensePersonalizationAllowed(minor)).toBe(false);
    expect(adsenseNonPersonalizedFlag(minor)).toBe(1);
  });

  it("nur nicht personalisierte Werbung setzt das Google-Flag", () => {
    const state = consent({ decision: "non_personalized", fromCmp: true });
    expect(adsenseLoadAllowed(state)).toBe(true);
    expect(adsenseNonPersonalizedFlag(state)).toBe(1);
  });

  it("faellt bei fehlendem oder kaputtem Speicher auf 'keine Einwilligung' zurueck", () => {
    expect(readStoredAdsConsent()).toEqual(DEFAULT_ADS_CONSENT);
  });
});

describe("Adaptervertrag", () => {
  it("kennt die Quellen in fester Prioritaet", () => {
    expect(AD_SOURCE_PRIORITY).toEqual(["internal", "market_promotion", "adsense", "demo"]);
    expect(adSourceRank("internal")).toBeLessThan(adSourceRank("adsense"));
    expect(adSourceRank("adsense")).toBeLessThan(adSourceRank("demo"));
  });

  it("kennzeichnet jeden gefuellten Platz mit seiner Quelle", async () => {
    const provider: AdProvider = {
      source: "internal",
      label: "Y-Dude Kampagnen",
      available: () => true,
      fill: (req) => ({ afterIndex: req.afterIndex, kind: req.kind, adId: "camp-1" }),
    };
    const slot = await fillSlot([provider], request);
    expect(slot).toEqual({ afterIndex: 5, kind: "image", adId: "camp-1", source: "internal" });
  });

  it("fragt Quellen in Prioritaetsreihenfolge, nicht in Uebergabereihenfolge", async () => {
    const asked: string[] = [];
    const make = (source: AdProvider["source"], hit: boolean): AdProvider => ({
      source,
      label: source,
      available: () => {
        asked.push(source);
        return true;
      },
      fill: (req) => (hit ? { afterIndex: req.afterIndex, kind: req.kind, adId: source } : null),
    });
    const slot = await fillSlot([make("adsense", true), make("internal", true)], request);
    expect(asked[0]).toBe("internal");
    expect(slot?.source).toBe("internal");
  });

  it("ueberspringt nicht verfuegbare und leere Quellen", async () => {
    const unavailable: AdProvider = {
      source: "internal",
      label: "internal",
      available: () => false,
      fill: () => ({ afterIndex: 0, kind: "image", adId: "nope" }),
    };
    const empty: AdProvider = {
      source: "market_promotion",
      label: "market",
      available: () => true,
      fill: () => null,
    };
    expect(await fillSlot([unavailable, empty], request)).toBeNull();
  });
});

describe("AdSense-Quelle", () => {
  it("ist ohne Scharfschaltung und Consent nicht verfuegbar", () => {
    expect(adsenseAvailable(DEFAULT_ADS_CONSENT)).toBe(false);
    expect(adsenseAvailable(consent({ decision: "personalized", fromCmp: true }))).toBe(false);
  });

  it("liefert im aktuellen Zustand keinen Werbeplatz", async () => {
    const provider = createAdsenseProvider(consent({ decision: "personalized", fromCmp: true }));
    expect(provider.source).toBe("adsense");
    expect(await fillSlot([provider], request)).toBeNull();
  });
});

describe("Zentraler Loader", () => {
  // Minimales DOM: der Loader darf ohne Freigabe gar nicht bis hierher kommen.
  const scripts: unknown[] = [];
  beforeEach(() => {
    resetAdsenseLoaderForTests();
    scripts.length = 0;
    (globalThis as Record<string, unknown>).document = {
      getElementById: () => null,
      createElement: () => ({ addEventListener: () => undefined }),
      head: { appendChild: (node: unknown) => scripts.push(node) },
    };
  });

  it("laedt ohne Consent kein Google-Script", async () => {
    expect(await loadAdsense(false)).toBe("blocked");
    expect(scripts.length).toBe(0);
  });

  it("laedt ohne Scharfschaltung auch mit Consent kein Script", async () => {
    expect(await loadAdsense(true)).toBe("blocked");
    expect(adsenseLoadState()).toBe("blocked");
    expect(scripts.length).toBe(0);
  });

  it("erzeugt bei mehrfachen Aufrufen niemals mehrere Script-Tags", async () => {
    await Promise.all([loadAdsense(true), loadAdsense(true), loadAdsense(false)]);
    expect(scripts.length).toBeLessThanOrEqual(1);
  });
});

describe("Keine Demowerbung, keine Testmessung", () => {
  it("gibt Demobestand nur fuer Admins im Testmodus frei", () => {
    expect(demoInventoryAllowed({ isAdmin: false, testMode: true })).toBe(false);
    expect(demoInventoryAllowed({ isAdmin: true, testMode: false })).toBe(false);
    expect(demoInventoryAllowed({ isAdmin: true, testMode: true })).toBe(true);
  });

  it("erzeugt fuer AdSense keine eigenen Impressionen oder Klicks", async () => {
    const spy = vi.fn();
    const provider = createAdsenseProvider(consent({ decision: "personalized", fromCmp: true }));
    await fillSlot([provider], request);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("AdSense Development-Platzhalter", () => {
  const request = {
    kind: "image" as const,
    afterIndex: 5,
    interests: [],
    region: "",
    seen: [],
  };

  it("ist ohne Demo-/Testfreigabe nicht verfuegbar", () => {
    const p = createAdsensePreviewProvider(false);
    expect(p.available()).toBe(false);
    expect(p.fill(request)).toBeNull();
  });

  it("liefert mit Freigabe einen Platz mit eigener Quelle", () => {
    const p = createAdsensePreviewProvider(true);
    expect(p.available()).toBe(true);
    const slot = p.fill(request);
    expect(slot?.source).toBe("adsense_preview");
    expect(slot?.adId).toBe(ADSENSE_PREVIEW_UNIT);
    expect(slot?.adId).not.toContain("ca-pub");
    expect(slot?.kind).toBe("image");
  });

  it("belegt nur jeden zweiten Displayplatz (Demobestand bleibt sichtbar)", () => {
    const p = createAdsensePreviewProvider(true);
    expect(p.fill(request)).not.toBeNull();
    expect(p.fill(request)).toBeNull();
    expect(p.fill(request)).not.toBeNull();
  });

  it("belegt keine Videoplaetze", () => {
    const p = createAdsensePreviewProvider(true);
    expect(p.fill({ ...request, kind: "video" })).toBeNull();
  });
});
