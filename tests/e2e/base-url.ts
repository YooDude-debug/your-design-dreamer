/**
 * Schutzschranke für Browsertests: Produktion ist als Testziel verboten.
 *
 * Erlaubt sind die lokale Vorschau und Staging-/Vorschauadressen. Wird ein
 * produktiver Host gesetzt, bricht der Testlauf sofort ab – so kann ein
 * Versehen in der Konfiguration keine echten Nutzerdaten berühren.
 */

import { PRODUCTION_HOSTS, resolveEnvironmentFromHost } from "../../src/lib/environment.shared";

export const DEFAULT_E2E_BASE_URL = "http://localhost:8080";

export function resolveE2EBaseUrl(raw?: string | null): string {
  const value = (raw ?? "").trim();
  if (!value) return DEFAULT_E2E_BASE_URL;

  let host: string;
  try {
    host = new URL(value).hostname;
  } catch {
    throw new Error(`E2E_BASE_URL ist keine gültige Adresse: ${value}`);
  }

  if (resolveEnvironmentFromHost(host) === "production") {
    throw new Error(
      `Browsertests gegen Production sind untersagt (${host}). Erlaubt: localhost oder Vorschau/Staging. ` +
        `Produktive Hosts: ${PRODUCTION_HOSTS.join(", ")}`,
    );
  }
  return value.replace(/\/$/, "");
}
