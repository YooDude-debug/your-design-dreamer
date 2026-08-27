import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAPTCHA_GRACE_MS } from "@/lib/use-captcha-gate";

/**
 * Regressionsschutz für den Registrierungs-Bug: Ein noch nicht fertiges
 * Turnstile-Widget darf das Absenden nicht blockieren.
 */
describe("captcha gate", () => {
  it("hält die Kulanzzeit kurz (mobile Netze)", () => {
    expect(CAPTCHA_GRACE_MS).toBeGreaterThan(0);
    expect(CAPTCHA_GRACE_MS).toBeLessThanOrEqual(2000);
  });

  it("Auth-Formulare deaktivieren Buttons nicht wegen fehlendem Token", async () => {
    const src = readFileSync("src/routes/auth.tsx", "utf8");
    expect(src).not.toContain("captchaReady");
    expect(src).not.toContain("!captchaReady");
    expect(src).toContain("captcha.waitForToken()");
  });

  it("serverseitige Turnstile-Prüfung bleibt aktiv", async () => {
    const src = readFileSync("src/lib/turnstile.server.ts", "utf8");
    expect(src).toContain("siteverify");
    expect(src).toContain("json.success");
  });
});
