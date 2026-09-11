import { describe, expect, it } from "vitest";
import {
  buildCategoryIndex,
  categoriesForSignal,
  mapSignals,
} from "@/lib/interest-engine/signal-map";
import type { InterestCategory } from "@/lib/interest-engine/types";

const categories: InterestCategory[] = [
  { id: "c-music", slug: "music", name: "Musik", kind: "topic", parentId: null, active: true },
  { id: "c-berlin", slug: "berlin", name: "Berlin", kind: "region", parentId: null, active: true },
  { id: "c-de", slug: "lang-de", name: "Deutsch", kind: "language", parentId: null, active: true },
  { id: "c-off", slug: "cars", name: "Autos", kind: "topic", parentId: null, active: false },
];
const index = buildCategoryIndex(categories);

describe("Signal → Interessen-Abbildung", () => {
  it("löst nur vorhandene Kategorien auf", () => {
    expect(
      categoriesForSignal(index, {
        signal: "like",
        hashtags: ["#Musik", "gibtsnicht"],
        region: "Berlin, Deutschland",
        language: "de",
      }).sort(),
    ).toEqual(["c-berlin", "c-de", "c-music"]);
  });

  it("ignoriert inaktive Kategorien", () => {
    expect(categoriesForSignal(index, { signal: "like", hashtags: ["cars"] })).toEqual([]);
  });

  it("bildet positive Signale auf vorhandene Aktionen ab", () => {
    const out = mapSignals(index, [
      { signal: "like", postId: "p1", authorId: "a1", hashtags: ["music"] },
      { signal: "save", postId: "p1" },
      { signal: "view_complete", postId: "p1" },
    ]);
    expect(out.map((o) => o.action)).toEqual(["post_like", "post_save", "post_view_complete"]);
  });

  it("verwirft schnelles Wegscrollen und negative Signale", () => {
    const out = mapSignals(index, [
      { signal: "dwell", postId: "p1", dwellMs: 900 },
      { signal: "dwell", postId: "p2", dwellMs: 9000 },
      { signal: "report", postId: "p3" },
      { signal: "not_interested", postId: "p4" },
      { signal: "skip", postId: "p5" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.action).toBe("post_view");
    expect(out[0]?.dwellMs).toBe(9000);
  });
});