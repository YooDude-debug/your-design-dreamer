import { test, expect } from "@playwright/test";

import { AUTH_STATE_PATH, hasAuthState } from "./auth-state";
import { waitForApp, watchErrors } from "./helpers";

/**
 * Kernflow A4 – Market (ausschließlich lesend).
 *
 * Öffnen, Kategorie wählen, Artikel öffnen, zurück. Der Bezahlvorgang wird
 * bewusst NICHT ausgelöst: die Umgebung teilt die Datenbank mit dem
 * Publikumsbetrieb, deshalb werden keine Transaktionen erzeugt. Der
 * Sandbox-Zwang ist stattdessen durch Integrations- und Logiktests belegt.
 */

test.describe("Market", () => {
  test.skip(!hasAuthState(), "Keine Testsitzung vorhanden");
  test.use({ storageState: AUTH_STATE_PATH });

  test("Market öffnet, Kategorien und Artikel sind erreichbar", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/market");
    await waitForApp(page);

    const categories = page.getByRole("button", { name: /kategorie|categor/i }).first();
    if (await categories.count()) {
      await categories.click();
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape");
    }

    const item = page.locator('a[href^="/market/"]').first();
    const found = await item.count();
    test.skip(found === 0, "Keine Market-Artikel vorhanden");

    await item.click();
    await page.waitForURL(/\/market\//, { timeout: 30_000 });
    await waitForApp(page);

    await page.goBack();
    await waitForApp(page);
    expect(page.url()).toContain("/market");
    errors.assertClean();
  });

  test("eigene Artikel-Übersicht lädt", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/market/mine");
    await waitForApp(page);
    expect(page.url()).toContain("/market");
    errors.assertClean();
  });
});
