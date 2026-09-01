# Y-Dude – Production Release: Video V1 + Business V1 (rebased)

Stand: 2026-09-01
Basis: **aktueller Production-Stand** (nicht `cdf7634`)
Scope: A) Video Upload V1, B) Business Optional Subscription + Kampagnen-UX

Dieses Paket ersetzt `production-video-business-v1-2026-09-01`. Jenes Paket war
auf dem veralteten Staging-HEAD `cdf7634` gebaut und hätte freigegebene
Production-Fixes entfernt (Long-Post-Fix, Rollentrennung über `role-scope.ts`,
iPhone-Responsive, `signupEntryCopy`, neuere generierte Typen).

## Inhalt

| Datei/Ordner | Inhalt |
| --- | --- |
| `RUNBOOK.md` | Ausführungsreihenfolge Production |
| `RELEASE_AUDIT.md` | Rebase-Audit, Migrations-Gate, Verify-Ergebnisse |
| `CHANGED_FILES.md` | ADDED / CHANGED / UNCHANGED / CONFLICT |
| `NOT_CHANGED.md` | ausdrücklich unveränderte Bereiche |
| `TEST_PLAN.md` | Verify- und Smoke-Test-Plan |
| `ROLLBACK.md` | Rückweg (nur Video-/Business-Änderungen) |
| `PRODUCTION_PROMPT.txt` | Ausführungsauftrag für die Migration |
| `PACKAGE_FILES.sha256` | Prüfsummen aller Paketdateien |
| `target-production-files/` | 23 Zieldateien (14 gemergt, 9 neu) |
| `rollback-production-original/` | 14 aktuelle Production-Originale |
| `patches/` | Diff Production → Zielstand |
| `migrations/` | 3 DB-Migrationen |

## Kurzfassung

- 3 Migrationen, alle in Production **vollständig fehlend** (kein Teilzustand).
- 23 Quelldateien: 9 neu, 14 zusammengeführt.
- Keine Änderung an `user_roles`, `comments`, Auth, Stripe, Feed-Ranking,
  Creator Subscription, SlangShot.
- Verify auf dem rebasierten Stand: Typecheck ✅, Lint ✅ (0 Fehler),
  552 Unit-Tests ✅, 68 DB-Tests ✅, 10 E2E ✅ (1 übersprungen), Build ✅.
