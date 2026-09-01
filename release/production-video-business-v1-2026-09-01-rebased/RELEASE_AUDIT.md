# Release-Audit – Rebase auf den aktuellen Production-Stand

Durchführung: 2026-09-01
Quellpaket: `production-video-business-v1-2026-09-01` (Basis `cdf7634`, 57/57 OK)
Neue Baseline: aktueller Production-Stand
Production wurde während des Rebase **nicht** verändert.

## 1. Ausgangslage

Der Production-Preflight blockierte korrekt: 10 der 17 Baseline-Dateien des
Altpakets wichen ab, weil Production seit `cdf7634` weitere freigegebene
Releases enthält. Ein pfadgleiches Übernehmen hätte diese Fixes entfernt.

## 2. Rebase-Verfahren

Für jede Datei Drei-Wege-Zusammenführung (`git merge-file`):

- `base` = `rollback-production-original/` des Altpakets (`cdf7634`)
- `ours` = aktueller Production-Stand
- `theirs` = `target-production-files/` des Altpakets

Ergebnis: 18 Dateien automatisch zusammengeführt, 3 Konflikte manuell
entschieden (immer zugunsten des Production-Stands), 5 Paketdateien als
out-of-scope entfernt. Kein blindes Kopieren.

## 3. Erhaltene Production-Fixes (verifiziert im Zielstand)

| Fix | Nachweis im Zielstand |
| --- | --- |
| Long-Post-Fix Server | `titleField` in `post-moderation.functions.ts` vorhanden |
| Long-Post-Fix Client | `slice(0, 40)` in `CreatePostDialog.tsx` vorhanden |
| Rollentrennung | `role-scope.ts` unverändert; `role-visibility.ts` nicht übernommen |
| iPhone-Responsive | 22× `min-w-0` in `ProfilePanel.tsx` erhalten |
| Registrierungs-UX | `signupEntryCopy` erhalten, `accountTypeCopy` verworfen |
| Supabase-Typen | Production-Typstand als Basis (Creator/Business erhalten) |
| Campaign-Environment | `ad-plan.server.ts` nicht Teil des Releases |
| `business_plan_tier` | `business-campaigns.server.ts` nicht Teil des Releases |

## 4. Migrations-Gate (Production abgefragt)

| Migration | Struktur | Zustand |
| --- | --- | --- |
| 01 | `media_video_assets`, Typ `video_processing_status` | **fehlt vollständig** |
| 02 | `posts.video_kind` | **fehlt vollständig** |
| 03 | `REVOKE ALL … FROM anon` | folgt aus 01, **fehlt** |

Kein Teilzustand. Voraussetzungen vorhanden: `set_updated_at()` ✅,
`business_plan_tier()` ✅, `ad_campaigns` ✅. → alle 3 Migrationen notwendig.

## 5. Source-Diff (Production → rebasiertes Release)

- ADDED: 9
- CHANGED: 14
- CONFLICT: 3 (manuell entschieden, Production gewinnt)
- UNCHANGED: alles übrige

## 6. Security-Gate

- `media_video_assets`: RLS aktiv, Owner-SELECT nur `authenticated`,
  Schreiben ausschließlich `service_role`; Migration 03 entzieht `anon` alles.
- Schreibpfad: `video-upload.functions.ts` nutzt `requireSupabaseAuth` und
  schreibt erst nach Prüfung über `supabaseAdmin`; Storage-Pfad wird gegen
  `isOwnedVideoPath()` geprüft.
- Serverseitige Grenzen: 60 s (+Toleranz), 50 MB, MIME `video/mp4`,
  `video/quicktime`, `video/x-m4v`, Container-/Maß-/Rotationsprüfung.
- `business_plan_tier()` bleibt `service_role`-only; keine anon-/PUBLIC-Rechte.
- `increment_campaign_metric()` unverändert `service_role`-only.
- `user_roles` und `comments` werden nicht berührt (weder DDL noch Grants).
- Stripe unverändert; keine Secrets im Frontend.

## 7. Verify (rebasierter Stand, isolierte Arbeitskopie)

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | ✅ fehlerfrei |
| Lint (`src`, `tests`) | ✅ 0 Fehler (29 vorbestehende Warnungen) |
| Unit-Tests | ✅ 552/552 (27 Dateien), inkl. 4 Business-Onboarding und Video-Validierung |
| DB-Integrationstests | ✅ 68/68 |
| E2E (Playwright, lokale Vorschau) | ✅ 10 bestanden, 1 übersprungen |
| Build | ✅ erfolgreich |

Notwendige Formatierung: 3 neue Paketdateien entsprachen nicht den
Prettier-Regeln von Production (`business-role.functions.ts`, `video-file.ts`,
`video-upload.functions.ts`) – reine Zeilenumbrüche in Typ-Unions, keine Logik.

## 8. Bekannte Einschränkungen

- Zwei vorbestehende Prettier-Fehler in `remotion/` (`CreatorVoiceVideo.tsx`,
  `scenes/sellvoice/scenes.tsx`) bleiben unangetastet – out of scope.
- Video-spezifische DB-Integrationstests existieren nicht; die Absicherung
  erfolgt über Unit-Tests der Validierung und den Smoke-Test nach der Migration.
- Der E2E-Lauf erfolgte gegen die lokale Vorschau der Arbeitskopie
  (Production ist als E2E-Ziel gesperrt).
