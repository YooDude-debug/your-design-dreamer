/**
 * Business-Kampagnen V1 – Vertragstests der reinen Logik.
 *
 * Geprüft werden Limits je Tarif, Statusgültigkeit im Zeitfenster,
 * Hashtag-Normalisierung und die gewichtete Relevanzbewertung. Alle
 * serverseitigen Rollen-/Abo-Prüfungen bleiben zusätzlich in der Datenbank.
 */

import { describe, expect, it } from "vitest";
import {
  campaignCtaTarget,
  campaignErrorFrom,
  campaignLimitFor,
  isCampaignCta,
  isCampaignEventKind,
  isCampaignServable,
  isUuid,
  normalizeHashtags,
  validateCampaignWindow,
} from "@/lib/business-campaigns.shared";
import type { CampaignCta } from "@/lib/business-campaigns.shared";
import {
  EMPTY_VIEWER_SIGNALS,
  pickCampaign,
  regionMatches,
  scoreCampaign,
  type CampaignCandidate,
} from "@/lib/ads/campaign-ranking.shared";

const candidate = (over: Partial<CampaignCandidate> = {}): CampaignCandidate => ({
  id: "c1",
  ownerId: "owner",
  region: "",
  hashtags: [],
  slangTagId: null,
  ...over,
});

describe("Kampagnenlimits", () => {
  it("Business erlaubt 2, Business Pro 5, sonst 0", () => {
    expect(campaignLimitFor("business")).toBe(2);
    expect(campaignLimitFor("business_pro")).toBe(5);
    expect(campaignLimitFor("free")).toBe(0);
  });
});

