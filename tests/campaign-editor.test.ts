/**
 * Kampagnen-Editor V1: abgeleiteter Bereitschaftszustand und Fehlerabbildung.
 * Die verbindliche Prüfung (Rolle, Abo, Limit, Eigentum) bleibt serverseitig.
 */
import { describe, expect, it } from "vitest";

import {
  campaignErrorFrom,
  campaignPhase,
  isCampaignComplete,
} from "@/lib/business-campaigns.shared";

const base = {
  status: "draft" as const,
  name: "Sommeraktion",
  caption: "Jetzt entdecken",
  region: "Berlin, Germany",
};

describe("campaignPhase", () => {
  it("bleibt Entwurf ohne Werbemittel", () => {
    expect(campaignPhase(base)).toBe("draft");
    expect(isCampaignComplete(base)).toBe(false);
  });

  it("ist bereit mit Bild", () => {
    expect(campaignPhase({ ...base, mediaImagePath: "u/images/a.webp" })).toBe("ready");
  });

  it("ist bereit mit eigenem SlangTag", () => {
    expect(campaignPhase({ ...base, slangTagId: "tag-1" })).toBe("ready");
  });

  it("gibt echte Status unverändert zurück", () => {
    expect(campaignPhase({ ...base, status: "active" })).toBe("active");
    expect(campaignPhase({ ...base, status: "paused" })).toBe("paused");
  });

  it("bleibt Entwurf ohne Text oder Region", () => {
    expect(campaignPhase({ ...base, caption: "", mediaImagePath: "u/images/a.webp" })).toBe(
      "draft",
    );
    expect(campaignPhase({ ...base, region: "", mediaImagePath: "u/images/a.webp" })).toBe("draft");
  });
});

describe("campaignErrorFrom", () => {
  it("erkennt fremdes Werbemittel", () => {
    expect(campaignErrorFrom("campaign_media_not_owned")).toBe("campaign_media_not_owned");
  });

  it("erkennt fehlendes Abo bei der Schaltung", () => {
    expect(campaignErrorFrom("business_subscription_required")).toBe(
      "business_subscription_required",
    );
  });
});
