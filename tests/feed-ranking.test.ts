/**
 * Feed – Ranking-Hilfsfunktionen und Diversity-Schicht.
 *
 * Ziel: Relevanz bleibt führend, aber monotone Blöcke (immer derselbe Autor)
 * werden aufgebrochen. Die Ergebnismenge darf sich dabei nie verändern.
 */

import { describe, expect, it } from "vitest";
import { clamp, clamp01, hashUnit, locationParts, norm, saturate } from "@/lib/feed-ranking/utils";
import { applyFeedDiversity } from "@/lib/feed-ranking/diversity";
import type { RankablePost, ScoredPost } from "@/lib/feed-ranking/types";

describe("Ranking-Hilfsfunktionen", () => {
  it("begrenzt Werte und fängt NaN ab", () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
    expect(clamp(Number.POSITIVE_INFINITY, 2, 5)).toBe(2);
  });

  it("normalisiert Freitext und Orte", () => {
    expect(norm("  Hamburg ")).toBe("hamburg");
    expect(norm(null)).toBe("");
    expect(locationParts("Hamburg, Deutschland")).toEqual(["hamburg", "deutschland"]);
  });

  it("sättigt monoton und bleibt unter 1", () => {
    expect(saturate(0, 5)).toBe(0);
    expect(saturate(5, 5)).toBeCloseTo(0.5);
    expect(saturate(1000, 5)).toBeLessThan(1);
    expect(saturate(10, 5)).toBeGreaterThan(saturate(5, 5));
  });

  it("liefert deterministischen Pseudo-Zufall im Bereich 0..1", () => {
    const a = hashUnit("post-1");
    expect(a).toBe(hashUnit("post-1"));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(hashUnit("post-2")).not.toBe(a);
  });
});

function post(id: string, authorId: string): RankablePost {
  return {
    id,
    authorId,
    createdAt: Date.now(),
    region: "Hamburg, Deutschland",
    hashtags: ["alltag"],
    slangTagIds: [],
    mediaType: "image",
  } as RankablePost;
}

function scored(id: string, score: number): ScoredPost {
  return { postId: id, score, breakdown: {}, exploration: false };
}

describe("Diversity-Schicht", () => {
  it("verändert die Ergebnismenge nicht", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const byId = new Map(ids.map((id, i) => [id, post(id, i < 4 ? "author-1" : "author-2")]));
    const input = ids.map((id, i) => scored(id, 100 - i));
    const out = applyFeedDiversity({ scored: input, byId });
    expect(out).toHaveLength(ids.length);
    expect([...out.map((p) => p.postId)].sort()).toEqual([...ids].sort());
  });

  it("ist deterministisch (gleiche Eingabe, gleiche Reihenfolge)", () => {
    const ids = ["a1", "a2", "a3", "a4", "b1", "b2"];
    const byId = new Map(
      ids.map((id) => [id, post(id, id.startsWith("a") ? "author-1" : "author-2")]),
    );
    const input = () => ids.map((id, i) => scored(id, 100 - i * 0.01));
    const first = applyFeedDiversity({ scored: input(), byId }).map((p) => p.postId);
    const second = applyFeedDiversity({ scored: input(), byId }).map((p) => p.postId);
    expect(second).toEqual(first);
  });

  it("lässt einen klar relevanteren Beitrag trotz Wiederholungsstrafe vorne", () => {
    const ids = ["a1", "a2", "b1"];
    const byId = new Map(
      ids.map((id) => [id, post(id, id.startsWith("a") ? "author-1" : "author-2")]),
    );
    const out = applyFeedDiversity({
      scored: [scored("a1", 1000), scored("a2", 900), scored("b1", 10)],
      byId,
    }).map((p) => p.postId);
    expect(out[0]).toBe("a1");
    expect(out[2]).toBe("b1");
  });




  it("lässt sehr kurze Listen unverändert", () => {
    const byId = new Map([
      ["a", post("a", "x")],
      ["b", post("b", "x")],
    ]);
    const out = applyFeedDiversity({ scored: [scored("a", 10), scored("b", 5)], byId });
    expect(out.map((p) => p.postId)).toEqual(["a", "b"]);
  });
});