describe("Auslieferbarkeit", () => {
  const now = Date.parse("2026-09-01T12:00:00Z");

  it("nur ACTIVE innerhalb des Zeitfensters", () => {
    expect(isCampaignServable({ status: "active", startsAt: null, endsAt: null }, now)).toBe(true);
    expect(isCampaignServable({ status: "draft", startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isCampaignServable({ status: "paused", startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isCampaignServable({ status: "ended", startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isCampaignServable({ status: "archived", startsAt: null, endsAt: null }, now)).toBe(
      false,
    );
  });

  it("Start in der Zukunft und Ende in der Vergangenheit blocken", () => {
    expect(isCampaignServable({ status: "active", startsAt: now + 1000, endsAt: null }, now)).toBe(
      false,
    );
    expect(isCampaignServable({ status: "active", startsAt: null, endsAt: now - 1000 }, now)).toBe(
      false,
    );
  });
});

describe("Hashtags", () => {
  it("normalisiert, entdoppelt und begrenzt", () => {
    expect(normalizeHashtags([" #Berlin", "berlin", "#Slang", ""])).toEqual(["berlin", "slang"]);
  });
});

describe("Relevanzgewichtung", () => {
  it("Signale wirken als Gewicht, nicht als Filter", () => {
    const plain = candidate({ id: "plain" });
    expect(scoreCampaign(plain, EMPTY_VIEWER_SIGNALS)).toBeGreaterThan(0);
  });

  it("Region, Hashtags, SlangTag, Following und Connection erhöhen den Wert", () => {
    const base = candidate();
    const viewer = {
      region: "Berlin, Germany",
      hashtags: ["slang"],
      slangTagIds: ["t1"],
      followingIds: ["owner"],
      connectionIds: ["owner"],
    };
    const rich = candidate({
      region: "Berlin, Germany",
      hashtags: ["slang"],
      slangTagId: "t1",
    });
    expect(scoreCampaign(rich, viewer)).toBeGreaterThan(scoreCampaign(base, viewer));
  });

  it("Regionvergleich ist tolerant gegenüber Teilangaben", () => {
    expect(regionMatches("Berlin", "Berlin, Germany")).toBe(true);
    // Leere Regionsangabe = kein Regionsbonus (aber auch kein Ausschluss).
    expect(regionMatches("", "Berlin, Germany")).toBe(false);
    expect(regionMatches("Tokyo", "Berlin, Germany")).toBe(false);
  });

  it("bereits gesehene Kampagnen werden zurückgestellt", () => {
    const pool = [candidate({ id: "a" }), candidate({ id: "b" })];
    // Deterministisch: Auswahl in der Mitte des Gesamtgewichts.
    const picked = pickCampaign(pool, EMPTY_VIEWER_SIGNALS, ["a"], () => 0.5);
    expect(picked?.id).toBe("b");
  });

  it("leerer Bestand liefert nichts", () => {
    expect(pickCampaign([], EMPTY_VIEWER_SIGNALS, [])).toBeNull();
    expect(scoreCampaign(candidate({ id: "a" }), EMPTY_VIEWER_SIGNALS, ["a"])).toBeLessThan(
      scoreCampaign(candidate({ id: "a" }), EMPTY_VIEWER_SIGNALS, []),
    );
  });
});

/**
 * Härtung F1 (Ereignis-Tracking) und F5 (Zeitfenster) – reine Logikebene.
 * Die fachliche Durchsetzung liegt zusätzlich in der Datenbank
 * (`increment_campaign_metric`, `ad_campaigns_time_window_chk`).
 */
describe("F1 – Kampagnen-Ereignisse", () => {
  it("T1/T2 – gültige Ereignisarten werden akzeptiert", () => {
    expect(isCampaignEventKind("impression")).toBe(true);
    expect(isCampaignEventKind("click")).toBe(true);
  });

  it("T3 – ungültige Ereignisart wird abgelehnt", () => {
    for (const bad of ["conversion", "IMPRESSION", "", null, 1, { kind: "click" }]) {
      expect(isCampaignEventKind(bad)).toBe(false);
    }
  });

  it("T4 – ungültige Kampagnen-ID wird abgelehnt", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    for (const bad of ["", "abc", "1; drop table", 42, null]) {
      expect(isUuid(bad)).toBe(false);
    }
  });

  it("T7/T8 – nicht auslieferbare Kampagnen erhalten keine Feed-Ereignisse", () => {
    const now = Date.parse("2026-09-01T12:00:00Z");
    expect(isCampaignServable({ status: "draft", startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isCampaignServable({ status: "ended", startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isCampaignServable({ status: "paused", startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isCampaignServable({ status: "archived", startsAt: null, endsAt: null }, now)).toBe(
      false,
    );
    expect(isCampaignServable({ status: "active", startsAt: null, endsAt: null }, now)).toBe(true);
  });
});

describe("F5 – Zeitfenster", () => {
  const t = Date.parse("2026-09-01T12:00:00Z");

  it("T10 – Start vor Ende ist erlaubt", () => {
    expect(validateCampaignWindow(t, t + 1000)).toBeNull();
    expect(validateCampaignWindow(null, null)).toBeNull();
    expect(validateCampaignWindow(t, null)).toBeNull();
    expect(validateCampaignWindow(null, t)).toBeNull();
  });

  it("T11 – Start gleich Ende wird abgelehnt", () => {
    expect(validateCampaignWindow(t, t)).toBe("invalid_time_range");
  });

  it("T12 – Start nach Ende wird abgelehnt", () => {
    expect(validateCampaignWindow(t + 1, t)).toBe("invalid_time_range");
  });

  it("T13 – ungültige Zeitstempel werden abgelehnt", () => {
    expect(validateCampaignWindow(Number.NaN, t)).toBe("invalid_input");
    expect(validateCampaignWindow(t, Number.POSITIVE_INFINITY)).toBe("invalid_input");
    expect(validateCampaignWindow(t + 0.5, null)).toBe("invalid_input");
  });

  it("T14 – normale UTC-Zeitstempel funktionieren", () => {
    const start = Date.parse("2026-09-01T00:00:00Z");
    const end = Date.parse("2026-09-30T23:59:59Z");
    expect(validateCampaignWindow(start, end)).toBeNull();
    expect(campaignErrorFrom("invalid_time_range")).toBe("invalid_time_range");
    expect(campaignErrorFrom('violates check constraint "ad_campaigns_time_window_chk"')).toBe(
      "invalid_time_range",
    );
  });
});

/**
 * F6 – Kampagnen-SlangTag / Drop / CTA (reine Logik, ohne Netzwerk).
 */
describe("F6 – Kampagnen-CTA", () => {
  const base = {
    cta: null as CampaignCta | null,
    slangTagName: null as string | null,
    slangTagPreviewUrl: null as string | null,
    companyUsername: null as string | null,
  };

  it("T10 – CTA führt zum bestehenden SlangTag-Ziel", () => {
    expect(campaignCtaTarget({ ...base, cta: "slangtag", slangTagName: "yolo" })).toEqual({
      kind: "slangtag",
      name: "yolo",
    });
  });

  it("T10 – CTA führt zum bestehenden Unternehmensprofil", () => {
    expect(campaignCtaTarget({ ...base, cta: "profile", companyUsername: "acme" })).toEqual({
      kind: "profile",
      username: "acme",
    });
  });

  it("T10 – Probeanhören nur mit vorhandener Vorschau", () => {
    expect(campaignCtaTarget({ ...base, cta: "listen" })).toBeNull();
    expect(
      campaignCtaTarget({ ...base, cta: "listen", slangTagPreviewUrl: "https://x/y" }),
    ).toEqual({ kind: "listen" });
  });

  it("T7 – ohne CTA und ohne Werbemittel gibt es kein Ziel", () => {
    expect(campaignCtaTarget(base)).toBeNull();
  });

  it("fehlendes Werbemittel erzeugt niemals einen Fake-Link", () => {
    expect(campaignCtaTarget({ ...base, cta: "slangtag" })).toBeNull();
    expect(campaignCtaTarget({ ...base, cta: "profile" })).toBeNull();
  });

  it("T5/T6 – nur gültige CTA-Werte werden akzeptiert", () => {
    expect(isCampaignCta("listen")).toBe(true);
    expect(isCampaignCta("slangtag")).toBe(true);
    expect(isCampaignCta("profile")).toBe(true);
    expect(isCampaignCta("external")).toBe(false);
    expect(isCampaignCta("")).toBe(false);
  });

  it("T5/T6 – Asset-IDs müssen UUIDs sein", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("3f1a1e2c-8a5f-4a2b-9a4e-2f0f7f6b1c2d")).toBe(true);
  });
});
