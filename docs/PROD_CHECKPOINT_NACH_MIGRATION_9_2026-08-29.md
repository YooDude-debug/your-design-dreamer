# Production Checkpoint nach Migration 9 — 2026-08-29

Status: 🟢 GRÜN — Migration 9 angewendet, Migration 10 **nicht** ausgeführt.

## 1. Angewendete Migration

`drizzle/migrations/0008_prod_release_m9_index_block1_red.sql` — Index Block 1 (RED),
exakt nach Release-Paket `production-release-2026-08-29.tar.gz`
(`migrations/20260828204412_9b912abb-b9f7-40a9-9e3c-0e2ba2e8ae40.sql`), unverändert übernommen:

1. `idx_slang_tags_creator_id` on `public.slang_tags (creator_id)`
2. `idx_comments_parent_id` on `public.comments (parent_id) WHERE parent_id IS NOT NULL`
3. `idx_post_video_views_user_created` on `public.post_video_views (user_id, created_at DESC)`
4. `idx_market_offers_conversation_id` on `public.market_offers (conversation_id) WHERE conversation_id IS NOT NULL`
5. `idx_market_transactions_conversation_id` on `public.market_transactions (conversation_id) WHERE conversation_id IS NOT NULL`

Keine weiteren Indexe erstellt, keine Indexe gelöscht, keine Policy-/Daten-/RLS-Änderungen.

## 2. Vorher / Nachher

| Kennzahl                            | Vorher | Nachher | Soll | Status |
| ----------------------------------- | ------ | ------- | ---- | ------ |
| Policies (public)                   | 285    | 285     | 285  | ✅     |
| Tabellen mit RLS (public)           | 116    | 116     | 116  | ✅     |
| Ungekapselte `auth.uid()`-Policies  | 0      | 0       | 0    | ✅     |
| Gekapselte `has_role()`-Policies    | 71     | 71      | 71   | ✅     |
| Ungekapselte `has_role()`-Policies  | 23*    | 23*     | 23   | ✅     |
| Indexe (public)                     | 318    | 323     | 323  | ✅     |
| Indexe aus Migration 9 vorhanden    | 0/5    | 5/5     | 5/5  | ✅     |
| Indexe aus Migration 10 vorhanden   | 0/2    | 0/2     | 0/2  | ✅     |

\* Zählung nach Checkpoint-Methodik (Policies mit `has_role`-Vorkommen außerhalb einer
`(SELECT ...)`-Kapselung, inkl. gemischter Ausdrücke). Der reine Roh-Textfilter liefert 20;
die Differenz von 3 sind Policies mit gemischt gekapselten/ungekapselten Vorkommen und ist
gegenüber dem M8-Checkpoint unverändert.

Keine Datenänderungen: die Migration enthält ausschließlich `CREATE INDEX IF NOT EXISTS`,
kein `INSERT`/`UPDATE`/`DELETE`/`DROP`.

## 3. Tests / Gate

- Unit/Logik: 480 Tests / 21 Dateien — grün
- DB-Integration (RLS, Admin/Non-Admin, Owner/Fremd, Gast): 26 Tests / 2 Dateien — grün
- E2E (Chromium): 10 passed, 1 skipped — grün
- `bun run verify`: **Freigabe-Gate bestanden** (Exit 0)
- Build: OK
- Lint: 0 Errors, 34 Warnings (Baseline unverändert)

## 4. Offene Migration

| #  | Inhalt                                                                | Status |
| -- | --------------------------------------------------------------------- | ------ |
| 10 | 2 Indexe: `idx_globe_entries_round_id`, `idx_slang_tag_votes_user_id` | offen — nicht freigegeben |

## 5. Rollback

`rollback/INDEX_BLOCK1_RED_SNAPSHOT.sql` im Release-Paket; Rücknahme wäre
`DROP INDEX` der 5 oben genannten Indexe (Indexstand 323 → 318).

## 6. Empfehlung

Production ist konsistent und validiert (Migrationen 1–9). Nächster Schritt nur nach
ausdrücklicher separater Freigabe: Migration 10 (2 Indexe, Indexstand 323 → 325).
