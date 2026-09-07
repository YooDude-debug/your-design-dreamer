# Y-DUDE PRODUCTION – READ-ONLY EVIDENCE EXPORT FÜR MIGRATION #1–#5 (V3-Vorbereitung)

Datum: 2026-09-07, 10:44 UTC · Modus: read-only · Keine Änderung an Production-Code, DB, RLS,
Policies, Grants, Funktionen, Tabellen, Daten, Migrationen, Deployment.

## Ergebnis

```
EVIDENCE EXPORT:
PATCH       = PASS
DB BASELINE = PASS
PRODUCTION CHANGES = NEIN
DEPLOYMENT  = NEIN
```

## 1. Production-Stand zum Zeitpunkt des Exports

| Punkt | Wert |
| --- | --- |
| Revision | `256a8aab` |
| Drizzle-Migrationen | 32 Dateien, letzte `0031_age_status_functions.sql` (Stand **0031**) |
| Supabase-Migrationsdateien | 231 |
| Build | `build OK` |
| Anwendungscode | unverändert – Patch nicht angewendet |

## 2. Beleg 1 – Conflict-Merge-Patch

Pfad: `docs/patches/2026-09-07-hardening-01-05-conflict-merge.patch`
SHA-256: `18615144180c4941078083725beac757c25ffdfc75d2032dd327e413021540b4`
Umfang: 4 Dateien, 5.129 Bytes.

Der Patch wurde aus dem tatsächlichen Production-Dateistand und dem geprüften Paketstand
(`rollback-baseline` → `target-files`) erzeugt, nicht aus Beschreibungen rekonstruiert.

| Datei | Übernommener Anteil | Erhaltene Production-Arbeit |
| --- | --- | --- |
| `src/lib/data.tsx` | nur #5-Performance: `loadedProfileIdsRef`, frühere `inFlightRef`-Deklaration, Warten auf laufenden Sitzungsstart in `ensureProfiles`, Filtern bereits geladener Profil-IDs, Markieren geladener IDs, Reset bei Logout | **keine** Library-/Bibliotheksrechte, kein `libraryTagIds`, keine Rollen-Wrapper aus dem Paket |
| `src/components/AdSlider.tsx` | nur Entfernen der ungenutzten `Pause`-Bindung im Import | SEO-Texte „Mehr über … erfahren“ (`moreFor`, de/en/el) bleiben vollständig erhalten |
| `src/routes/_authenticated/dev.tsx` | nur Entfernen des ungenutzten Typimports `SlangTag` | Feed-Auswahlmenü bleibt entfernt – der Patch führt keinerlei Menü-Code ein |
| `eslint.config.js` | nur `@typescript-eslint/no-unused-vars` von `off` auf `warn` mit `^_`-Ausnahmen (`args`, `vars`, `caughtErrors: all`) | Production-Ignore-Liste unverändert; **keine** zusätzlichen Ausnahmen `release`/`migration`, keine Regel abgeschwächt |

Validierung:

| Prüfung | Ergebnis |
| --- | --- |
| Anwendbarkeit | `patch -p1 --dry-run` in isolierter Kopie `/tmp/ev`: alle 4 Dateien OK, kein Fuzz-Konflikt |
| Production-Datei verändert? | **NEIN** – Prüfung ausschließlich in der Kopie, Production-Dateien unangetastet |
| Secrets | Suche nach Schlüssel-/Passwort-/JWT-Mustern: **keine Treffer** |
| Daten | keine `INSERT`/`UPDATE`/`DELETE`, keine Datensätze im Patch |
| Unerwartete Änderungen | keine – ausschließlich die vier oben genannten Anteile |

## 3. Beleg 2 – Production-DB-Baseline / Ist-Grants

Pfad: `migration/production/2026-09-07-hardening-01-05/rollback-production-db-baseline.sql`
SHA-256: `1d0b1fa7a31e25e10fcb2c224c055638c2fec753377f4eb01e8288b4356b4745`
Umfang: 344 Zeilen. **Nicht ausführbar vorgesehen** – liegt bewusst außerhalb von
`drizzle/migrations` und `supabase/migrations` und wird von keinem Migrator eingelesen.

Neu ergänzt (Abschnitt E): der tatsächlich aus der Production-Datenbank gelesene
PUBLIC-EXECUTE-Ist-Zustand der sechs Trigger-/Guard-Funktionen samt Wiederherstellungszeilen.
Quelle: read-only `SELECT` auf `pg_proc` mit `proacl` und `aclexplode(proacl)`.

