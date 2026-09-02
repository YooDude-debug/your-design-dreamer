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

---

# Nachtrag 2026-09-02 21:40 – Ausführungsversuch im Staging-Projekt

Ziel war, den Audit direkt im Staging-Projekt *Y-Dude Launchpad*
(`4a5bd367-098d-4501-b206-9e1696fcc09c`) auszuführen.

## Ergebnis: technisch nicht möglich

Meine Sitzung ist fest an **dieses** (Production-)Projekt gebunden:
`psql`/`PG*`, `SUPABASE_DB_URL` und das SQL-Read-Tool zeigen ausschließlich auf
die Production-Datenbank. Der projektübergreifende Zugriff liefert nur einen
**Code-Snapshot** des Staging-Projekts, keinen SQL-/Katalogzugriff. Es wurden
weder Production-Credentials für Staging verwendet noch Annahmen aus
Migrationsdateien getroffen.

## 1. Welcher Zugriff fehlt

Read-only SQL-Ausführung **innerhalb** des Staging-Projekts – konkret einer von:

- der SQL-Editor des Staging-Projekts (Cloud-Ansicht dort), oder
- ein Read-only-DB-Nutzer der Staging-Datenbank mit `SELECT` auf
  `information_schema`, `pg_catalog` und `supabase_migrations.schema_migrations`.

Beides muss im Staging-Projekt selbst geöffnet/erzeugt werden; ich kann es von
hier aus nicht anstoßen.

## 2. Auszuführende Read-only-Abfragen (Staging, unverändert kopieren)

```sql
-- Q1 Migration History
select version, name from supabase_migrations.schema_migrations order by version;

-- Q2 Objekt-Kennzahlen
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_type='BASE TABLE') as tables,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relrowsecurity) as rls_tables,
  (select count(*) from pg_policies where schemaname='public') as policies,
  (select count(distinct t.typname) from pg_type t
     join pg_namespace n on n.oid=t.typnamespace
     where n.nspname='public' and t.typtype='e') as enums,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public') as functions,
  (select count(*) from pg_trigger where not tgisinternal) as triggers,
  (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace
     where n.nspname='public') as constraints;

-- Q3 Tabellen + Spalten + Typ + Nullable + Default
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
order by table_name, ordinal_position;

-- Q4 Enums inkl. Werte
select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels
from pg_type t
join pg_enum e on e.enumtypid=t.oid
join pg_namespace n on n.oid=t.typnamespace
where n.nspname='public'
group by t.typname order by 1;

-- Q5 Functions (Signatur + Security + Volatility), ohne Body
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as returns, p.prosecdef as security_definer,
       p.provolatile
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by 1,2;

-- Q6 Trigger
select c.relname as table_name, t.tgname, p.proname as function_name, t.tgenabled
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal and n.nspname='public'
order by 1,2;

-- Q7 Constraints inkl. FKs
select c.conrelid::regclass::text as table_name, c.conname, c.contype,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c join pg_namespace n on n.oid=c.connamespace
where n.nspname='public' order by 1,2;

-- Q8 RLS-Status je Tabelle
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by 1;

-- Q9 Policies vollständig
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public' order by tablename, policyname;

-- Q10 Grants / ACLs
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','service_role')
order by 1,2,3;

-- Q11 Indexes
select tablename, indexname, indexdef from pg_indexes
where schemaname='public' order by 1,2;

-- Q12 Fokusbereiche (Video / Rollen / Business)
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and (
  table_name in ('media_video_assets','media_variant_jobs','user_roles',
                 'ad_campaigns','ad_campaign_event_guard','ad_test_events',
                 'ad_test_settings','subscriptions','creator_subscriptions',
                 'creator_subscription_prices','posts','comments','post_views',
                 'post_video_views','slang_tags')
) order by table_name, ordinal_position;
```

Hinweis: Alle Abfragen sind rein lesend (`select`) und lesen ausschließlich
Metadaten – keine Nutzdaten, keine Secrets, keine Stripe-Werte.

## 3. Benötigte Ergebnisse

Die vollständigen Resultsets von **Q1–Q12**. Besonders erforderlich:
`supabase_migrations.schema_migrations` (Q1), `media_video_assets` und
`posts.video_kind` (Q3/Q12), Video-Functions/Trigger/Policies (Q5/Q6/Q9),
`user_roles` + `has_role` (Q5/Q12), Business-/Creator-Subscription- und
Campaign-Strukturen (Q12), Enums (Q4), Grants (Q10).

## 4. Gewünschtes Format

CSV oder TSV pro Abfrage mit Kopfzeile, jeweils als Codeblock oder Datei-Upload,
benannt `Q1_migrations`, `Q2_counts`, … `Q12_focus`. Wenn im SQL-Editor
einfacher: pro Abfrage die Ergebnistabelle als Text einfügen – ich normalisiere
sie hier. Vollständigkeit vor Formatierung; bitte keine Zeilen kürzen (Q3, Q9 und
Q10 sind lang).

