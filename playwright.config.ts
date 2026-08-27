import { defineConfig, devices } from "@playwright/test";

/**
 * Y-Dude – Browser-Ebene der Testpyramide (Smoke / Critical Path).
 *
 * Grundsätze:
 *  - Niemals gegen die Produktionsadresse. Standardziel ist die lokale
 *    Entwicklungsvorschau (http://localhost:8080). Ein anderes Ziel kann über
 *    E2E_BASE_URL gesetzt werden, produktive Hosts werden abgelehnt
 *    (siehe tests/e2e/base-url.ts).
 *  - Klein und stabil: wenige, hochwertige Nutzerpfade statt vieler Tests.
 *  - Semantische Selektoren (Rollen, Beschriftungen, Links) statt
 *    CSS-Klassen, damit Designänderungen keine Tests brechen.
 */

import { resolveE2EBaseUrl } from "./tests/e2e/base-url";

const baseURL = resolveE2EBaseUrl(process.env["E2E_BASE_URL"]);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.artifacts",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: process.env["CI"] ? [["list"], ["json", { outputFile: "tests/e2e/.artifacts/report.json" }]] : [["list"]],
  use: {
    baseURL,
    viewport: { width: 1280, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: baseURL.includes("localhost")
    ? {
        command: "bun run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
});
