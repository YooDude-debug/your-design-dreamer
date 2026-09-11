import { describe, expect, it } from "vitest";

import {
  emptyMarketFeedSignals,
  marketFeedReasons,
  recencyFactor,
  scoreMarketFeedItem,
} from "@/lib/market-feed-relevance";

const base = () => emptyMarketFeedSignals();

describe("market feed relevance", () => {
  it("Fall A: gespeicherte Suche passt, Verkäufer unbekannt", () => {
    const s = { ...base(), savedSearchScore: 1, savedSearchMatches: 1 };
    expect(scoreMarketFeedItem(s)).toBeGreaterThan(50);
    expect(marketFeedReasons(s)).toContain("saved_search");
  });

  it("Fall B: Follow ohne Suchtreffer bleibt schwächer als ein Suchtreffer", () => {
    const follow = { ...base(), followedSeller: true };
    const search = { ...base(), savedSearchScore: 1, savedSearchMatches: 1 };
    expect(scoreMarketFeedItem(follow)).toBeLessThan(scoreMarketFeedItem(search));
    expect(marketFeedReasons(follow)).toContain("followed_seller");
    expect(marketFeedReasons(follow)).not.toContain("saved_search");
  });

  it("Fall C/D: kombinierte Signale ergeben den höchsten Wert", () => {
    const combined = {
      ...base(),
      savedSearchScore: 1,
      savedSearchMatches: 2,
      followedSeller: true,
      sellerVerified: true,
      categoryMatch: true,
    };
    const onlySearch = { ...base(), savedSearchScore: 1, savedSearchMatches: 1 };
    const onlyFollow = { ...base(), followedSeller: true };
    expect(scoreMarketFeedItem(combined)).toBeGreaterThan(scoreMarketFeedItem(onlySearch));
    expect(scoreMarketFeedItem(combined)).toBeGreaterThan(scoreMarketFeedItem(onlyFollow));
  });

  it("Aktualität sinkt mit dem Alter und markiert neue Angebote", () => {
    expect(recencyFactor(0)).toBe(1);
    expect(recencyFactor(24 * 7)).toBeCloseTo(0.5, 5);
    expect(recencyFactor(24 * 30)).toBe(0);
    expect(marketFeedReasons({ ...base(), ageHours: 5 })).toContain("fresh");
    expect(marketFeedReasons({ ...base(), ageHours: 200 })).not.toContain("fresh");
  });
});
