/**
 * Business-Onboarding: Rolle und Abo sind getrennt.
 *
 * Geprüft wird ausschliesslich die Anzeigelogik. Die verbindliche Prüfung
 * (Rolle + aktives Abo + Limit) bleibt serverseitig in `saveMyCampaign`.
 */
import { describe, expect, it } from "vitest";

import { campaignGate } from "@/lib/business-campaigns.shared";

describe("campaignGate", () => {
  it("blendet die Sektion ohne Unternehmerrolle aus", () => {
    expect(campaignGate({ isBusiness: false, limit: 0, activeCount: 0 })).toBe("no_role");
  });

  it("zeigt die Sektion gesperrt, wenn die Rolle ohne Abo besteht", () => {
    expect(campaignGate({ isBusiness: true, limit: 0, activeCount: 0 })).toBe("needs_subscription");
  });

  it("erlaubt Kampagnen mit Business-Abo (Limit 2)", () => {
    expect(campaignGate({ isBusiness: true, limit: 2, activeCount: 1 })).toBe("ready");
  });

  it("meldet ein ausgeschöpftes Limit", () => {
    expect(campaignGate({ isBusiness: true, limit: 2, activeCount: 2 })).toBe("limit_reached");
    expect(campaignGate({ isBusiness: true, limit: 5, activeCount: 5 })).toBe("limit_reached");
  });
});
