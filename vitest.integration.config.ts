import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Integrationsebene der Testpyramide.
 *
 * Diese Tests sprechen mit der echten Datenbank – aber ausschließlich lesend
 * (siehe tests/integration/db-client.ts) und über den Zugang der
 * Entwicklungs-/Vorschauumgebung. Es werden keine Daten geschrieben, keine
 * Testkonten erzeugt und keine Geheimnisse ausgegeben.
 *
 * Bewusst getrennt vom Standardlauf (`bun run test`), damit das bestehende
 * CI-Gate nicht von der Erreichbarkeit der Datenbank abhängt.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: false,
    testTimeout: 30_000,
    passWithNoTests: false,
  },
});
