import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TURNSTILE_ENABLED } from "@/lib/turnstile-flag";

/**
 * Temporaere Massnahme: Turnstile ist zentral deaktiviert. Registrierung und
 * Login duerfen an keiner Stelle wegen eines fehlenden Tokens abbrechen.
 */
describe("Turnstile temporaer deaktiviert", () => {
  it("Schalter steht auf aus", () => {
    expect(TURNSTILE_ENABLED).toBe(false);
  });

  it("Server-Funktionen pruefen nur bei aktivem Schalter", () => {
    const src = readFileSync("src/lib/auth.functions.ts", "utf8");
    expect(src).toContain("if (TURNSTILE_ENABLED) {");
    // Keine ungeschuetzte Verifikation mehr im Auth-Pfad
    for (const line of src.split("\n")) {
      if (line.includes("verifyTurnstileToken(")) {
        expect(line.startsWith("      ")).toBe(true);
      }
    }
  });

  it("Widget bleibt im Code erhalten (spaetere Reaktivierung)", () => {
    const src = readFileSync("src/routes/auth.tsx", "utf8");
    expect(src).toContain("<Turnstile");
    expect(src).toContain("TURNSTILE_ENABLED");
  });

  it("Serverseitige Verifikation bleibt unveraendert fail-closed", () => {
    const src = readFileSync("src/lib/turnstile.server.ts", "utf8");
    expect(src).toContain("json?.success !== true");
  });
});
