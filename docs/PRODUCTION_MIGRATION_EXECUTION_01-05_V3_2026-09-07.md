# PRODUCTION – KONTROLLIERTER MIGRATIONSLAUF HARDENING #1–#5 (V3)

Datum: 2026-09-07
Paket: `migration/production/2026-09-07-hardening-01-05-v3/`
Archiv-SHA-256: `ae249dbc4c182b715c646968edd10230a0ef7ddc77a0a1c47f923790e573eddd`
Konflikt-Merge-Patch-SHA-256: `18615144180c4941078083725beac757c25ffdfc75d2032dd327e413021540b4`
DB-Baseline-SHA-256: `1d0b1fa7a31e25e10fcb2c224c055638c2fec753377f4eb01e8288b4356b4745`

Status: **🟢 MIGRATION COMPLETE**

## 1. Vorzustand (verifiziert vor Ausführung)

- HEAD vor Lauf: `1ae29d38`, Arbeitsbaum sauber
- Drizzle-Stand: `0031_age_status_functions.sql` (32 SQL-Dateien)
- Supabase-Migrationsdateien: 231
- Build: OK
- Archiv-SHA und 76/76 CHECKSUMS: gültig
- `market_transaction_secrets`: 0 Zeilen (keine historischen Abholcodes vorhanden)
- Policies public: 301, RLS-Tabellen: 124
- Guards: `prosecdef=false`, `search_path=public`, EXECUTE für PUBLIC/anon/authenticated/service_role

## 2. Ausgeführte Migrationen (sequenziell, je mit Validierung)

| # | Datei | Ergebnis |
|---|-------|----------|
| M1 | `drizzle/migrations/0032_hardening_m1_least_privilege.sql` | PASS |
| M2 | `drizzle/migrations/0033_hardening_m2_promote_exclusive_drops.sql` | PASS |
| M3 | `drizzle/migrations/0034_hardening_m3_market_start_transaction_no_checkout_gate.sql` | PASS |
| M4 | `drizzle/migrations/0035_hardening_m4_mark_conversation_read.sql` | PASS |
| M5 | `drizzle/migrations/0036_hardening_m5_guard_public_revoke_and_market_no_pickup_code.sql` | PASS |

Reihenfolge M3 → M5 wurde eingehalten. M3 enthielt planmäßig noch die Abholcode-Erzeugung; M5 hat sie entfernt.

### M1 – Least Privilege
- anon-Tabellenrechte auf `slang_tag_track_dedup`, `comments`, `messages` entzogen (verifiziert: `has_table_privilege('anon', …)` = false)
- anon-EXECUTE entzogen für `has_role`, `are_connected`, `is_following`, `can_view_post`, `test_user_visible` und die sechs Guard-Funktionen
- Definitionen, RLS, Policies, Daten unverändert

### M2 – `promote_exclusive_drops(uuid)`
- Jetzt SECURITY DEFINER, `search_path=public`, Eigentümerprüfung (`not_allowed`)
- ACL: `{postgres, authenticated, service_role}` – kein PUBLIC, kein anon

### M3 – `market_start_transaction(...)`
- Checkout-Gate entfernt (`buy_now_enabled` nicht mehr vorhanden)
- SECURITY DEFINER, `search_path=public`
- ACL: `{postgres, service_role}` – PUBLIC/anon/authenticated entzogen

### M4 – `mark_conversation_read(uuid)`
- Ein einziger UPDATE-Durchlauf mit `GET DIAGNOSTICS` statt Zählen + Schreiben
- SECURITY DEFINER, `search_path=public`, ACL `{postgres, authenticated, service_role}`

### M5 – Guards + Market ohne Abholcode
- PUBLIC- und anon-EXECUTE für alle sechs Guard-Funktionen entzogen; ACL jetzt `{postgres, authenticated, service_role}`
- `prosecdef` und `search_path` der Guards unverändert
- `market_start_transaction` erzeugt keinen `pickup_code` mehr; kein `market_transaction_secrets`-INSERT
- Historische Daten unverändert (weiterhin 0 Zeilen)

## 3. Nachzustand (verifiziert)

- Policies public: 301 (unverändert), RLS-Tabellen: 124 (unverändert)
- Policies je Tabelle: comments 3, messages 5, slang_tag_track_dedup 0 (unverändert)
- anon-EXECUTE auf Market-, Promote-, Read- und Guard-Funktionen: false
- authenticated-Rechte für Messenger-Lesestatus und Kommentare: erhalten
- Keine Tabellen-, Spalten-, Policy- oder Datenänderung

## 4. Codeübernahme

- 26 Paketdateien + 3 neue Dateien über `PATCH/changes.patch` (ohne die vier Konfliktdateien)
- Die vier Konfliktdateien ausschließlich über den verbindlichen Merge-Patch
- Production-spezifische Arbeit erhalten: Bibliotheksrechte-Logik in `src/lib/data.tsx` nicht überschrieben, SEO-CTAs in `AdSlider.tsx` erhalten, Feed-Menü in `dev.tsx` bleibt entfernt, ESLint-Ignore-Liste unverändert
- Performance-Anteil #5 (`loadedProfileIdsRef`), Lazy-Panels und `@stripe/stripe-js/pure` übernommen

### Abweichung (dokumentiert)
`tests/market-no-pickup-code.test.ts` prüfte ausschließlich `supabase/migrations`. In Production liegen die neuen Migrationen unter `drizzle/migrations`. Der Test liest jetzt beide Verzeichnisse in Anwendungsreihenfolge; die Prüfung selbst wurde nicht abgeschwächt.

## 5. Prüfungen

| Prüfung | Ergebnis |
|---|---|
| Typecheck | PASS |
| Tests | 616/616 PASS |
| Lint (Paketdateien) | 0 Fehler (6 vorbestehende Warnungen) |
| Prettier (Paketdateien) | PASS |
| Build | PASS (`build OK`) |
| Smoke lokal `/`, `/auth`, `/market` | HTTP 200 |
| Security-Negativprüfungen anon | PASS |

Nicht geprüft: echter Turnstile-SUCCESS auf Android und ein eingeloggter Zwei-Konten-Market-Durchlauf – headless nicht durchführbar.

## 6. Rollback

`migration/production/2026-09-07-hardening-01-05/rollback-production-db-baseline.sql` enthält Definitionen, Sicherheitsattribute und Grants des Vorzustands inklusive der PUBLIC-Grants der Guards.

## 7. Abschluss

- Migrationen ausgeführt: JA (M1–M5)
- DB-Änderungen ausschließlich Functions/Grants: JA
- Tabellen/Policies/Daten geändert: NEIN
- Code übernommen: JA (29 Dateien + 3 neue)
- Deployment/Veröffentlichung: NEIN (noch offen)
