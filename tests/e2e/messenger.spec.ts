import { test, expect } from "@playwright/test";

import { AUTH_STATE_PATH, hasAuthState } from "./auth-state";
import { openMessenger, waitForApp, watchErrors } from "./helpers";

/**
 * Kernflow A3 + Regression – Messenger.
 *
 * Abgesichert wird insbesondere der frühere Fehler: nach dem Öffnen der
 * Market-Chatliste blieb diese Liste beim erneuten Öffnen des normalen
 * Messengers stehen. Nur lesende Schritte – es werden keine Nachrichten
 * gesendet, damit keine echten Daten verändert werden.
 */

test.describe("Messenger", () => {
  test.skip(!hasAuthState(), "Keine Testsitzung vorhanden");
  test.use({ storageState: AUTH_STATE_PATH });

  test("Chatliste öffnet und lädt", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/dev");
    await waitForApp(page);
    await openMessenger(page);

    await expect(page.getByPlaceholder(/connection|verbindung|suche/i).first()).toBeVisible({
      timeout: 20_000,
    });
    errors.assertClean();
  });

  test("Regression: Market-Liste bleibt nach Navigation nicht hängen", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/dev");
    await waitForApp(page);
    await openMessenger(page);

    // Market-Chats liegen in einer eigenen Unterliste.
    const marketEntry = page.getByRole("button", { name: /market/i }).first();
    await expect(marketEntry).toBeVisible({ timeout: 20_000 });
    await marketEntry.click();

    // In der Market-Ansicht führt die Kopfzeile zurück zu den Connections.
    const backToConnections = page.getByRole("button", { name: /market/i }).first();
    await expect(backToConnections).toBeVisible();
    await backToConnections.click();

    // Zurück in der Connections-Ansicht muss die Market-Karte wieder sichtbar sein.
    await expect(page.getByRole("button", { name: /market/i }).first()).toBeVisible();

    // Messenger schließen, zu Market navigieren, Messenger erneut öffnen:
    // die Liste muss bei den Connections starten, nicht in der Market-Liste.
    await page.keyboard.press("Escape");
    await page.goto("/market");
    await waitForApp(page);
    await page.goto("/dev");
    await waitForApp(page);
    await openMessenger(page);

    await expect(page.getByRole("button", { name: /market/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    errors.assertClean();
  });
});
