#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Y-Dude – Restore-Test (Phase 4)
#
# Zweck: Beweisen, dass sich das komplette Datenbankschema aus den im Repo
# vorliegenden Migrationen in einer LEEREN, ISOLIERTEN Datenbank vollständig
# wiederherstellen lässt – ohne Production zu berühren.
#
# Der Test läuft in einer temporären, lokalen PostgreSQL-Instanz. Er verbindet
# sich NIE mit Production oder Staging.
#
# Aufruf:  bash scripts/restore-test.sh
# Ergebnis: Anzahl erfolgreicher/fehlgeschlagener Migrationen, Schemaumfang,
#           RLS-Prüfung, Liste kritischer Datenbankfunktionen.
# ---------------------------------------------------------------------------
set -euo pipefail

WORKDIR="${WORKDIR:-/tmp/ydude-restore-test}"
PORT="${PORT:-55432}"
DB="ydude_restore"
RUNAS_UID="${RUNAS_UID:-1000}"   # PostgreSQL darf nicht als root laufen

rm -rf "$WORKDIR"; mkdir -p "$WORKDIR/pg"
if [ "$(id -u)" = "0" ]; then
  chown -R "$RUNAS_UID:$RUNAS_UID" "$WORKDIR"
  SP=(setpriv "--reuid=$RUNAS_UID" "--regid=$RUNAS_UID" --clear-groups)
else
  SP=()
fi

"${SP[@]}" initdb -D "$WORKDIR/pg" -U postgres >"$WORKDIR/initdb.log" 2>&1
"${SP[@]}" pg_ctl -D "$WORKDIR/pg" -o "-p $PORT -k $WORKDIR" -l "$WORKDIR/pg.log" start >/dev/null

export PGHOST="$WORKDIR" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
for _ in $(seq 1 30); do psql -tc 'select 1' >/dev/null 2>&1 && break; sleep 1; done

psql -q -c "create database $DB encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'" >/dev/null
export PGDATABASE="$DB"

# --- Plattform-Grundgerüst nachbilden (auf Supabase von der Plattform gestellt)
psql -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;
create schema auth; create schema storage; create schema extensions; create schema cron;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text, encrypted_password text,
  raw_user_meta_data jsonb default '{}'::jsonb, raw_app_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  email_confirmed_at timestamptz, last_sign_in_at timestamptz, deleted_at timestamptz,
  banned_until timestamptz, phone text, confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create table storage.buckets (id text primary key, name text, public boolean default false, created_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz, metadata jsonb);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create function storage.filename(name text) returns text language sql immutable as $$ select split_part(name, '/', array_length(string_to_array(name,'/'),1)) $$;
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$ select 1::bigint $$;
create function cron.unschedule(job_name text) returns boolean language sql as $$ select true $$;
create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create publication supabase_realtime;
-- Owner-IDs, auf die eine alte Seed-Migration verweist (nur Platzhalter im Test)
insert into auth.users (id,email) values
  ('5b006914-91da-46a5-86be-89ec4826abe0','owner-a@restore.test'),
  ('9ce1d1b0-7481-4cb0-aedf-5291dae67297','owner-b@restore.test');
SQL

# --- Migrationen chronologisch abspielen
ok=0; fail=0; : >"$WORKDIR/failed.txt"; start=$(date +%s)
for f in supabase/migrations/*.sql; do
  if psql -v ON_ERROR_STOP=1 -q -f "$f" >"$WORKDIR/last.log" 2>&1; then
    ok=$((ok+1))
  else
    fail=$((fail+1))
    { echo "== $(basename "$f")"; grep -m1 -E '^psql:.*ERROR' "$WORKDIR/last.log" || true; } >>"$WORKDIR/failed.txt"
  fi
done
seconds=$(( $(date +%s) - start ))

echo "Migrationen: ok=$ok fail=$fail  Dauer=${seconds}s"
[ "$fail" -gt 0 ] && { echo "--- Fehlgeschlagen:"; cat "$WORKDIR/failed.txt"; }

echo "--- Schemaumfang / Sicherheitsprüfung"
psql -tc "select 'Tabellen (public): '||count(*) from information_schema.tables where table_schema='public'"
psql -tc "select 'RLS-Policies: '||count(*) from pg_policies where schemaname='public'"
psql -tc "select 'Funktionen: '||count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"
psql -tc "select 'Tabellen OHNE RLS: '||count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity"
psql -tc "select 'Kritische Funktion vorhanden: '||proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('has_role','can_view_post','mark_conversation_read','cleanup_push_data','market_expire_promotions','has_active_subscription') order by 1"

"${SP[@]}" pg_ctl -D "$WORKDIR/pg" stop >/dev/null 2>&1 || true
echo "Fertig. Logs: $WORKDIR"