## Vergleichsklassifizierung A–E

Aktuell für **jeden** Punkt: **E = unklar / manuelle Entscheidung erforderlich**,
weil kein tatsächlicher Staging-Schemazustand vorliegt. Sobald Q1–Q12 vorliegen,
wird jede Struktur automatisch als A / B / C / D klassifiziert und der Sync-Plan
aktualisiert.

## Abschlussstatus

STAGING SCHEMA AUDIT:
**BLOCKED**

SYNC:
**NOT AUTHORIZED**

Keine Änderungen an Production oder Staging. Keine Migration, kein Deployment,
keine Daten-, Policy-, Function- oder Dependency-Änderung.

---

# Nachtrag 2026-09-02 21:44 – Q1–Q12 im angeforderten Schema

Erneut geprüft: Es besteht weiterhin **kein** SQL-Zugriff auf die
Staging-Datenbank aus dieser Umgebung (nur Production-DB erreichbar,
Cross-Project liefert nur Code). Daher STOPP – unten die Abfragen zur
Ausführung im Staging-Projekt.

**Anleitung:** Im Projekt **Y-Dude Launchpad**
(`4a5bd367-098d-4501-b206-9e1696fcc09c`) die Cloud-/Backend-Ansicht öffnen,
dort den SQL-Editor verwenden und Q1–Q12 einzeln ausführen. Alle Abfragen sind
rein lesend (`select`) und lesen nur Metadaten – keine Nutzdaten, keine Secrets.
Ergebnisse vollständig und ungekürzt zurückgeben, jeweils mit Label.

## Q1_migrations – Migrationshistorie
```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

## Q2_tables_columns – Tabellen, Spalten, Typen, Nullable, Defaults
```sql
select table_name, column_name, ordinal_position, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

## Q3_enums – Enums inkl. Werte
```sql
select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
group by t.typname
order by 1;
```

## Q4_functions – Functions (Signatur, Security Definer, Volatility)
```sql
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as returns,
       p.prosecdef as security_definer,
       p.provolatile
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1, 2;
```

## Q5_triggers – Trigger
```sql
select c.relname as table_name, t.tgname, p.proname as function_name, t.tgenabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and n.nspname = 'public'
order by 1, 2;
```

## Q6_constraints_fks – Constraints inkl. Foreign Keys
```sql
select c.conrelid::regclass::text as table_name, c.conname, c.contype,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_namespace n on n.oid = c.connamespace
where n.nspname = 'public'
order by 1, 2;
```

## Q7_rls – RLS-Status je Tabelle
```sql
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
```

## Q8_policies – Policies vollständig (Rollen, USING, WITH CHECK)
```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

## Q9_grants – Grants / ACLs
```sql
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by 1, 2, 3;
```

## Q10_indexes – Indexes
```sql
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by 1, 2;
```

## Q11_video – Video-Strukturen, -Functions, -Trigger, -Policies
```sql
select 'column' as kind, table_name as obj, column_name as detail,
       data_type || ' / nullable=' || is_nullable ||
       ' / default=' || coalesce(column_default, '-') as info
from information_schema.columns
where table_schema = 'public'
  and (table_name in ('media_video_assets', 'media_variant_jobs', 'post_video_views')
       or column_name like 'video%')
union all
select 'function', p.proname, pg_get_function_identity_arguments(p.oid),
       'secdef=' || p.prosecdef
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like '%video%'
union all
select 'trigger', c.relname, t.tgname, p.proname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and n.nspname = 'public'
  and (c.relname like '%video%' or t.tgname like '%video%')
union all
select 'policy', tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (tablename like '%video%' or policyname like '%video%')
order by 1, 2, 3;
```

## Q12_focus – Rollenmodell, Creator/Business Subscription, Campaigns, Feed/Posts
```sql
select table_name, column_name, ordinal_position, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'user_roles', 'admin_owners', 'profiles',
    'subscriptions', 'creator_subscriptions', 'creator_subscription_prices',
    'ad_campaigns', 'ad_campaign_event_guard', 'ad_test_events', 'ad_test_settings',
    'market_ad_campaigns', 'posts', 'comments', 'post_views', 'slang_tags'
  )
order by table_name, ordinal_position;
```

Zusätzlich für das Rollenmodell (Teil von Q12, separat ausführen):
```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as returns, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('has_role', 'is_admin_owner', 'business_plan_tier',
                    'has_active_subscription', 'has_active_creator_subscription',
                    'business_campaign_limit')
order by 1;
```

## Statuszeile (unverändert bis zum Export)

STAGING SCHEMA AUDIT:
**BLOCKED**

SYNC:
**NOT AUTHORIZED**

Keine Änderungen an Production oder Staging.
