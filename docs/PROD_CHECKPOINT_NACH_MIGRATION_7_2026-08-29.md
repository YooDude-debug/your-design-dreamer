# Y-Dude PRODUCTION – Release-Checkpoint nach Migration 7

Stand: 2026-08-29, 04:45 UTC · Production **unverändert** nach diesem Checkpoint (read-only Prüfung)

## 1. Aktueller Production-Zustand

| Prüfpunkt                         | Soll   | Ist    | Status |
| --------------------------------- | ------ | ------ | ------ |
| Policies (public)                 | 285    | 285    | ✅     |
| Tabellen mit RLS (public)         | 116    | 116    | ✅     |
| Policies mit ungekapseltem `auth.uid()` | 0 | 0      | ✅     |
| Policies mit `has_role(...)`      | –      | 94     | ✅     |
| davon InitPlan-gekapselt          | –      | 50     | ✅     |
| davon (noch) ungekapselt          | 44     | 44     | ✅ erwartet |
| Indexe (public)                   | 318    | 318    | ✅ (M9/M10 nicht angewendet) |

## 2. Erfolgreich angewendete Migrationen 1–7

| # | Migration (Journal-Tag)                  | Inhalt                            |
| - | ---------------------------------------- | --------------------------------- |
| 1 | `0000_prod_initplan_block1`              | 24 × `auth.uid()` InitPlan        |
| 2 | `0001_prod_initplan_block2`              | 69 × `auth.uid()` InitPlan        |
| 3 | `0002_prod_initplan_block3`              | InitPlan Restblock                |
| 4 | `0003_prod_initplan_block4`              | InitPlan Restblock                |
| 5 | `0004_prod_hasrole_block_a`              | has_role Block A                  |
| 6 | `0005_prod_hasrole_block_b`              | has_role Block B                  |
| 7 | `0006_prod_release_m7_hasrole_block_c`   | has_role Block C – 9 Policies (Staging-Guard entfernt) |

Ergebnis: 0 ungekapselte `auth.uid()`-Policies, 50 gekapselte `has_role`-Policies.

### Block C – die 9 optimierten Policies

1. `user_warnings.user_warnings_insert_admin`
2. `user_bans.user_bans_insert_admin`
3. `slang_tag_grants.grants_delete_owner_or_grantee`
4. `slang_tag_share_requests.share_requests_delete_involved`
5. `slang_tag_share_requests.share_requests_update_owner`
6. `slang_definitions.slang_definitions_insert`
7. `slang_definitions.slang_definitions_update`
8. `slang_definition_translations.slang_definition_translations_update`
9. `slang_definition_translations.slang_definition_translations_write`

Alle 9 semantisch identisch, nur `has_role(...)` → `(SELECT has_role(...))`.

## 3. Verbleibende `has_role`-Policies (44, bewusst unverändert)

Korrektur zur Annahme „27“: aktuell sind **44** `has_role`-Policies ungekapselt.
Migration 8 (Block D) adressiert davon **21** (22 Ziele minus `newsletter_select_admin`,
das in Production nicht existiert). Danach bleiben **23** dauerhaft unverändert.

Block-D-Ziele (nach Freigabe von M8): account_security_events (2), ad_campaigns_select_admin,
ad_test_events_select_admin, admin_audit_log_select_admin, channel_categories „admins manage categories“,
channels (2), content_moderation_log_admin_select, counter_events admin read, easter_eggs_admin_write,
feedback „Admins read all feedback“, interest_categories „categories managed by admins“,
ops_events_admin_select, ops_incidents_admin_select, post_moderation_jobs „Admins can read moderation jobs“,
reports_select_admin, slang_tag_moderation_events_select_admin, slang_tags_delete_admin,
user_bans_select_admin, user_warnings_select_admin.

Nicht im Release enthalten (bleiben unverändert, 23): ad_campaigns_delete/insert/update_admin,
ad_test_events_delete_admin, ad_test_settings (4), arena_submissions_insert, feedback „Admins update feedback“,
identity_policy_admin_write, interest_engine_config (2), market_fee_settings (2),
moderation_appeals_admin_update, ops_incidents_admin_update, reports_delete_admin, reports_update_admin,
reserved_usernames „Admins verwalten reservierte Usernames“, user_bans_delete/update_admin,
user_warnings_delete_admin.

## 4. Sicherheitsprüfungen

- Keine Policy hinzugefügt oder gelöscht (285 vor und nach Migration 7).
- `newsletter_subscribers`: unverändert vollständig gesperrt – `newsletter_no_select/insert/update/delete`
  (alle `false`); Server-Zugriff ausschließlich via `service_role`. `newsletter_select_admin` existiert
  in Production nicht und wird in Migration 8 nicht angefasst.
- Admin-/Non-Admin-, Owner-/Fremd-, Gast-, Schreib- und Eskalationspfade: durch DB-Integrations- und
  E2E-Suite abgedeckt und grün.

## 5. Tests

- `bun run verify`: **grün** (Freigabe-Gate bestanden)
- Unit/Logik: 480 Tests / 21 Dateien – grün
- DB-Integration: 26 Tests / 2 Dateien – grün
- E2E (Chromium): 10 passed, 1 skipped – grün
- Build: OK

## 6. Verbleibende Migrationen 8–10 (nicht angewendet)

| #  | Inhalt                                                    | Status |
| -- | --------------------------------------------------------- | ------ |
| 8  | has_role Block D – 21 Policies (`newsletter_select_admin` entfällt) | offen |
| 9  | 5 Indexe: `idx_slang_tags_creator_id`, `idx_comments_parent_id`, `idx_post_video_views_user_created`, `idx_market_offers_conversation_id`, `idx_market_transactions_conversation_id` | offen |
| 10 | 2 Indexe: `idx_globe_entries_round_id`, `idx_slang_tag_votes_user_id` | offen |

Verifiziert: keiner der 7 Indexe existiert derzeit in Production.

## 7. Offene Punkte

- Migration 8 enthält denselben Staging-Selbstcheck-Typ wie Migration 7 (absolute Policy-Anzahl) –
  vor Ausführung prüfen und ggf. ersatzlos entfernen.
- `newsletter_select_admin`-Zeile aus Migration 8 entfernen (bereits beschlossen).
- Rollback-Snapshots liegen im Release-Paket (`rollback/RLS_HASROLE_BLOCK*_SNAPSHOT.sql`,
  `INDEX_BLOCK*_SNAPSHOT.sql`).

## 8. Empfehlung nächste Schritte

1. Migration 8 als angepasste Variante freigeben: 21 ALTER-POLICY-Anweisungen, ohne Staging-Guard,
   ohne `newsletter_select_admin`.
2. Danach erneut Policy-/RLS-Zählung + `bun run verify` als Gate.
3. Erst dann Migration 9 und 10 (Indexe) – risikoarm, aber separat freigeben.
