import { describe, expect, it } from "vitest";
import { isPathOwnedBy } from "@/lib/media-path-ownership";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("SEC-01 media path ownership", () => {
  it("allows the creator's own media path", () => {
    expect(isPathOwnedBy(`${ME}/posts/a.webp`, [ME])).toBe(true);
  });
  it("refuses another user's private media path", () => {
    expect(isPathOwnedBy(`${OTHER}/posts/private.webp`, [ME])).toBe(false);
  });
  it("refuses traversal from own folder into a foreign folder", () => {
    expect(isPathOwnedBy(`${ME}/../${OTHER}/posts/x.webp`, [ME])).toBe(false);
  });
  it("refuses malformed or empty paths", () => {
    for (const p of ["", ME, `/${ME}/a.webp`, `${ME}//a.webp`, `${ME}\\a.webp`, null, 42]) {
      expect(isPathOwnedBy(p, [ME])).toBe(false);
    }
  });
  it("refuses when no owner is known", () => {
    expect(isPathOwnedBy(`${ME}/posts/a.webp`, [null, undefined, ""])).toBe(false);
  });
  it("allows either listed owner (tag owner or creator)", () => {
    expect(isPathOwnedBy(`${OTHER}/audio/t.webm`, [ME, OTHER])).toBe(true);
  });
});
