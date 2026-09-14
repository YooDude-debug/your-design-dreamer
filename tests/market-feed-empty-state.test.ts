import { describe, expect, it } from "vitest";
import { marketFeedEmptyState } from "@/components/feed/MarketFeedList";

describe("MarketFeed Empty-State-Entscheidung", () => {
  it("zeigt 'no-searches' an, wenn weder Suchen noch Items vorhanden sind", () => {
    expect(marketFeedEmptyState(0, 0)).toBe("no-searches");
  });

  it("zeigt KEINEN Empty State, wenn Items von gefolgten Verkäufern vorhanden sind, aber keine gespeicherten Suchen", () => {
    expect(marketFeedEmptyState(3, 0)).toBe("none");
  });

  it("zeigt 'empty' an, wenn gespeicherte Suchen vorhanden sind, aber keine Items", () => {
    expect(marketFeedEmptyState(0, 2)).toBe("empty");
  });

  it("zeigt KEINEN Empty State, wenn sowohl gespeicherte Suchen als auch Items vorhanden sind", () => {
    expect(marketFeedEmptyState(5, 2)).toBe("none");
  });
});
