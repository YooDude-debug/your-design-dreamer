/**
 * Umgebungserkennung (Development / Staging / Production).
 *
 * Einzige Quelle der Wahrheit für die Frage „welche Umgebung läuft hier?“.
 * Bewusst ohne Abhängigkeiten, damit Browser, Server und Tests dieselbe
 * Einordnung verwenden.
 *
 * Zuordnung nach Hostname:
 *  - production : y-dude.com, www.y-dude.com, y-dude.lovable.app
 *  - staging    : Vorschau-Adressen (*-dev.lovable.app, id-preview--*.lovable.app,
 *                 project--*.lovable.app)
 *  - development: localhost / 127.0.0.1 / *.local
 *
 * Ein ausdrücklich gesetztes `APP_ENV` (Server) hat immer Vorrang.
 */

export type AppEnvironment = "development" | "staging" | "production";

export const APP_ENVIRONMENTS: readonly AppEnvironment[] = [
  "development",
  "staging",
  "production",
] as const;

/** Produktive Hostnamen. Neue Domains müssen hier ergänzt werden. */
export const PRODUCTION_HOSTS = ["y-dude.com", "www.y-dude.com", "y-dude.lovable.app"] as const;

export function isAppEnvironment(value: unknown): value is AppEnvironment {
  return typeof value === "string" && (APP_ENVIRONMENTS as readonly string[]).includes(value);
}

/** Einordnung eines Hostnamens. Unbekannte Hosts gelten als Staging (nie als Production). */
export function resolveEnvironmentFromHost(hostname: string | null | undefined): AppEnvironment {
  const host = (hostname ?? "").toLowerCase().replace(/:\d+$/, "").trim();
  if (!host) return "development";

  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local")) {
    return "development";
  }
  if ((PRODUCTION_HOSTS as readonly string[]).includes(host)) return "production";

  // Vorschau- und Testadressen sind immer Staging – auch neue, unbekannte.
  return "staging";
}

/** Läuft der echte Publikumsbetrieb? */
export function isProduction(env: AppEnvironment): boolean {
  return env === "production";
}

/**
 * Zahlungsmodus, der zu einer Umgebung gehört.
 * Staging und Development dürfen ausschließlich den Testmodus verwenden.
 */
export function expectedPaymentsMode(env: AppEnvironment): "sandbox" | "live" {
  return env === "production" ? "live" : "sandbox";
}
