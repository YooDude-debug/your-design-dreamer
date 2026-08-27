import { test, expect } from "@playwright/test";

import { AUTH_STATE_PATH, hasAuthState } from "./auth-state";
import { waitForApp, watchErrors } from "./helpers";

/**
 * Kernflow A2 – Feed.
 *
 * Nur lesende Schritte: öffnen, laden, scrollen, Beitrag öffnen, zurück,
 * neu laden. Es werden keine Beiträge erstellt, geliked oder gelöscht.
 */

test.describe("Feed", () => {
  test.skip(!hasAuthState(), "Keine Testsitzung vorhanden");
  test.use({ storageState: AUTH_STATE_PATH });

  test("Feed lädt Beiträge, scrollt und lässt sich neu laden", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/dev");
    await waitForApp(page);

    // Feed-Umschalter (Global / Channels) ist der stabile Anker des Feeds.
    await expect(page.getByText(/Global/i).first()).toBeVisible({ timeout: 30_000 });

    const before = await page.evaluate(() => document.body.innerText.length);
    expect(before, "Feedinhalt vorhanden").toBeGreaterThan(200);

    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(1200);
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(1200);

    await page.reload();
    await waitForApp(page);
    await expect(page.getByText(/Global/i).first()).toBeVisible({ timeout: 30_000 });
    errors.assertClean();
  });

  test("Beitragsdetailseite öffnet und Rückweg führt zum Feed", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/dev");
    await waitForApp(page);

    const postLink = page.locator('a[href^="/p/"]').first();
    const count = await postLink.count();
    test.skip(count === 0, "Keine Beiträge im Feed der Testsitzung");

    await postLink.click();
    await page.waitForURL(/\/p\//, { timeout: 30_000 });
    await waitForApp(page);

    await page.goBack();
    await waitForApp(page);
    expect(page.url()).toContain("/dev");
    errors.assertClean();
  });
});
