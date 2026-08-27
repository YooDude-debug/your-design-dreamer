import { expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Gemeinsame Hilfen für die Browsertests.
 *
 * Ziel: möglichst wenig Kopplung an interne Umsetzungsdetails. Es werden
 * Rollen, Beschriftungen und Adressen genutzt, keine CSS-Klassen.
 */

/** Fehlermuster, die als echte Regression gelten (u. a. historischer Serverfunktionsfehler). */
const FATAL_PATTERNS = [
  /server function info not found/i,
  /invalid server function id/i,
  /server function .* not found/i,
  /useSocial must be used within/i,
  /Minified React error/i,
];

export type ErrorWatcher = {
  /** Wirft, wenn während des Ablaufs ein schwerer Fehler auftrat. */
  assertClean(): void;
  messages(): string[];
};

/** Sammelt Konsolen- und Seitenfehler eines Ablaufs. */
export function watchErrors(page: Page): ErrorWatcher {
  const found: string[] = [];
  const record = (text: string) => {
    if (FATAL_PATTERNS.some((re) => re.test(text))) found.push(text.slice(0, 300));
  };
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error") record(m.text());
  });
  page.on("pageerror", (e) => record(String(e?.message ?? e)));
  page.on("response", (r) => {
    if (r.status() >= 500) found.push(`HTTP ${r.status()} ${r.url().slice(0, 200)}`);
  });
  return {
    assertClean() {
      expect(found, `Schwere Fehler im Ablauf:\n${found.join("\n")}`).toEqual([]);
    },
    messages: () => [...found],
  };
}

/**
 * Wartet, bis die App gerendert hat (Text im Body vorhanden).
 *
 * Ruhephase im Netzwerk wird nur kurz abgewartet: Live-Verbindungen und
 * Wiederholversuche externer Dienste können dauerhaft aktiv bleiben.
 */
export async function waitForApp(page: Page) {
  await expect(page.locator("body")).not.toHaveText("", { timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}


/** Schnellzugriff-Leiste unter dem Profilblock. */
export function quickBar(page: Page) {
  return page.locator('section[aria-label="Schnellzugriff"]');
}

/** Öffnet den Messenger über den Schnellzugriff. */
export async function openMessenger(page: Page) {
  const bar = quickBar(page);
  await expect(bar).toBeVisible({ timeout: 30_000 });
  await bar.getByRole("button").first().click();
}
