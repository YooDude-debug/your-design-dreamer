import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Testlauf des Sicherungsnetzes (Phase 1).
 *
 * Umfang: reine Logik- und Sicherheitstests ohne Browser und ohne Zugriff auf
 * die Produktionsdatenbank. Tests laufen in Node, damit Server-Module
 * (Webhook-Signatur, Ranking, Push-Texte) direkt geprüft werden können.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Datenbank-Integration läuft getrennt (bun run test:db), damit der
    // Standardlauf ohne Datenbankzugang funktioniert.
    exclude: ["tests/integration/**"],
    globals: false,
    passWithNoTests: false,
  },
});
