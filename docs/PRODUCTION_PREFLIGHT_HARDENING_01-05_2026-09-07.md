# Y-DUDE PRODUCTION – PREFLIGHT: MIGRATIONSPAKET HARDENING #1–#5

Datum: 2026-09-07 · Modus: read-only Vorprüfung · Ziel: Prüfen, ob
`migration/production/2026-09-07-hardening-01-05/` sicher nach Production übertragbar ist.

## ERGEBNIS

🔴 **PREFLIGHT STOPP** – das Migrationspaket ist im Production-Projekt **nicht vorhanden**.
Weder Paketstruktur, MANIFEST, FILES, PATCH, CHECKSUMS, RUNBOOK, ROLLBACK noch die vier
DB-Migrationen liegen vor. Die geforderte Prüfung der 29 Codedateien, der Prüfsumme
`d219e5b3…c492e` und der DB-Migrationen ist damit **nicht durchführbar** – nicht „unauffällig“,
sondern nicht beurteilbar.

## 1. Production-Baseline (tatsächlich gemessen)

| Punkt | Stand |
| --- | --- |
| Aktuelle Revision (Projekt-Historie) | `b24d1123` (davor `c78eb7d0`, `832c6d51`, `03026119`, `27d03a50`) |
| Drizzle-Migrationsstand | letzte Datei `0031_age_status_functions.sql` |
| Supabase-Migrationsverzeichnis | 231 Dateien |
| Build-Status | `build OK` (Build-Log 2026-09-07T10:06:28Z), ohne Änderung geprüft |
| Arbeitsbaum | keine offenen Änderungen |
| Environment/Config | Cloud-Backend aktiv, eine Instanz für Preview und Production (bekannt aus Audit 2026-09-06) |
| Staging-Referenzen `ebdf3bd` / `a1c4a66` | in der Production-Historie **nicht auffindbar** |

Production wurde ausdrücklich nicht als identisch mit Staging angenommen; ein Vergleich ist ohne
Paket bzw. ohne Zugriff auf die genannten Staging-Revisionen nicht möglich.

## 2. Paketprüfung

| Artefakt | Status |
| --- | --- |
| Verzeichnis `migration/production/2026-09-07-hardening-01-05/` | FEHLT |
| MANIFEST / FILES / PATCH | FEHLT |
| CHECKSUMS, Gegenprüfung `d219e5b3…c492e` | NICHT MÖGLICH |
| RUNBOOK / ROLLBACK | FEHLT |
| SECURITY_/E2E_/PERFORMANCE_CHECKLIST | FEHLT |
| 4 DB-Migrationen | FEHLEN |

Im Uploads-Bereich liegen ältere Übergabepakete (u. a. `staging-to-production-market-slangtag-2026-09-07.tar.gz`,
`staging-to-production-2026-09-06.tar.gz`), aber **kein** Hardening-#1–#5-Paket vom 2026-09-07.

## 3. Codevergleich der 29 Dateien

NICHT DURCHFÜHRBAR. Ohne MANIFEST/FILES existiert keine belastbare Zuordnung, welche 29 Dateien
(davon 2 neu) betroffen sind. Es wurde bewusst keine Datei geraten, keine verglichen und keine geändert.

## 4. DB-Preflight der vier Migrationen

NICHT DURCHFÜHRBAR – die Migrationsdateien liegen nicht vor. Read-only erhobener Ist-Zustand der
im Auftrag ausdrücklich genannten Funktion:

| Merkmal | Ist-Zustand in Production |
| --- | --- |
| Funktion | `public.promote_exclusive_drops(_user_id uuid)` |
| SECURITY DEFINER | ja |
| `search_path` | `search_path=public` (fest gesetzt) |
| EXECUTE-Rechte | `authenticated`, `service_role`, `postgres` |
| `anon` EXECUTE | **nicht vorhanden** (bereits gesperrt) |

Ob die geplanten Migrationen diesen Zustand nur bestätigen, weiter verschärfen oder verändern
würden, ist ohne die SQL-Dateien nicht beurteilbar. Es wurden keine Grants, Funktionen oder
Policies angefasst.

## 5. Security-Konfliktprüfung

Der bestehende Production-Sicherheitsstand (anon-Sperren auf `promote_exclusive_drops` und den am
2026-09-06 gehärteten Funktionen, RLS auf allen öffentlichen Tabellen, zentrale
SECURITY-DEFINER-Prüffunktionen) ist dokumentiert. Eine Kompatibilitätsaussage gegenüber den in
Staging getesteten Fixes ist ohne Paketinhalt nicht möglich. Es wurde nichts „gelöst“, nur festgestellt.

## 6. Scope-Kontrolle

Der zulässige Scope (#1 Security, #2 Quality, #3 E2E Market, #4 Messenger Read Status Performance,
#5 Network Requests) kann nicht gegen den Paketinhalt geprüft werden. Ausschlüsse (#6 Globe, Stripe,
Checkout, Zahlungen, Versand, Tickets/Pickup-Codes, neue Market-Funktionen, neue DB-Struktur)
bleiben unverändert gültig; in Production wurde in diesem Preflight nichts hinzugefügt.

## 7. Rollback-Prüfung

NICHT BEURTEILBAR. Es fehlen ROLLBACK-Dokument und Baseline-Referenz (`a1c4a66` ist in Production
nicht auffindbar). Generell gilt: ein Rollback von Funktions-/Grant-Migrationen ist nur dann sicher
automatisierbar, wenn das Paket die vorherigen Funktionsdefinitionen und Grant-Zustände wörtlich
mitliefert. Ohne diesen Nachweis ist der Rollback-Weg als **nicht ausreichend abgesichert** zu bewerten.

## 8. Benötigte Migration (Voraussetzungen für einen erneuten Preflight)

1. Vollständiges Paket `2026-09-07-hardening-01-05/` bereitstellen (Archiv-Upload genügt).
2. MANIFEST + FILES mit exakt den 29 Dateipfaden und Markierung der 2 neuen Dateien.
3. CHECKSUMS mit vollständiger SHA-256 zur Gegenprüfung gegen `d219e5b3…c492e`.
4. Die 4 DB-Migrationen als SQL im Klartext, inklusive vorherigem Zustand pro Funktion/Grant.
5. ROLLBACK mit Baseline-Referenz, die in Production auflösbar ist.

## 9. Nach einer späteren, freigegebenen Migration erforderliche Prüfungen

Typecheck · vollständige Testsuite · DB-Tests · Lint (Referenzstand: bekannt rot, Vergleich nur auf
geänderten Dateien) · Production-Build · Security-Smoke (anon-EXECUTE, RLS unverändert) ·
Registration/Turnstile-Smoke · Messenger-E2E · Market-E2E · Performance-Smoke (Requestzahl,
Lesestatus-Dauer) — jeweils vor Freigabe, mit dokumentiertem Ergebnis.

## 10. Empfehlung

Nicht migrieren. Paket nachliefern, dann Preflight vollständig wiederholen.

## Bestätigung

- Es wurde KEIN Code geändert.
- Es wurde KEINE Datenbank geändert (nur lesende Abfragen).
- Es wurde NICHT deployed.
- Es wurden KEINE Production-Daten verändert.
- Es wurden KEINE zusätzlichen Änderungen vorgenommen.

**STATUS: 🔴 PREFLIGHT STOPP**
