# Production – Final Preflight Hardening #1–#5 (V3)

- Datum: 2026-09-07
- Art: **read-only Preflight**. Keine Migration, kein Deployment, keine DB-, Grant-, Policy-, Tabellen- oder Datenänderung.
- Ergebnis: **🟢 FINAL PREFLIGHT PASS** – V3 ist für den anschließenden kontrollierten Production-Migrationslauf freigegeben. Es wurde **nichts** ausgeführt.

## 1. V3-Paket

| Prüfpunkt | Erwartung | Ergebnis |
|---|---|---|
| Archiv-SHA-256 | `ae249dbc4c182b715c646968edd10230a0ef7ddc77a0a1c47f923790e573eddd` | **exakt identisch** (gemessen auf `user-uploads://2026-09-07-hardening-01-05-v3.tar.gz`) |
| Archiv lesbar | ja | ja, entpackt read-only nach `/tmp/pf4` |
| Archiv-Einträge | 106 | **106** |
| Paketdateien | 76 | **76** (77 Dateien inkl. `CHECKSUMS.txt` selbst) |
| CHECKSUMS | 76/76 gültig | **76/76 OK**, `sha256sum -c` Exit 0, keine Abweichung |
| `.git`-Metadaten | keine | keine gefunden |
| Secrets | keine | Suche nach `sb_secret_`, Service-Role-Key, Private Keys, `sk_live`, `password =`: keine Treffer |

Enthaltene Artefakte vollständig: `MANIFEST.md`, `FILES.md`, `CHANGELOG.md`, `README.md`, `RUNBOOK.md`, `ROLLBACK.md`, `SECURITY_CHECKLIST.md`, `E2E_CHECKLIST.md`, `PERFORMANCE_CHECKLIST.md`, `CHECKSUMS.txt`, `PATCH/` (2 Dateien), `migrations/` (5 SQL), `target-files/` (30 Dateien), `rollback-baseline/`.

## 2. Production-Baseline (read-only)

| Angabe | Wert |
|---|---|
| Production HEAD | **`37a3c973`** – „Evidenz-Belege erstellt“, 2026-09-07 10:47:00 +0000 |
| Arbeitsbaum | sauber (`git status --porcelain` leer) |
| Drizzle-Migrationsstand | **0031**, 32 SQL-Dateien, letzte `0031_age_status_functions.sql` |
| Supabase-Migrationsdateien | **231** |
| Build | **build OK** (`build 2026-09-07T11:12:55Z`) |
| Anwendungscode | unverändert gegenüber HEAD |

## 3. Conflict-Merge (vier Dateien)

Geprüft wurde der **verbindliche Merge-Patch** `docs/patches/2026-09-07-hardening-01-05-conflict-merge.patch`
(SHA-256 `18615144180c4941078083725beac757c25ffdfc75d2032dd327e413021540b4`, identisch mit
`PATCH/2026-09-07-hardening-01-05-conflict-merge.patch` im V3-Paket).

