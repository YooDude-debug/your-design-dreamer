import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";

import { AUTH_STATE_PATH } from "./auth-state";
import { resolveE2EBaseUrl } from "./base-url";

/**
 * Bereitet die Anmeldung für die Browsertests vor.
 *
 * Es werden keine Zugangsdaten im Code gehalten. Verwendet wird die von der
 * Testumgebung bereitgestellte Sitzung (LOVABLE_BROWSER_SUPABASE_*). Fehlt sie,
 * wird kein Zustand geschrieben – die angemeldeten Tests überspringen sich
 * dann selbst, statt zu scheitern.
 *
 * Es werden bewusst keine Geheimnisse ausgegeben.
 */
export default function globalSetup() {
  const storageKey = process.env["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"];
  const session = process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"];
  rmSync(AUTH_STATE_PATH, { force: true });

  if (!storageKey || !session) {
    console.log("[e2e] Keine Testsitzung vorhanden – angemeldete Tests werden übersprungen.");
    return;
  }

  const origin = resolveE2EBaseUrl(process.env["E2E_BASE_URL"]);
  mkdirSync(dirname(AUTH_STATE_PATH), { recursive: true });
  writeFileSync(
    AUTH_STATE_PATH,
    JSON.stringify(
      {
        cookies: [],
        origins: [{ origin, localStorage: [{ name: storageKey, value: session }] }],
      },
      null,
      2,
    ),
  );
  console.log("[e2e] Testsitzung vorbereitet.");
}
