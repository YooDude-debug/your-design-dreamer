# Production DB-Baseline – Vorbereitung Hardening #1–#5

- Datum: 2026-09-07
- Art: **read-only** Bestandsaufnahme der Production-Datenbank
- Status: **🟢 DB BASELINE COMPLETE**
- Ausführung: **keine** Migration, keine Änderung an Funktionen, Grants, Policies oder Daten

## 1. Production-Migrationsstand (verifiziert)

| Angabe | Erwartung | Verifiziert |
|---|---|---|
| Drizzle-Migrationsstand | `0031` | **JA** – letzte Datei `drizzle/migrations/0031_age_status_functions.sql` (32 SQL-Dateien inkl. `0000`) |
| Supabase-Migrationsdateien | 231 | **JA** – 231 Dateien in `supabase/migrations/` |
| Code-Revision | `b24d1123` | **abweichend, erklärbar**: aktueller Kopf `bc71e2b0`. Die zwischenzeitlichen Commits enthalten **ausschließlich** Dokumentation und die Patchdatei der Konflikt-Auflösung (`docs/PRODUCTION_MIGRATION_CONFLICT_RESOLUTION_01-05_2026-09-07.md`, `docs/patches/2026-09-07-hardening-01-05-conflict-merge.patch`). Kein Anwendungscode geändert (gegengeprüft: `loadedProfileIdsRef` nicht vorhanden, `no-unused-vars` weiterhin `off`). |
| Datenbank | – | PostgreSQL-Zustand unverändert, keine der vier Paket-Migrationen angewandt |

## 2. Betroffene Objekte (ausschließlich aus den vier Paket-Migrationen)

**#1 `20260907075857…` – Least Privilege (nur GRANT/REVOKE)**
- Tabellen: `public.slang_tag_track_dedup` (anon+authenticated entziehen, service_role ALL), `public.comments`, `public.messages` (anon-DML entziehen)
- EXECUTE-Entzug für `anon`: `has_role(uuid, app_role)`, `are_connected(uuid, uuid)`, `is_following(uuid, uuid)`, `can_view_post(uuid)`, `test_user_visible(uuid)`, `guard_connection_update()`, `guard_profile_identity()`, `guard_profile_internal_fields()`, `guard_reserved_username()`, `guard_slang_tag_identity()`, `reserved_usernames_normalize()`

**#2 `20260907080749…`** – `public.promote_exclusive_drops(uuid)`: Body + Grants

**#3 `20260907084122…`** – `public.market_start_transaction(uuid, uuid, market_fulfillment_type, uuid)`: Body + Grants

**#4 `20260907085235…`** – `public.mark_conversation_read(uuid)`: Body + Grants

Keine weiteren Funktionen im Scope. Keine Tabellenstruktur-, Policy- oder Datenänderung in irgendeiner der vier Dateien (geprüft: nur `CREATE OR REPLACE FUNCTION`, `GRANT`, `REVOKE`).

## 3. Vorher-Definitionen und Eigenschaften (IST, aus `pg_proc`/`pg_get_functiondef`)

| Funktion | Schema | Parameter | Return | Security | search_path | Volatility | Sprache | EXECUTE aktuell |
|---|---|---|---|---|---|---|---|---|
| `promote_exclusive_drops` | public | `_user_id uuid` | integer | **DEFINER** | `public` | VOLATILE | plpgsql | postgres, authenticated, service_role – **kein anon** |
| `market_start_transaction` | public | `_item_id uuid, _buyer_id uuid, _fulfillment market_fulfillment_type, _offer_id uuid DEFAULT NULL` | uuid | **DEFINER** | `public` | VOLATILE | plpgsql | postgres, service_role – **kein anon, kein authenticated** |
| `mark_conversation_read` | public | `_conversation_id uuid` | jsonb | **DEFINER** | `public` | VOLATILE | plpgsql | postgres, authenticated, service_role – **kein anon** |
| `has_role` | public | `_user_id uuid, _role app_role` | boolean | DEFINER | `public` | STABLE | sql | postgres, **anon**, authenticated, service_role |
| `are_connected` | public | `_a uuid, _b uuid` | boolean | DEFINER | `public` | STABLE | sql | postgres, **anon**, authenticated, service_role |
| `is_following` | public | `_follower uuid, _following uuid` | boolean | DEFINER | `public` | STABLE | sql | postgres, **anon**, authenticated, service_role |
| `can_view_post` | public | `_post_id uuid` | boolean | DEFINER | `public` | STABLE | sql | postgres, **anon**, authenticated, service_role |
| `test_user_visible` | public | `_owner uuid` | boolean | DEFINER | `public` | STABLE | sql | postgres, **anon**, authenticated, service_role |
| `guard_connection_update` | public | – | trigger | INVOKER | `public` | VOLATILE | plpgsql | **PUBLIC**, postgres, anon, authenticated, service_role |
| `guard_profile_identity` | public | – | trigger | INVOKER | `public` | VOLATILE | plpgsql | **PUBLIC**, postgres, anon, authenticated, service_role |
| `guard_profile_internal_fields` | public | – | trigger | INVOKER | `public` | VOLATILE | plpgsql | **PUBLIC**, postgres, anon, authenticated, service_role |
| `guard_reserved_username` | public | – | trigger | INVOKER | `public` | VOLATILE | plpgsql | **PUBLIC**, postgres, anon, authenticated, service_role |
| `guard_slang_tag_identity` | public | – | trigger | INVOKER | `public` | VOLATILE | plpgsql | **PUBLIC**, postgres, anon, authenticated, service_role |
| `reserved_usernames_normalize` | public | – | trigger | INVOKER | `public` | VOLATILE | plpgsql | **PUBLIC**, postgres, anon, authenticated, service_role |

