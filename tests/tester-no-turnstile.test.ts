import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regressionsschutz: Turnstile gehört ausschließlich in die Registrierung,
 * niemals in den öffentlichen SlangTag-Tester der Startseite.
 */
describe("SlangTag-Tester ohne Turnstile", () => {
  const tester = readFileSync("src/components/landing/SlangTagTester.tsx", "utf8");
  const fn = readFileSync("src/lib/public-transcribe.functions.ts", "utf8");

  it("rendert keine Turnstile-Komponente und nutzt kein Captcha-Gate", () => {
    expect(tester).not.toContain("<Turnstile");
    expect(tester).not.toContain("useCaptchaGate");
    expect(tester).not.toContain("captchaToken");
  });

  it("öffentliche Transkription verlangt kein Captcha-Token", () => {
    expect(fn).not.toContain("captchaToken");
    expect(fn).not.toContain("verifyTurnstileToken");
  });

  it("serverseitiger Missbrauchsschutz bleibt aktiv", () => {
    expect(fn).toContain("checkIpRateLimit");
    expect(fn).toContain("rate_limited");
  });

  it("Registrierung behält Turnstile", () => {
    const auth = readFileSync("src/routes/auth.tsx", "utf8");
    expect(auth).toContain("<Turnstile");
    const authFns = readFileSync("src/lib/auth.functions.ts", "utf8");
    expect(authFns).toContain("verifyTurnstileToken");
  });
});
