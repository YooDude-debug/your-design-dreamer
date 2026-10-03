import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runPublicTranscription } from "@/lib/public-transcribe-guard";

/** Simuliert Cloudflare: nur genau dieses frische Token gilt, und nur einmal. */
function cloudflare(valid = "valid-token-123456") {
  const used = new Set<string>();
  return vi.fn(async (token: string | null) => {
    if (token !== valid || used.has(token)) return false;
    used.add(token);
    return true;
  });
}

function deps(verify = cloudflare(), limited = false) {
  const transcribe = vi.fn(async () => "moin moin");
  return { verify, transcribe, rateLimit: () => ({ ok: !limited }) };
}

describe("public voice demo – bot check before paid call", () => {
  it("valid check → demo works", async () => {
    const d = deps();
    expect(await runPublicTranscription("valid-token-123456", d)).toEqual({
      ok: true,
      text: "moin moin",
    });
    expect(d.transcribe).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["invalid", "forged-token-abcdef"],
    ["manipulated client answer", "success"],
  ])("%s check → no AI call", async (_label, token) => {
    const d = deps();
    expect(await runPublicTranscription(token as string | null | undefined, d)).toEqual({
      ok: false,
      reason: "verification",
    });
    expect(d.transcribe).not.toHaveBeenCalled();
  });

  it("expired / reused token → no AI call", async () => {
    const d = deps();
    await runPublicTranscription("valid-token-123456", d);
    const again = await runPublicTranscription("valid-token-123456", d);
    expect(again).toEqual({ ok: false, reason: "verification" });
    expect(d.transcribe).toHaveBeenCalledTimes(1);
  });

  it("verification error fails closed", async () => {
    const d = deps(vi.fn(async () => Promise.reject(new Error("network"))));
    expect((await runPublicTranscription("valid-token-123456", d)).ok).toBe(false);
    expect(d.transcribe).not.toHaveBeenCalled();
  });

  it("temporary rate limit is kept and checked first", async () => {
    const d = deps(cloudflare(), true);
    expect(await runPublicTranscription("valid-token-123456", d)).toEqual({
      ok: false,
      reason: "rate_limited",
    });
    expect(d.verify).not.toHaveBeenCalled();
    expect(d.transcribe).not.toHaveBeenCalled();
  });

  it("same rules for signed-in and anonymous visitors (no auth bypass)", () => {
    const src = readFileSync("src/lib/public-transcribe.functions.ts", "utf8");
    expect(src).not.toMatch(/requireSupabaseAuth|userId|context/);
    expect(src).toMatch(/verifyTurnstileToken\(token, ip\)/);
    expect(src).toMatch(/checkIpRateLimit/);
  });

  it("demo sends the token and resets the widget after each use", () => {
    const src = readFileSync("src/components/landing/SlangTagTester.tsx", "utf8");
    expect(src).toMatch(/turnstileToken: token/);
    expect(src).toMatch(/captcha\.reset\(\)/);
  });
});
