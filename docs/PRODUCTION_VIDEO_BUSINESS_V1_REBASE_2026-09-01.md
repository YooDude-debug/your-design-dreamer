# Y-Dude – Release-Rebase: Video V1 + Business V1

Datum: 2026-09-01
Auftrag: Rebase des blockierten Release-Pakets auf den aktuellen Production-Stand
Ergebnis: **rebasiertes Paket erstellt und vollständig verifiziert – Production
wurde nicht verändert**

## Ausgangslage

Der Preflight (`docs/PRODUCTION_VIDEO_BUSINESS_V1_PREFLIGHT_2026-09-01.md`) hatte
das Paket `production-video-business-v1-2026-09-01` blockiert: es war auf dem
Staging-Commit `cdf7634` gebaut, während Production inzwischen weitere
freigegebene Releases enthält. 10 von 17 Baseline-Dateien wichen ab.

## Vorgehen

Drei-Wege-Zusammenführung pro Datei (`git merge-file`) mit
Basis = Altpaket-Rollback (`cdf7634`), „ours“ = aktueller Production-Stand,
„theirs“ = Altpaket-Zielstand.

- 18 Dateien automatisch zusammengeführt
- 3 Konflikte manuell entschieden – immer zugunsten von Production
  (`auth.tsx` behält `signupEntryCopy`, `creator.tsx` und
  `CreatorSlangTagsDialog.tsx` fallen ganz aus dem Release)
- 5 Paketdateien als out-of-scope entfernt (Rollenanzeige – in Production bereits
  neuer über `role-scope.ts` gelöst)

Erhalten geblieben: Long-Post-Fix (Client + Server), Rollentrennung,
iPhone-Responsive-Fix, Registrierungs-UX, Campaign-Environment-Fix und der
privilegierte `business_plan_tier`-Pfad.

## Zielstand

23 Dateien: 9 neu, 14 zusammengeführt. Drei DB-Migrationen, in Production alle
vollständig fehlend (kein Teilzustand): `media_video_assets` + Typ
`video_processing_status`, `posts.video_kind`, `REVOKE ALL … FROM anon`.

## Verifikation (isolierte Arbeitskopie)

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | ✅ |
| Lint (`src`, `tests`) | ✅ 0 Fehler |
| Unit-Tests | ✅ 552/552 |
| DB-Integrationstests | ✅ 68/68 |
| E2E (Playwright, lokale Vorschau) | ✅ 10 bestanden, 1 übersprungen |
| Build | ✅ |

## Ergebnis

- `release/production-video-business-v1-2026-09-01-rebased/` (49 Dateien,
  Prüfsummen vollständig OK)
- `release/production-video-business-v1-2026-09-01-rebased.tar.gz`
  SHA-256 `e513f74cdcb42d6ee2ebba17355bbbf631466a8bf3490ab7f41cecf4515dd153`
- Enthält README, RUNBOOK, RELEASE_AUDIT, CHANGED_FILES, NOT_CHANGED, TEST_PLAN,
  ROLLBACK, PRODUCTION_PROMPT, `target-production-files/` (23),
  `rollback-production-original/` (14 aktuelle Production-Originale),
  `patches/` und `migrations/` (3).

Die eigentliche Production-Migration wurde **nicht** ausgeführt; sie erfordert
eine separate Freigabe und folgt dann dem Runbook des rebasierten Pakets.
