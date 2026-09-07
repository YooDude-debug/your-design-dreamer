import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regressionsschutz: Die Sicherheitsprüfung im Registrierungsformular startet
 * erst nach der Pflicht-Zustimmung; der Absende-Button verlangt zusätzlich ein
 * erfolgreiches Turnstile-Ergebnis. Die verbindliche Prüfung bleibt
 * serverseitig und fail-closed.
 */
describe("turnstile delayed mount (registration)", () => {
  const src = readFileSync("src/routes/auth.tsx", "utf8");

  it("mountet Turnstile erst nach aktivierter Pflicht-Checkbox", () => {
    // Zusätzlich hinter dem zentralen Schalter (derzeit deaktiviert).
    expect(src).toContain("{TURNSTILE_ENABLED && accepted && (");

    expect(src).toContain("key={captchaKey}");
  });

  it("setzt den Zustand beim Abwählen vollständig zurück", () => {
    expect(src).toContain("const toggleAccepted");
    expect(src).toContain("setCaptchaKey((k) => k + 1)");
  });

  it("erlaubt einen sauberen neuen Versuch", () => {
    expect(src).toContain("const retryCaptcha");
  });

  it("aktiviert den Registrieren-Button nur bei vollständigem Formular + Token", () => {
    expect(src).toContain("disabled={loading || !formReady}");
    expect(src).toContain("!!captcha.token");
    expect(src).toContain("meetsMinAge(birthdate.trim())");
  });

  it("serverseitige Turnstile-Prüfung bleibt fail-closed", () => {
    const server = readFileSync("src/lib/turnstile.server.ts", "utf8");
    expect(server).toContain("siteverify");
    expect(server).toContain("json?.success !== true");
    const fn = readFileSync("src/lib/auth.functions.ts", "utf8");
    expect(fn).toContain('if (!ok) return { status: "captcha" };');
  });
});