### Tatsächlicher Ist-Zustand der sechs Guard-Funktionen

Gemessen, für **alle sechs identisch**:

```
proacl      = {=X/postgres,postgres=X/postgres,anon=X/postgres,
               authenticated=X/postgres,service_role=X/postgres}
aclexplode  = PUBLIC:EXECUTE, postgres:EXECUTE, anon:EXECUTE,
              authenticated:EXECUTE, service_role:EXECUTE
prosecdef   = false        (SECURITY INVOKER, nicht DEFINER)
proconfig   = {search_path=public}
provolatile = v            (VOLATILE)
```

| Funktion | PUBLIC-EXECUTE vorhanden | anon-EXECUTE vorhanden |
| --- | --- | --- |
| `public.guard_connection_update()` | **JA** (`=X/postgres`) | JA |
| `public.guard_profile_identity()` | **JA** | JA |
| `public.guard_profile_internal_fields()` | **JA** | JA |
| `public.guard_reserved_username()` | **JA** | JA |
| `public.guard_slang_tag_identity()` | **JA** | JA |
| `public.reserved_usernames_normalize()` | **JA** | JA |

Damit ist der Rücknahmeweg der v2-Migration `20260907103102` vollständig belegt:
sechs `GRANT EXECUTE … TO PUBLIC` plus sechs `GRANT EXECUTE … TO anon`; `authenticated`
und `service_role` sind zusätzlich dokumentiert.

Hinweis zur Tatsachenlage: Diese sechs Funktionen sind in Production **SECURITY INVOKER**
(`prosecdef = false`), nicht SECURITY DEFINER. `search_path = public` ist gesetzt. Die
v2-Migration verändert beides nicht.

### Gegenprüfung der übrigen betroffenen Objekte (unverändert)

| Objekt | `proacl` / `relacl` (wortgetreu gelesen) |
| --- | --- |
| `promote_exclusive_drops(uuid)` | `{postgres=X,authenticated=X,service_role=X}` – kein anon, kein PUBLIC |
| `market_start_transaction(…)` | `{postgres=X,service_role=X}` |
| `mark_conversation_read(uuid)` | `{postgres=X,authenticated=X,service_role=X}` |
| `has_role`, `are_connected`, `is_following`, `can_view_post`, `test_user_visible` | zusätzlich `anon=X` |
| `comments` | `{postgres=arwdDxtm,anon=rDxtm,authenticated=arwdDxtm,service_role=arwdDxtm,sandbox_exec=ar}` |
| `messages` | `{postgres=arwdDxtm,anon=rDxtm,authenticated=ardDxtm,service_role=arwdDxtm,sandbox_exec=ar}` |
| `slang_tag_track_dedup` | `{postgres=arwdDxtm,anon=arwdDxtm,authenticated=arwdDxtm,service_role=arwdDxtm,sandbox_exec=ar}` |

RLS ist auf allen drei Tabellen aktiv (`relrowsecurity = true`).

Definitionsprüfsummen (`md5(pg_get_functiondef(oid))`, als Nachweis der Unverändertheit):
`promote_exclusive_drops` `8e2bf3f2…`, `market_start_transaction` `20a5b63e…`,
`mark_conversation_read` `0c275ebc…`, `has_role` `187a79a4…`, `are_connected` `16c4ca58…`,
`is_following` `539a4bff…`, `can_view_post` `4bcc5bda…`, `test_user_visible` `99a78394…`.
Die vollständigen Vorher-Definitionen der drei ersetzten Funktionen stehen unverändert in
Abschnitt A derselben Datei.

## 4. Integritätsbestätigung

| Bestätigung | Wert |
| --- | --- |
| Beide Dateien aus dem tatsächlichen Production-Stand erzeugt | **JA** – Patch aus Production-Dateien, Baseline aus read-only DB-Abfragen |
| Aus Staging abgeleitet / geraten / rekonstruiert | **NEIN** |
| Production-Code geändert | **NEIN** |
| Production-DB geändert | **NEIN** |
| Migration ausgeführt | **NEIN** |
| Grants geändert | **NEIN** |
| Policies / RLS geändert | **NEIN** |
| Daten geändert | **NEIN** |
| Deployment | **NEIN** |

Beide Dateien sind Dokumentations-/Vorbereitungsartefakte; der Patch ist inaktiv, die SQL-Datei
ist nicht als Migration registriert.
