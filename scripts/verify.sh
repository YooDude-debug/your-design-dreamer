#!/usr/bin/env bash
# Y-Dude – Freigabe-Gate vor einer Veröffentlichung.
#
# Prüft in einem Durchlauf: Typsicherheit, Lint-Regeln und die komplette
# Testsuite. Bricht beim ersten Fehler ab, damit kein ungeprüfter Stand
# veröffentlicht wird.
set -euo pipefail

cd "$(dirname "$0")/.."

step() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

step "Typprüfung"
bunx tsc --noEmit

step "Lint"
bun run lint

step "Tests (Logik)"
bun run test

# Datenbank- und Browsertests sind langsamer und brauchen Umgebung
# (Datenbankzugang bzw. laufender Entwicklungsserver). Sie laufen im Gate mit,
# sobald die Voraussetzungen vorhanden sind, und werden sonst übersprungen.
if [ "${VERIFY_SKIP_DB:-0}" != "1" ] && [ -n "${PGHOST:-}" ]; then
  step "Tests (Datenbank-Integration)"
  bun run test:db
else
  step "Tests (Datenbank-Integration) – übersprungen"
fi

if [ "${VERIFY_SKIP_E2E:-0}" != "1" ] && curl -sf -o /dev/null "${E2E_BASE_URL:-http://localhost:8080}/"; then
  step "Tests (Browser/E2E)"
  bun run test:e2e
else
  step "Tests (Browser/E2E) – übersprungen"
fi

printf '\n\033[32mFreigabe-Gate bestanden.\033[0m\n'