- Isolierter `patch -p1 --dry-run` gegen die aktuellen Production-Dateien: **Exit 0, alle vier Dateien sauber**.
- Zusätzlich wurde das Paket-`changes.patch` (30 Dateien) isoliert getestet: **26 Dateien + 2 neue Dateien sauber**, ausschließlich `eslint.config.js` schlägt fehl (Hunk #1). Das ist genau der bereits dokumentierte Konflikt, **kein neuer**.

| Datei | Production-Stand | Paket-Stand (`target-files`) | Auflösung im Merge-Patch |
|---|---|---|---|
| `src/lib/data.tsx` | ohne Bibliotheksrechte | führt `slang_tag_library`/`libraryTagIds` ein | nur der #5-Performance-Anteil (`loadedProfileIdsRef`, `inFlightRef`); **Library-Rechte werden nicht eingeführt** |
| `src/components/AdSlider.tsx` | lokalisierte `moreFor(company)`-CTAs (SEO) | entfernt `moreFor` und fällt auf `more` zurück | **SEO-CTAs bleiben erhalten**, nur ungenutzter `Pause`-Import entfernt |
| `src/routes/_authenticated/dev.tsx` | Feed-Auswahlmenü entfernt | bringt `feedMenuOpen`/Dropdown zurück | **Menü bleibt entfernt**, nur ungenutzter `SlangTag`-Typimport entfernt |
| `eslint.config.js` | Production-Ignore-Liste | zusätzliche `release`/`migration`-Ausnahmen | **Production-Ignore-Liste bleibt**; nur `@typescript-eslint/no-unused-vars` von `off` auf `warn` – **keine Regel abgeschwächt** |

Wichtig für den späteren Lauf: `target-files/` für diese vier Dateien **nicht kopieren**; ausschließlich der Merge-Patch ist verbindlich.

## 4. DB-Baseline

Datei: `migration/production/2026-09-07-hardening-01-05/rollback-production-db-baseline.sql`
SHA-256 **`1d0b1fa7a31e25e10fcb2c224c055638c2fec753377f4eb01e8288b4356b4745`** – exakt wie erwartet und
byte-identisch mit `rollback-baseline/rollback-production-db-baseline.sql` im V3-Paket. **Nicht ausgeführt.**

Gegenprüfung der drei ersetzten Funktionen (`md5(pg_get_functiondef)`), live gemessen:

| Funktion | Baseline-MD5 | Production-IST | Übereinstimmung |
|---|---|---|---|
| `promote_exclusive_drops(uuid)` | `8e2bf3f21548e5ee43826de7129ad871` | `8e2bf3f21548e5ee43826de7129ad871` | **JA** |
| `market_start_transaction(...)` | `20a5b63e909b8832fc55cd63ecc1c0f6` | `20a5b63e909b8832fc55cd63ecc1c0f6` | **JA** |
| `mark_conversation_read(uuid)` | `0c275ebceb504a44cb37e586fdfbd7b8` | `0c275ebceb504a44cb37e586fdfbd7b8` | **JA** |

Baseline ist damit **kompatibel mit dem aktuellen Production-Ist-Zustand**.

## 5. Die sechs Guard-Funktionen – Ist-Zustand (live gemessen)

`proacl` für alle sechs identisch:
`{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`

| Funktion | PUBLIC | anon | authenticated | service_role | `prosecdef` | `search_path` | Volatility |
|---|---|---|---|---|---|---|---|
| `guard_connection_update()` | EXECUTE | EXECUTE | EXECUTE | EXECUTE | false | `public` | VOLATILE |
| `guard_profile_identity()` | EXECUTE | EXECUTE | EXECUTE | EXECUTE | false | `public` | VOLATILE |
| `guard_profile_internal_fields()` | EXECUTE | EXECUTE | EXECUTE | EXECUTE | false | `public` | VOLATILE |
| `guard_reserved_username()` | EXECUTE | EXECUTE | EXECUTE | EXECUTE | false | `public` | VOLATILE |
| `guard_slang_tag_identity()` | EXECUTE | EXECUTE | EXECUTE | EXECUTE | false | `public` | VOLATILE |
| `reserved_usernames_normalize()` | EXECUTE | EXECUTE | EXECUTE | EXECUTE | false | `public` | VOLATILE |

Dies entspricht dem dokumentierten Vorher-Zustand **exakt** – keine Abweichung, kein STOPP-Grund.

Zielzustand nach M5: PUBLIC = kein EXECUTE, anon = kein EXECUTE, `authenticated` = EXECUTE, `service_role` = EXECUTE. M5 setzt genau diese sechs REVOKE-Paare plus sechs GRANTs; keine weiteren Rollen, keine Definitionsänderung der Guards.

## 6. Migrationen M1–M5

| # | Datei | Inhalt | Art |
|---|---|---|---|
| M1 | `20260907075857_9aa2e6a3….sql` | REVOKE auf `slang_tag_track_dedup`, `comments`, `messages` (anon), `GRANT ALL … service_role`; anon-EXECUTE-Entzug für 5 Prüf- und 6 Trigger-Funktionen | nur Grants/Revoke |
| M2 | `20260907080749_5a399190….sql` | `promote_exclusive_drops(uuid)` neu (Ownership-Prüfung) + Grants | Function + Grants |
| M3 | `20260907084122_57362285….sql` | `market_start_transaction(...)` ohne Checkout-Gate (**noch mit** Abholcode-Insert) + Grants | Function + Grants |
| M4 | `20260907085235_c0e81394….sql` | `mark_conversation_read(uuid)` gebündeltes UPDATE + Grants | Function + Grants |
| M5 | `20260907103102_a6bf3d72….sql` | PUBLIC- **und** anon-EXECUTE-Entzug der sechs Guards + `market_start_transaction(...)` **ohne** Abholcode-Erzeugung | Grants + Function |

- Reihenfolge M1 → M2 → M3 → M4 → M5 ist im `RUNBOOK.md` festgelegt und mit den Dateinamen/Zeitstempeln konsistent.
- **M3 → M5 Abhängigkeit bestätigt:** beide ersetzen `market_start_transaction` per `CREATE OR REPLACE`; M5 setzt den in M3 hergestellten Stand ohne Checkout-Gate voraus und entfernt zusätzlich die Abholcode-Erzeugung. M5 nach M3 ist zwingend.
- Keine fehlende, doppelte oder unbekannte Migration; keine unbekannte Abhängigkeit.
- Statische Prüfung aller fünf Dateien: **kein** `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `DROP`, `DELETE FROM`, `TRUNCATE`, **keine** `POLICY`-Anweisung. Schreibende SQL-Anweisungen kommen ausschließlich innerhalb der Funktionskörper vor (bestehende Fachlogik).

## 7. Market

- Kein `checkout`, `stripe` oder `payment_intent` in den Migrationen; die einzigen Treffer sind Kommentare „Kein Checkout-Gate“.
- Kein Ticket-System.
- M3 enthält den Abholcode-Insert noch, M5 entfernt ihn; nach M5 wird **kein neuer Abholcode** mehr erzeugt.
- Historische Daten: M5 hält ausdrücklich fest, dass Bestandszeilen in `public.market_transaction_secrets` unangetastet bleiben; kein `DELETE`/`TRUNCATE` vorhanden.
- Fachlicher Ablauf bleibt Listing → Reservierung → Selbstabwicklung → SOLD. Keine zusätzlichen Market-Änderungen.
- Paket-Test `tests/market-no-pickup-code.test.ts` vorhanden.

## 8. Performance / Code (#4/#5)

Ausschließlich die bereits geprüften Änderungen, statisch verifiziert:

- **Messenger:** gebündeltes Lesestatus-UPDATE mit `GET DIAGNOSTICS` (M4); `unreadCountsRef` verhindert wiederholte unread-Neuberechnungen in `src/lib/social.tsx`.
- **Zahlungsskript:** `src/lib/stripe.ts` wechselt auf `@stripe/stripe-js/pure`, das externe Skript lädt erst bei `getStripe()`.
- **Panels:** neue Datei `src/components/lazy/LazySocialPanels.tsx` lädt Nachrichten-, Kontakte- und Benachrichtigungs-Overlay erst beim ersten Öffnen; geschlossen liefern sie ohnehin `null`.
- **Profile:** `loadedProfileIdsRef` + `inFlightRef` in `src/lib/data.tsx` verhindern doppelte Profil-Abfragen.
- Paket-Test `tests/network-optimization.test.ts` vorhanden. **Keine neuen Optimierungen** in diesem Preflight.

## 9. Rollback

| Prüfpunkt | Ergebnis |
|---|---|
| `ROLLBACK.md` vorhanden | ja, inkl. eigenem Abschnitt „v3 – Rücknahme auf Basis der echten Production-Baseline“ |
| Production-DB-Baseline vorhanden | ja, SHA-256 bestätigt, Definitionen per MD5 gegen Production verifiziert |
| Sechs Guard-PUBLIC-Grants rücksetzbar | **ja** – `GRANT EXECUTE … TO PUBLIC` für alle sechs Funktionen explizit in der Baseline (Zeilen 292–297) |
| anon-Grants rücksetzbar | ja, in der Baseline dokumentiert |
| authenticated/service_role dokumentiert | ja, mit gemessenem `proacl`-Stand |
| Code-Rollback | `git apply -R PATCH/changes.patch` bzw. `rollback-baseline/`; die zwei neuen Dateien sind als zu löschen benannt |
| Rollback-Reihenfolge | nachvollziehbar dokumentiert (Funktionen zurückspielen, dann Grants) |

Rollback-Dateien wurden **nicht** ausgeführt.

## 10. Read-only-Bestätigung

Durch diesen Preflight wurden **nicht** verändert: Production-Code, Production-DB, Grants, Policies, Tabellen, Daten, Migrationshistorie, Deployment. Alle DB-Zugriffe waren ausschließlich lesende Abfragen auf `pg_proc`/`pg_get_functiondef`. Das Archiv wurde ausschließlich nach `/tmp` entpackt.

## Abschluss

```
V3 ARCHIVE = PASS
V3 SHA-256 = PASS
CHECKSUMS = PASS
PRODUCTION BASELINE = PASS
CONFLICT MERGE = PASS
DB BASELINE = PASS
GUARDS = PASS
M1→M5 = PASS
M3→M5 = PASS
MARKET = PASS
SECURITY = PASS
ROLLBACK = PASS

PRODUCTION CODE CHANGED = NEIN
PRODUCTION DB CHANGED = NEIN
PRODUCTION GRANTS CHANGED = NEIN
PRODUCTION DATA CHANGED = NEIN
DEPLOYMENT = NEIN

FINAL PREFLIGHT = PASS
```

V3 ist für den anschließenden kontrollierten Production-Migrationslauf freigegeben. Es wurde noch **keine** Migration ausgeführt.
