# Y-Dude PRODUCTION – Migration-8-Checkpoint

Stand: 2026-08-29, 04:48 UTC · Migration 9 und 10 **nicht** ausgeführt

## 1. Ausgeführte Migration

`drizzle/migrations/0007_prod_release_m8_hasrole_block_d.sql` – has_role Block D, Production-Variante:

- 21 tatsächlich vorhandene Ziel-Policies optimiert (`has_role(...)` → `(SELECT has_role(...))`)
- `newsletter_select_admin` **nicht angefasst und nicht angelegt** (existiert in Production nicht)
- Staging-Selbstcheck / absoluter has_role-Guard **nicht übernommen**
- ALTER-POLICY-Anweisungen ansonsten unverändert, keine weiteren Policies berührt

## 2. Vorher / Nachher

| Kennzahl                              | Vorher | Nachher | Soll   | Status |
| ------------------------------------- | ------ | ------- | ------ | ------ |
| Policies (public)                     | 285    | 285     | 285    | ✅     |
| Tabellen mit RLS                      | 116    | 116     | 116    | ✅     |
| `has_role`-Policies gekapselt         | 50     | 71      | +21    | ✅     |
| `has_role`-Policies ungekapselt       | 44     | 23      | 23     | ✅     |
| Ungekapselte `auth.uid()`-Policies    | 0      | 0       | 0      | ✅     |
| `newsletter_subscribers`-Policies     | 4 Deny | 4 Deny  | 4 Deny | ✅     |
| Indexe (public)                       | 318    | 318     | 318    | ✅ (M9/M10 offen) |

`newsletter_subscribers` unverändert: `newsletter_no_select/insert/update/delete`, alle `false`;
keine `newsletter_select_admin`-Policy vorhanden. Keine Policy hinzugefügt oder gelöscht.

## 3. Prüfungen nach Migration 8

- Typprüfung: grün
- Lint: 0 Fehler (34 bekannte Warnungen)
- Unit/Logik: 480 Tests / 21 Dateien – grün
- DB-Integration (RLS, Admin/Non-Admin, Owner/Fremd, Gast, Schreib- und Eskalationspfade): 26 Tests – grün
- E2E (Chromium): 10 passed, 1 skipped – grün
- `bun run verify`: **Freigabe-Gate bestanden**
- Build: OK
- DB-Linter: 57 Findings, identisch zur akzeptierten Baseline (2 INFO „RLS enabled, no policy“,
  2 WARN Extension in Public, 53 WARN SECURITY-DEFINER-Executable). **Keine neuen Findings**,
  keine Tabelle ohne RLS.

## 4. Offene Migrationen

| #  | Inhalt                                                                                   | Status |
| -- | ---------------------------------------------------------------------------------------- | ------ |
| 9  | 5 Indexe: `idx_slang_tags_creator_id`, `idx_comments_parent_id`, `idx_post_video_views_user_created`, `idx_market_offers_conversation_id`, `idx_market_transactions_conversation_id` | offen |
| 10 | 2 Indexe: `idx_globe_entries_round_id`, `idx_slang_tag_votes_user_id`                     | offen |

Verifiziert: keiner der 7 Indexe existiert in Production.

## 5. Offene Punkte

- 23 `has_role`-Policies bleiben bewusst ungekapselt (nicht Teil des Release-Umfangs).
- Migrationen 9/10 warten auf separate Freigabe; beide sind `CREATE INDEX IF NOT EXISTS`
  (ohne `CONCURRENTLY`) – kurze Schreiblocks auf den betroffenen Tabellen möglich.
- Rollback-Snapshots: `rollback/RLS_HASROLE_BLOCKD_SNAPSHOT.sql`, `INDEX_BLOCK1/2_*.sql`.

## 6. Empfehlung

Production ist in einem konsistenten, validierten Zustand (Migrationen 1–8).
Nächster Schritt nach ausdrücklicher Freigabe: Migration 9 (5 Indexe), danach erneutes Gate
(Indexzählung 318 → 323, `bun run verify`), anschließend Migration 10.