Vollständige Bodies der drei zu ersetzenden Funktionen: gesichert in
`migration/production/2026-09-07-hardening-01-05/rollback-production-db-baseline.sql`
(Abschnitt A, wortgleicher Export aus `pg_get_functiondef`).

Abhängigkeiten (nur lesend festgestellt):
- `promote_exclusive_drops` → `slang_tag_library`, `has_active_creator_subscription`; Aufrufer u. a. `run_exclusive_drop_maturation` (serverseitig, `auth.uid()` = NULL)
- `market_start_transaction` → `market_items`, `market_offers`, `market_fee_settings`, `market_transactions`, `market_transaction_secrets`, `market_shipping`, `market_transaction_events`; nutzt weiterhin `market_items.buy_now_enabled` (Vorher-Stand)
- `mark_conversation_read` → `conversation_members`, `conversations`, `messages`

## 4. Aktuelle Tabellen-Grants (IST, aus `pg_class.relacl`)

| Tabelle | RLS | Policies | anon | authenticated | service_role |
|---|---|---|---|---|---|
| `slang_tag_track_dedup` | aktiv | 0 | **alle Rechte** (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) | alle Rechte | alle Rechte |
| `comments` | aktiv | 3 | SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER | alle Rechte | alle Rechte |
| `messages` | aktiv | 5 | SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER | alle Rechte |

