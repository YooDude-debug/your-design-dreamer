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
    await page.goto("/feed");
    await waitForApp(page);

    // Feed-Umschalter (Reiter „FEED“) ist der stabile Anker des Feeds;
    // zusätzlich muss mindestens ein Beitrag tatsächlich geladen sein.
    const feedTab = page.getByRole("button", { name: /^feed$/i }).first();
    await expect(feedTab).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("article[data-post-id]").first()).toBeVisible({ timeout: 30_000 });

    const before = await page.evaluate(() => document.body.innerText.length);
    expect(before, "Feedinhalt vorhanden").toBeGreaterThan(200);

    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(1200);
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(1200);

    await page.reload();
    await waitForApp(page);
    await expect(page.getByRole("button", { name: /^feed$/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("article[data-post-id]").first()).toBeVisible({ timeout: 30_000 });
    errors.assertClean();
  });

  test("Beitragsdetailseite öffnet und Rückweg führt zum Feed", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/feed");
    await waitForApp(page);

    // Der Feed verlinkt Beiträge nicht mehr per <a href="/p/…">; die
    // Detailseite /p/$postId existiert weiterhin (u. a. aus den Creator-Stats).
    // Daher: echte Beitrags-ID aus dem Feed lesen und die Detailseite direkt öffnen.
    const article = page.locator("article[data-post-id]").first();
    await expect(article).toBeVisible({ timeout: 30_000 });
    const postId = await article.getAttribute("data-post-id");
    expect(postId).toBeTruthy();

    await page.goto(`/p/${postId}`);
    await page.waitForURL(/\/p\//, { timeout: 30_000 });
    await waitForApp(page);

    await page.goBack();
    await waitForApp(page);
    expect(page.url()).toContain("/feed");
    errors.assertClean();
  });
});
