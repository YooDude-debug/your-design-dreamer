import { test, expect } from "@playwright/test";

import { hasAuthState, AUTH_STATE_PATH } from "./auth-state";
import { waitForApp, watchErrors } from "./helpers";

/**
 * Kernflow A1 – Anmeldung, Sitzung, geschützte Bereiche.
 *
 * Ohne Anmeldung: Landingpage, rechtliche Seiten, Schutz geschützter Routen.
 * Mit vorbereiteter Testsitzung: Sitzungswiederherstellung nach Neuladen.
 */

test.describe("Öffentlicher Zugang", () => {
  test("Landingpage lädt mit Login und Registrierung", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/");
    await waitForApp(page);
    await expect(page.getByRole("link", { name: /login/i }).first()).toBeVisible();
    await expect(page.getByText(/Y-Dude/i).first()).toBeVisible();
    errors.assertClean();
  });

  test("rechtliche Seiten sind erreichbar", async ({ page }) => {
    for (const path of ["/impressum", "/datenschutz", "/agb"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
      await waitForApp(page);
    }
  });

  test("geschützte Route leitet ohne Anmeldung zur Anmeldeseite", async ({ page }) => {
    await page.goto("/dev");
    await page.waitForURL(/\/auth/, { timeout: 30_000 });
    await waitForApp(page);
    expect(page.url()).toContain("/auth");
  });
});

test.describe("Angemeldete Sitzung", () => {
  test.skip(!hasAuthState(), "Keine Testsitzung vorhanden");
  test.use({ storageState: AUTH_STATE_PATH });

  test("Sitzung wird nach Neuladen wiederhergestellt", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/dev");
    await waitForApp(page);
    expect(page.url()).toContain("/dev");

    await page.reload();
    await waitForApp(page);
    expect(page.url(), "Neuladen darf nicht abmelden").toContain("/dev");
    errors.assertClean();
  });
});
