import { describe, expect, it } from "vitest";

import { CREATOR_ELIGIBILITY_THRESHOLD, isCreatorEligible } from "@/lib/creator-eligibility";

/**
 * Eligibility-Regel: mindestens 10 Connections ODER mindestens 10 Follower.
 * Die Regel entscheidet nur über das Angebot „Creator werden“, niemals über
 * die tatsächliche Berechtigung – diese bleibt an `user_roles` gebunden.
 */
describe("Creator-Eligibility", () => {
  it("verwendet den Schwellenwert 10", () => {
    expect(CREATOR_ELIGIBILITY_THRESHOLD).toBe(10);
  });

  const faelle: [string, number, number, boolean][] = [
    ["T1 0/0 gesperrt", 0, 0, false],
    ["T2 9/0 gesperrt", 9, 0, false],
    ["T3 0/9 gesperrt", 0, 9, false],
    ["T4 10/0 frei", 10, 0, true],
    ["T5 0/10 frei", 0, 10, true],
    ["T6 10/10 frei", 10, 10, true],
    ["T7 9/10 frei", 9, 10, true],
    ["T8 10/9 frei", 10, 9, true],
  ];

  for (const [name, connections, followers, erwartet] of faelle) {
    it(name, () => {
      expect(isCreatorEligible(connections, followers)).toBe(erwartet);
    });
  }
});
