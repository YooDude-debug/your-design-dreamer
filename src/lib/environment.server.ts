/**
 * Serverseitige Umgebungsbestimmung und Umgebungs-Schutzregeln.
 *
 * Zweck (Phase 2): verhindern, dass Test-/Staging-Konfiguration den echten
 * Betrieb verändert und umgekehrt. Es werden ausschließlich Entscheidungen
 * getroffen – keine Geheimnisse protokolliert oder ausgeliefert.
 */

import {
  isAppEnvironment,
  resolveEnvironmentFromHost,
  expectedPaymentsMode,
  type AppEnvironment,
} from "@/lib/environment.shared";

export type { AppEnvironment };

/**
 * Aktuelle Umgebung.
 * Reihenfolge: ausdrückliches `APP_ENV` → Hostname der Anfrage → Development.
 */
export function appEnvironment(request?: Request): AppEnvironment {
  const explicit = process.env["APP_ENV"];
  if (isAppEnvironment(explicit)) return explicit;

  if (request) {
    try {
      const forwarded = request.headers.get("x-forwarded-host");
      const host = forwarded?.split(",")[0]?.trim() || new URL(request.url).hostname;
      return resolveEnvironmentFromHost(host);
    } catch {
      // Unlesbare Anfrage: nicht als Production einordnen.
      return "staging";
    }
  }

  return process.env["NODE_ENV"] === "production" ? "staging" : "development";
}

/** Sind Live-Zahlungsschlüssel in dieser Instanz überhaupt vorhanden? */
export function livePaymentsConfigured(): boolean {
  return Boolean(process.env["STRIPE_LIVE_API_KEY"]);
}

/**
 * Welcher Zahlungsmodus ist für diese Umgebung zulässig?
 *
 * - Staging/Development: ausschließlich `sandbox`.
 * - Production: `live`, sobald Live-Schlüssel hinterlegt sind. Solange nur
 *   Testschlüssel existieren (aktueller Stand), bleibt `sandbox` zulässig,
 *   damit der laufende Betrieb nicht abbricht. Der Zustand wird protokolliert.
 */
export function allowedPaymentsModes(env: AppEnvironment): Array<"sandbox" | "live"> {
  if (env !== "production") return ["sandbox"];
  return livePaymentsConfigured() ? ["live"] : ["sandbox"];
}

/** Passt eine gemeldete Zahlungsumgebung zu dieser Instanz? */
export function paymentsModeAllowed(mode: "sandbox" | "live", env: AppEnvironment): boolean {
  return allowedPaymentsModes(env).includes(mode);
}

/** Erwarteter Zielmodus der Umgebung (unabhängig von vorhandenen Schlüsseln). */
export function targetPaymentsMode(env: AppEnvironment): "sandbox" | "live" {
  return expectedPaymentsMode(env);
}

/**
 * Dürfen Test-/Entwicklungsmechanismen (Testwerbung, Livetest-Messung,
 * Demo-Inhalte) in dieser Umgebung wirken?
 *
 * Production: nur wenn ausdrücklich per `ALLOW_TEST_FEATURES_IN_PRODUCTION=true`
 * freigegeben – so bleibt eine bewusste Admin-Erprobung möglich, ohne dass
 * Testlogik stillschweigend zur Produktionsvoraussetzung wird.
 */
export function testFeaturesAllowed(env: AppEnvironment): boolean {
  if (env !== "production") return true;
  return process.env["ALLOW_TEST_FEATURES_IN_PRODUCTION"] === "true";
}

/** Kurzer, geheimnisfreier Zustandsbericht für Protokolle und Diagnose. */
export function environmentReport(request?: Request): {
  environment: AppEnvironment;
  paymentsModes: Array<"sandbox" | "live">;
  targetPaymentsMode: "sandbox" | "live";
  livePaymentsConfigured: boolean;
  testFeaturesAllowed: boolean;
} {
  const environment = appEnvironment(request);
  return {
    environment,
    paymentsModes: allowedPaymentsModes(environment),
    targetPaymentsMode: targetPaymentsMode(environment),
    livePaymentsConfigured: livePaymentsConfigured(),
    testFeaturesAllowed: testFeaturesAllowed(environment),
  };
}
