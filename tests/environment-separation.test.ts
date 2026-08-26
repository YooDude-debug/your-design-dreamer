/**
 * Phase 2 – Trennung von Development, Staging und Production.
 *
 * Geprüft wird der Vertrag der Umgebungserkennung und der Schutzregeln:
 * eine Testumgebung darf keine echten Zahlungen auslösen, und eine
 * Testzahlungsmeldung darf keine produktive Instanz verändern.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  expectedPaymentsMode,
  isAppEnvironment,
  resolveEnvironmentFromHost,
} from "@/lib/environment.shared";

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

async function server() {
  // Frischer Import, damit gesetzte Variablen wirken.
  return await import("@/lib/environment.server");
}

describe("Zuordnung der Hostnamen", () => {
  it.each(["y-dude.com", "www.y-dude.com", "y-dude.lovable.app", "Y-Dude.com", "y-dude.com:443"])(
    "%s ist Production",
    (host) => {
      expect(resolveEnvironmentFromHost(host)).toBe("production");
    },
  );

  it.each(["localhost", "localhost:8080", "127.0.0.1", "meine-maschine.local"])(
    "%s ist Development",
    (host) => {
      expect(resolveEnvironmentFromHost(host)).toBe("development");
    },
  );

  it.each([
    "id-preview--28c6b349.lovable.app",
    "project--28c6b349-dev.lovable.app",
    "irgendetwas-neues.lovable.app",
    "y-dude.staging.example",
  ])("%s ist Staging", (host) => {
    expect(resolveEnvironmentFromHost(host)).toBe("staging");
  });

  it("ein unbekannter Host wird nie als Production eingeordnet", () => {
    expect(resolveEnvironmentFromHost("beliebig.example.org")).not.toBe("production");
  });

  it("Zielzahlungsmodus je Umgebung", () => {
    expect(expectedPaymentsMode("production")).toBe("live");
    expect(expectedPaymentsMode("staging")).toBe("sandbox");
    expect(expectedPaymentsMode("development")).toBe("sandbox");
  });

  it("nur die drei bekannten Umgebungsnamen sind gültig", () => {
    expect(isAppEnvironment("staging")).toBe(true);
    expect(isAppEnvironment("prod")).toBe(false);
  });
});

describe("Umgebungsbestimmung auf dem Server", () => {
  it("APP_ENV hat Vorrang vor dem Hostnamen", async () => {
    process.env["APP_ENV"] = "staging";
    const { appEnvironment } = await server();
    expect(appEnvironment(new Request("https://y-dude.com/api/public/payments/webhook"))).toBe(
      "staging",
    );
  });

  it("ohne APP_ENV entscheidet der Hostname der Anfrage", async () => {
    delete process.env["APP_ENV"];
    const { appEnvironment } = await server();
    expect(appEnvironment(new Request("https://y-dude.com/x"))).toBe("production");
    expect(appEnvironment(new Request("https://id-preview--abc.lovable.app/x"))).toBe("staging");
  });

  it("ein vorgeschalteter Host-Header wird berücksichtigt", async () => {
    delete process.env["APP_ENV"];
    const { appEnvironment } = await server();
    const req = new Request("https://internal.worker/x", {
      headers: { "x-forwarded-host": "y-dude.com, internal" },
    });
    expect(appEnvironment(req)).toBe("production");
  });
});

describe("Zahlungsmodus je Umgebung", () => {
  it("Staging und Development erlauben ausschließlich den Testmodus", async () => {
    const { allowedPaymentsModes, paymentsModeAllowed } = await server();
    for (const env of ["staging", "development"] as const) {
      expect(allowedPaymentsModes(env)).toEqual(["sandbox"]);
      expect(paymentsModeAllowed("live", env)).toBe(false);
      expect(paymentsModeAllowed("sandbox", env)).toBe(true);
    }
  });

  it("Production akzeptiert Live, sobald Live-Schlüssel hinterlegt sind", async () => {
    process.env["STRIPE_LIVE_API_KEY"] = "test-platzhalter";
    const { allowedPaymentsModes, paymentsModeAllowed } = await server();
    expect(allowedPaymentsModes("production")).toEqual(["live"]);
    // Kernaussage: Testzahlungen verändern dann keine Produktionsdaten mehr.
    expect(paymentsModeAllowed("sandbox", "production")).toBe(false);
  });

  it("ohne Live-Schlüssel bleibt Production im Testmodus betriebsfähig", async () => {
    delete process.env["STRIPE_LIVE_API_KEY"];
    const { allowedPaymentsModes } = await server();
    expect(allowedPaymentsModes("production")).toEqual(["sandbox"]);
  });
});

describe("Test- und Entwicklungsmechanismen", () => {
  it("in Staging und Development immer erlaubt", async () => {
    const { testFeaturesAllowed } = await server();
    expect(testFeaturesAllowed("staging")).toBe(true);
    expect(testFeaturesAllowed("development")).toBe(true);
  });

  it("in Production nur nach ausdrücklicher Freigabe", async () => {
    delete process.env["ALLOW_TEST_FEATURES_IN_PRODUCTION"];
    let mod = await server();
    expect(mod.testFeaturesAllowed("production")).toBe(false);
    process.env["ALLOW_TEST_FEATURES_IN_PRODUCTION"] = "true";
    mod = await server();
    expect(mod.testFeaturesAllowed("production")).toBe(true);
  });

  it("der Zustandsbericht enthält keine Geheimnisse", async () => {
    process.env["APP_ENV"] = "staging";
    process.env["STRIPE_LIVE_API_KEY"] = "geheim-nicht-ausgeben";
    const { environmentReport } = await server();
    const report = environmentReport();
    expect(report.environment).toBe("staging");
    expect(JSON.stringify(report)).not.toContain("geheim-nicht-ausgeben");
  });
});

describe("Zahlungs-Client: Live in Testumgebungen gesperrt", () => {
  it("Live-Zugriff scheitert, wenn APP_ENV Staging ist", async () => {
    process.env["APP_ENV"] = "staging";
    process.env["STRIPE_LIVE_API_KEY"] = "platzhalter";
    const { getConnectionApiKey } = await import("@/lib/stripe.server");
    expect(() => getConnectionApiKey("live")).toThrow(/disabled in staging/i);
  });

  it("Testzugriff bleibt in Staging möglich", async () => {
    process.env["APP_ENV"] = "staging";
    process.env["STRIPE_SANDBOX_API_KEY"] = "platzhalter-test";
    const { getConnectionApiKey } = await import("@/lib/stripe.server");
    expect(getConnectionApiKey("sandbox")).toBe("platzhalter-test");
  });
});
