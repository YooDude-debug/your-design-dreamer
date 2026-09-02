# Y-Dude – Staging Schema Audit (Read-only)

Datum: 2026-09-02
Status: 🟠 **BLOCKED – STAGING SCHEMA ACCESS STILL REQUIRED**

Production unverändert. Staging unverändert. Keine Migration, kein Deployment,
keine Datenänderung, keine Secrets gelesen.

## 1. Zugriffsprüfung (Ergebnis)

| Zugriffsweg | Ziel | Ergebnis |
| --- | --- | --- |
| `psql` / `PG*`-Env | Datenbank | ausschließlich **PRODUCTION** (`SUPABASE_PROJECT_ID` = Production-Ref) |
| SQL-Read-Tool (`read_query`) | Datenbank | fest an das aktuelle Projekt = **PRODUCTION** gebunden |
| `SUPABASE_DB_URL` | Datenbank | Production |
| Cross-Project-Zugriff | Staging-Projekt | nur **Code-Snapshot** (Dateien), **kein** SQL-/Schema-Zugriff |
| Staging-Credentials im Sandbox-Env | Staging-DB | **nicht vorhanden** (keine `*STAGING*`-Variablen) |

Fazit: Es existiert im aktuellen Werkzeugumfang **kein** Weg, das *tatsächliche*
Live-Schema der Staging-Datenbank zu lesen. Der Audit wurde deshalb nicht durch
Annahmen aus Migrationsdateien ersetzt (ausdrückliche Vorgabe).

### Genau dieser Zugriff fehlt

Read-only SQL-Zugriff auf die Datenbank des Staging-Projekts
**Y-Dude Launchpad** (`4a5bd367-098d-4501-b206-9e1696fcc09c`,
`https://y-dude-staging.lovable.app`), z. B. als Read-only-Rolle
(`SELECT` auf `information_schema`, `pg_catalog`, `supabase_migrations.schema_migrations`).
Alternativ ein im Staging-Projekt selbst ausgeführter Schema-Audit, dessen
Ergebnis hierher zurückgespielt wird.

## 2. Production-Schema-Baseline (Vergleichsseite, nur Metadaten)

Damit der Vergleich unmittelbar nach Freigabe des Staging-Zugriffs erfolgen kann:

| Objektklasse | Production |
| --- | --- |
| Tabellen (`public`, BASE TABLE) | 122 |
| Tabellen mit aktiviertem RLS | 122 (100 %) |
| Policies (`public`) | 299 |
| Enums (`public`) | 40 |
| Functions (`public`) | 175 |
| Trigger (nicht-intern) | 135 |
| Constraints (`public`) | 331 |
| Migrationsdateien im Repository | 231 |

### Video V1 – Production-Struktur (Sollstand)

`public.media_video_assets`: `id`, `owner_id`, `path`, `thumbnail_path`,
`container`, `mime_type`, `status` (Enum `video_processing_status`),
`width`, `height`, `rotation` (smallint), `aspect_ratio` (numeric),
`duration_ms`, `file_size` (bigint), `last_error`, `created_at`, `updated_at`.

`public.posts` Video-Spalten: `video_url`, `video_kind` (text),
`video_duration_ms`, `video_views_count`.

## 3. Noch offene Vergleichsmatrix

Für jeden Punkt gilt aktuell **UNVERIFIED (kein Staging-Lesezugriff)**, nicht
„identisch“:

Migration History · Tabellen · Spalten · Enums · Functions · Trigger ·
Constraints · RLS · Policies · Grants/ACLs · Creator Subscription ·
Business Subscription · Business Campaigns · Video V1 · `media_video_assets` ·
`posts.video_kind` · Rollenmodell.

## 4. Nächster Schritt

1. Read-only-Zugang zur Staging-Datenbank bereitstellen (Abschnitt 1).
2. Danach: Vergleich Production ↔ Staging mit Klassifizierung
   IDENTISCH / FEHLT IN STAGING / NUR IN STAGING / ABWEICHEND.
3. Erst danach Freigabe für den eigentlichen Sync (separat).
