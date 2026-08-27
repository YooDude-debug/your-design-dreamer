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

step "Tests"
bun run test

printf '\n\033[32mFreigabe-Gate bestanden.\033[0m\n'
