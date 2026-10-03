import { describe, expect, it } from "vitest";
import { isAllowedReturnUrl } from "@/lib/return-url.server";
import { videoThumbPath, isOwnedVideoPath } from "@/lib/video/video-upload.shared";
import { readFileSync } from "node:fs";

describe("payment return links", () => {
  const origin = "https://id-preview--abc.lovable.app";
  it("accepts the app's own addresses", () => {
    expect(isAllowedReturnUrl("https://y-dude.com/business", null)).toBe(true);
    expect(isAllowedReturnUrl("https://www.y-dude.com/profile", null)).toBe(true);
    expect(isAllowedReturnUrl(`${origin}/market/1`, origin)).toBe(true);
    expect(isAllowedReturnUrl("http://localhost:8080/x", "http://localhost:8080")).toBe(true);
  });
  it("rejects foreign or tricky addresses", () => {
    expect(isAllowedReturnUrl("https://evil.example/", origin)).toBe(false);
    expect(isAllowedReturnUrl("https://y-dude.com.evil.example/", null)).toBe(false);
    expect(isAllowedReturnUrl("https://user@y-dude.com/", null)).toBe(false);
    expect(isAllowedReturnUrl("http://y-dude.com/", null)).toBe(false);
    expect(isAllowedReturnUrl("javascript:alert(1)", origin)).toBe(false);
    expect(isAllowedReturnUrl("not a url", origin)).toBe(false);
  });
  it("every payment session uses the check", () => {
    for (const f of ["src/lib/billing.server.ts", "src/lib/creator-subscription.server.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/return_url:\s*input\.returnUrl/);
    }
  });
});

describe("video cleanup only touches the owner's files", () => {
  it("thumbnail is always derived from the owned video path", () => {
    const uid = "u1";
    const p = `${uid}/videos/a.mp4`;
    expect(isOwnedVideoPath(p, uid)).toBe(true);
    expect(videoThumbPath(p)).toBe(`${uid}/videos/a__t.webp`);
    const src = readFileSync("src/lib/video/video-upload.functions.ts", "utf8");
    expect(src).not.toMatch(/data\.thumbnailPath\s*\?\?/);
  });
});

describe("locked creator audio", () => {
  it("only unlocked tags are signed", () => {
    const src = readFileSync("src/lib/creator-slangtags.functions.ts", "utf8");
    expect(src).toMatch(/previewUrl: unlocked && row\.audio_url/);
    const pub = readFileSync("src/lib/public-slangtag.functions.ts", "utf8");
    expect(pub).toMatch(/locked \? null/);
  });
});
