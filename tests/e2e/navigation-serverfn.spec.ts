import { test } from "@playwright/test";

import { AUTH_STATE_PATH, hasAuthState } from "./auth-state";
import { waitForApp, watchErrors } from "./helpers";

/**
 * Regression – Serverfunktionen und Navigation.
 *
 * Der historische Fehler „Invalid server function ID“ /
 * „Server function info not found“ trat nach Auslieferung bei Navigation
 * zwischen Bereichen auf. Dieser Test läuft die wichtigsten Routen ab und
 * lässt den Testlauf scheitern, sobald ein solcher Fehler oder ein HTTP 500
 * auftritt.
 */

const ROUTES = ["/dev", "/market", "/arena", "/globe", "/posts", "/channels"];

test.describe("Navigation über Kernbereiche", () => {
  test.skip(!hasAuthState(), "Keine Testsitzung vorhanden");
  test.use({ storageState: AUTH_STATE_PATH });

  test("keine Serverfunktions- oder Serverfehler auf den Kernrouten", async ({ page }) => {
    const errors = watchErrors(page);
    for (const route of ROUTES) {
      await page.goto(route);
      await waitForApp(page);
      await page.waitForTimeout(800);
    }
    // Rückweg über die Browsergeschichte deckt Client-Navigation mit ab.
    await page.goBack();
    await waitForApp(page);
    errors.assertClean();
  });
});