Hinweis: `postgres` und `sandbox_exec` sind Plattform-/Werkzeugrollen und werden von den Migrationen nicht berührt.
Sichtbarkeit für anon bleibt trotz Grants durch RLS beschränkt – die Grants sind dennoch weiter als nötig (genau der Punkt von #1).

## 5. Sicherheitsprüfung (nur lesend)

- `promote_exclusive_drops`: **SECURITY DEFINER JA**, `search_path=public` **JA**, **kein anon-EXECUTE** – Preflight-Angaben **bestätigt**.
- `market_start_transaction`: anon **und** authenticated haben bereits kein EXECUTE; #3 setzt hier nur den bereits erreichten Zustand erneut.
- `mark_conversation_read`: kein anon-EXECUTE; authenticated + service_role wie im Paket-SOLL.
- Offene anon-Rechte, die #1 adressiert, bestehen weiterhin: 5 Prüf-Hilfsfunktionen, 6 Trigger-Funktionen (zusätzlich `PUBLIC`), sowie Tabellen-Grants auf `slang_tag_track_dedup`, `comments`, `messages`.
- Kein unerwarteter Zustand, kein Security-Konflikt → kein STOPP.

## 6. Vergleich IST / SOLL

| Migration | Objekt | Production IST | Migration SOLL | Änderung | Risiko |
|---|---|---|---|---|---|
| #1 | `slang_tag_track_dedup` Grants | anon + authenticated volle Rechte | nur `service_role` | **muss geändert werden** | niedrig – Tabelle wird nur von SECURITY-DEFINER-Funktionen beschrieben; Direktzugriff im Client prüfen (keiner bekannt) |
| #1 | `comments` / `messages` anon-DML | anon: SELECT, DELETE, … | anon ohne SELECT/INSERT/UPDATE/DELETE | **muss geändert werden** | niedrig-mittel – öffentliche, nicht angemeldete Lesepfade auf Kommentare müssten dann leer bleiben; RLS liefert anon ohnehin keine Zeilen |
| #1 | `has_role`, `are_connected`, `is_following`, `can_view_post`, `test_user_visible` | anon hat EXECUTE | anon ohne EXECUTE | **muss geändert werden** | niedrig – Aufrufe erfolgen aus DEFINER-Policies, nicht mit anon-Rechten |
| #1 | 6 Trigger-Funktionen | `PUBLIC` + anon EXECUTE | anon-EXECUTE entzogen (`PUBLIC` bleibt) | **teilweise wirkungslos**: `PUBLIC` bleibt bestehen, damit behält anon effektiv EXECUTE | gering, aber **Wirkungslücke dokumentiert** – #1 erreicht hier nicht das erklärte Ziel |
| #2 | `promote_exclusive_drops` Body | ohne Ownership-Prüfung | mit `auth.uid()`-Prüfung (`not_allowed`) | **muss geändert werden** | niedrig – serverseitige Läufe (`auth.uid()` NULL) bleiben möglich |
| #2 | `promote_exclusive_drops` Grants | postgres, authenticated, service_role | authenticated, service_role (PUBLIC/anon revoke) | **bleibt effektiv unverändert** (anon/PUBLIC bereits ohne Recht) | keines |
| #2 | Eigenschaften (DEFINER, `search_path`, Volatility, Return) | DEFINER, `public`, VOLATILE, integer | identisch | **bleibt unverändert** | keines |
| #3 | `market_start_transaction` Body | mit `buy_now_enabled`-Gate (`checkout_disabled`) | Gate entfernt | **muss geändert werden** | mittel – Verhaltensänderung: Reservierung ohne Checkout-Flag möglich; entspricht dem bereits live gestellten Market-Ablauf (Listing → Reservierung → Selbstabwicklung) |
| #3 | `market_start_transaction` Grants | postgres, service_role | service_role (PUBLIC/anon/authenticated revoke) | **bleibt effektiv unverändert** | keines |
| #3 | Pickup-Code-Insert (`market_transaction_secrets`) | vorhanden | **unverändert vorhanden** | bleibt unverändert | Hinweis: #3 entfernt das Code-System nicht; der bestehende Insert bleibt |
| #4 | `mark_conversation_read` Body | COUNT + UPDATE | ein gebündeltes UPDATE mit `GET DIAGNOSTICS` | **muss geändert werden** | niedrig – identischer Rückgabe-Contract, `messages_marked` weiterhin Zahl geänderter Zeilen |
| #4 | `mark_conversation_read` Grants | postgres, authenticated, service_role | authenticated, service_role | **bleibt effektiv unverändert** | keines |

## 7. Rollback-Baseline

- Datei: `migration/production/2026-09-07-hardening-01-05/rollback-production-db-baseline.sql`
- Enthält: die drei vollständigen Vorher-Bodies (wortgleicher `pg_get_functiondef`-Export), die Vorher-EXECUTE-Rechte, die Vorher-Tabellenrechte, sowie die Feststellung, dass RLS/Policies unberührt bleiben.
- Reproduzierbarkeit: **vollständig** für alle vier Migrationen.
- Nicht exportierbar / bewusst ausgelassen (nicht erfunden):
  - `PUBLIC`-Grant der Trigger-Funktionen bleibt in beiden Richtungen unverändert und ist daher nicht Teil des Rollbacks.
  - Rollen `postgres`/`sandbox_exec` werden nicht verändert und nicht wiederhergestellt.
- Datei liegt außerhalb von `drizzle/migrations` und `supabase/migrations`; kein Migrator liest sie ein. **Nicht ausgeführt.**

## 8. Risiken

| Risiko | Bewertung |
|---|---|
| #1 Wirkungslücke bei Trigger-Funktionen (`PUBLIC` bleibt) | dokumentiert; #1 erreicht dort das erklärte Ziel nicht, richtet aber keinen Schaden an |
| #1 anon-Entzug auf `comments`/`messages` | vor Ausführung prüfen, ob ein nicht angemeldeter Lesepfad diese Tabellen direkt abfragt |
| #3 Verhaltensänderung Market | bewusst gewollt, aber funktionale Änderung – nach Ausführung Market-Reservierung real prüfen |
| #4 Performance-Umbau | nur Laufzeit, kein Contract-Bruch |
| Kein Point-in-Time-Test der Rollback-Datei | Baseline wurde nicht probeweise ausgeführt (Verbot in dieser Aufgabe) |

## 9. Nächste Schritte (später, separat zu entscheiden)

1. Konflikt-Patch (`docs/patches/2026-09-07-hardening-01-05-conflict-merge.patch`) anwenden – bislang nur vorbereitet.
2. Vor #1 prüfen, ob ein anonymer Lesepfad `comments`/`messages` direkt abfragt.
3. Migrationen in der Reihenfolge #2 → #4 → #3 → #1 anwenden (zuerst die Body-Änderungen mit engem Risiko, Rechteentzug zuletzt), jeweils einzeln.
4. Nach jeder Migration: Eigenschaften und Grants erneut lesen und mit dieser Baseline vergleichen.
5. Funktionale Nachprüfung: Messenger-Lesestatus, Market-Reservierung, Exclusive-Drop-Reifung.
6. Bei Abweichung: entsprechenden Abschnitt aus `rollback-production-db-baseline.sql` anwenden.
7. Optional separat entscheiden: `PUBLIC`-EXECUTE der Trigger-Funktionen (Wirkungslücke aus #1).

## 10. Abschlussbestätigung

- Code geändert: **NEIN** (nur dieser Bericht + Rollback-Baseline-Datei)
- DB geändert: **NEIN**
- Grants geändert: **NEIN**
- Policies geändert: **NEIN**
- Daten geändert: **NEIN**
- Deployment: **NEIN**

**Status: 🟢 DB BASELINE COMPLETE**
