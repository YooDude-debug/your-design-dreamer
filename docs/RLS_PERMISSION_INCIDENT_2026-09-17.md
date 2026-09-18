# Y-Dude – Forensik: „permission denied" Feed / Kommentare / SlangTags (17.09.2026)

Rein lesende Analyse. Keine Änderung an Code, Datenbank, RLS, Grants, Migrationen, Production.

## PHASE 1 – Root-Cause-Analyse (nur gelesen)

### Gemeldete Rohdaten
Postgres-Log, 2026-09-17T15:24:21–15:24:28 UTC:
- `permission denied for table posts` ×63
- `permission denied for table comments` ×8
- `permission denied for table slang_tags` ×8

### Fehlerklasse
`permission denied for table X` (SQLSTATE 42501) ist ein **GRANT**-Fehler, kein RLS-Fehler.
RLS liefert bei fehlender Berechtigung 0 Zeilen, nicht diesen Fehler. Die Anfragen kamen
also von einer Rolle **ohne** SELECT-Recht auf diese Tabellen.

### Tatsächlich wirksame Tabellenrechte (gemessen, `pg_class.relacl`)

| Tabelle | anon | authenticated | service_role |
|---|---|---|---|
| `posts` | **kein** SELECT/INSERT/UPDATE/DELETE | SELECT, DELETE | ALL |
| `comments` | **kein** Datenrecht | SELECT, INSERT, UPDATE, DELETE | ALL |
| `slang_tags` | **kein** Datenrecht | SELECT, INSERT, UPDATE, DELETE | ALL |
| `profiles` | kein Datenrecht | SELECT, INSERT, UPDATE, DELETE | ALL |
| `post_likes`, `post_views`, `post_hashtags` | S/I/U/D | S/I/U/D | ALL |

Ergänzend, ausdrücklich gewollt (Migration `20260803163449`): `posts` INSERT/UPDATE sind auch
für `authenticated` entzogen – Beiträge werden serverseitig geschrieben. Spaltenrechte auf
`slang_tags` (`location`, `opening_hours`, `company_url`, `phone`, `discount_code`, `voucher`)
sind entzogen; die App fragt diese Spalten in `SLANG_TAG_COLUMNS` nicht ab (geprüft,
`src/lib/data.tsx:57-58`) – kein Spalten-Permission-Fehler möglich.

### Wirksame SELECT-Policies (gemessen)
- `posts_select` (Rolle `public`): sichtbar bei `visibility='public'` bzw. Eigentum/Connection/Following, `hidden_at IS NULL`, `test_user_visible`.
- `comments_select` (Rolle `public`): eigener Kommentar, Admin, oder `can_view_post(post_id) AND test_user_visible`.
- `slang_tags_select` (Rolle `public`): Eigentum/Ersteller/Admin oder `deleted_at IS NULL AND moderation_status='approved'`.

Die Policies nennen die Rolle `public`, es fehlt aber bewusst der GRANT für `anon` – die
Zeilenfilterung greift daher für `anon` nie, weil der Zugriff schon an der Rechteebene endet.
Für `anon` ist das zusätzlich folgerichtig: `can_view_post()`, `test_user_visible()`,
`has_role()`, `are_connected()`, `is_following()` haben für `anon` kein EXECUTE
(`drizzle/migrations/0032_hardening_m1_least_privilege.sql`), die Policies wären für `anon`
ohnehin nicht auswertbar.

### Auslöser des Bursts
Der Zeitraum 15:24:21–15:24:28 liegt **innerhalb** des dokumentierten Production-Lasttests
vom 17.09. (Start 15:01:55 UTC, Dauer 1.358 s → Ende ≈ 15:24:33 UTC,
`docs/PRODUCTION_LOAD_TEST_2026-09-17.md`). Dieser Test hat mit dem öffentlichen
Publishable-Key, also als Rolle `anon`, unter anderem `posts`, `slang_tags`, `comments`
gelesen und dabei 188.147 erwartete Abweisungen erzeugt; die 63/8/8 Log-Zeilen sind die
Postgres-Seite dieser Abweisungen (Abbauphase der 1.000-VU-Stufe).

Gegenprobe: In den Postgres-Logs der letzten 24 Stunden existiert **kein einziger**
`permission denied`-Eintrag mehr. Es handelt sich um ein einmaliges, synthetisches Ereignis,
nicht um ein laufendes Problem.

### Wurde der Fehler durch eine kürzliche RLS-Optimierung ausgelöst?
Nein – belegbar geprüft:
- `0032_hardening_m1_least_privilege.sql` entzieht `anon` Rechte auf `comments` (und `messages`), nicht auf `posts`/`slang_tags`.
- `posts`/`slang_tags` hatten für `anon` schon vorher kein SELECT (`20260801174038` entzieht SELECT auf `slang_tags`; für `posts` wurde `anon`-SELECT nie vergeben).
- `0039`/`0040` (`can_read_media`) und die vier Performance-Migrationen berühren Grants auf diesen Tabellen nicht.

### Rollen- und Sessionabhängigkeit
- **anon (nicht angemeldet):** kein Zugriff → 42501. So gewollt: Y-Dude-Feed ist keine öffentliche Ressource.
- **authenticated (normaler angemeldeter Nutzer):** SELECT vorhanden, Policies filtern korrekt → funktioniert.
- **service_role (serverseitig):** ALL, RLS umgangen – nur in Serverpfaden.
- Der Bootstrap (`src/lib/data.tsx`, `Appn`) läuft ausschließlich unter
  `src/routes/_authenticated/route.tsx` (und `admin.slangtags`), also nie für Besucher ohne Anmeldung.

### Keyset-Pagination, Joins, Views, verschachtelte Abfragen
`posts` wird per Keyset (`created_at`, `id`) mit `select("*")` gelesen – keine eingebettete
Relation, kein View, keine RPC. Kommentare lesen `comments` direkt; die Policy ruft
`can_view_post()` (SECURITY DEFINER) auf, das für `authenticated` EXECUTE besitzt. Es existiert
kein Pfad, bei dem eine Unterabfrage eine Tabelle ohne passende SELECT-Policy trifft.

### Race Condition / sporadisches Verhalten
Kein Hinweis auf eine Race Condition. Die Fehler treten deterministisch bei Rolle `anon` auf und
sind auf ein 7-Sekunden-Fenster im Lasttest begrenzt. Ein realer, aber unbewiesener Nebenpfad
bleibt möglich: läuft ein Zugriffstoken während einer offenen Sitzung ab und wird nicht
erneuert, fällt der Browser-Client auf `anon` zurück und derselbe 42501-Fehler erscheint,
bis die Route den Nutzer nach `/auth` schickt. Für den gemeldeten Vorfall ist dieser Pfad
**nicht** belegt (Zeitfenster und Menge passen exakt zum Lasttest).

### Staging-Vergleich
**BLOCKED / NICHT VERIFIZIERBAR** – das getrennte Staging-Projekt ist ohne Datenbank-,
Auth- und Schlüsselzugriff (dokumentiert seit 14.09.). Ein Grant-Diff Staging↔Production ist
nicht durchführbar.

## PHASE 2 – Betroffene Queries

| # | Tabelle | Datenpfad | Rollenkontext | Erwartete Policy | Angewandte Policy | Ursache |
|---|---|---|---|---|---|---|
| 1 | `posts` (63×) | `supabase.from("posts").select("*")` Keyset-Feed, `src/lib/data.tsx:600-606` | `anon` (Lasttest-Client mit Publishable-Key) | `posts_select` | keine – Abbruch vor RLS | kein SELECT-GRANT für `anon` (gewollt) |
| 2 | `comments` (8×) | `comments`-Read, `src/components/CommentList.tsx` / `PostDetailOverlay` | `anon` | `comments_select` | keine – Abbruch vor RLS | GRANT entzogen in `0032` (gewollt) |
| 3 | `slang_tags` (8×) | zwei Bootstrap-Abfragen, `src/lib/data.tsx:608-615` | `anon` | `slang_tags_select` | keine – Abbruch vor RLS | kein SELECT-GRANT für `anon` (gewollt) |

Kein Eintrag stammt aus einer angemeldeten Sitzung.

## PHASE 3 – Minimaler Fix-Vorschlag

**Kein Datenbank-Fix.** Der Befund ist gegenüber echten Nutzern ein **False Positive**: er
misst die erwarteten Abweisungen des eigenen Lasttests. Der im Finding vorgeschlagene
Gegenschritt („SELECT an die vorgesehenen Rollen neu vergeben") würde `anon` Leserechte auf
`posts`, `comments` und `slang_tags` geben und damit das bestehende Sicherheitsmodell
aufweichen – ausdrücklich **nicht empfohlen**.

Optionale, nicht dringliche Robustheitsmaßnahme (🟡, separat freizugeben, reine Frontend-Änderung):
Fehlercode `42501` im Bootstrap als Sitzungsverlust behandeln und einmal
`supabase.auth.refreshSession()` versuchen bzw. auf `/auth` leiten, statt einen leeren Feed zu
zeigen. Keine Grant-, Policy- oder Migrationsänderung.

Für künftige Lasttests: geschützte Tabellenpfade nicht mit `anon` beschicken, damit
Log-Auswertung und Monitoring nicht dieselbe Fehlklassifikation erzeugen.

## PHASE 4 – Staging-Testplan (nur bei Umsetzung der optionalen Maßnahme)

**BLOCKED:** ohne Staging-DB/Auth-Zugriff nicht ausführbar. Sobald verfügbar:

1. Nicht angemeldeter Besucher: `/`, `/post/:id`, `/flyer-konzepte` – keine `posts`/`slang_tags`-Abfrage, keine 42501-Zeile im Log.
2. Normaler angemeldeter Nutzer: Feed lädt 20 Beiträge, SlangTags laden, Kommentare lesbar/schreibbar.
3. Eigener Beitrag: sichtbar inkl. `hidden_at`-Fall; fremder öffentlicher Beitrag sichtbar; fremder `connections`/`following`-Beitrag nur bei bestehender Beziehung.
4. Eigene Kommentare lesen/anlegen/löschen; fremde Kommentare lesen, aber nicht löschen.
5. SlangTags: `approved` sichtbar, `pending`/`deleted_at` nur für Eigentümer/Admin.
6. Feed-Pagination: drei aufeinanderfolgende Keyset-Seiten, keine Duplikate, keine 42501.
7. Parallele Sessions: zwei Browserprofile gleichzeitig, danach eine Sitzung Token ablaufen lassen → erwartete Weiterleitung nach `/auth` statt leerem Feed.
8. Lasttest: 250/500/750/1.000 VU **ausschließlich mit gültigen Sessions**; Akzeptanz 0×5xx, 0× `permission denied`.
9. Abschluss: Typecheck, Lint, Unit-Tests, Build, E2E.

## Kurzbericht

**ROOT CAUSE:** Die 79 Log-Zeilen sind GRANT-Abweisungen (42501) der Rolle `anon` auf `posts`,
`comments`, `slang_tags`. Diese Rechte sind absichtlich nicht vergeben. Verursacher war der
eigene Production-Lasttest vom 17.09. (15:01:55–15:24:33 UTC), der diese geschützten Pfade mit
dem öffentlichen Publishable-Key angesprochen hat. Keine RLS-Optimierung und keine
Policy-Vereinfachung hat den Fehler ausgelöst.

**BETROFFENE BEREICHE:** Feed (`posts`), Kommentare (`comments`), SlangTags (`slang_tags`) –
jeweils nur im nicht angemeldeten Rollenkontext.

**RISIKO:** Für echte Nutzer aktuell keines. Angemeldete Sitzungen haben alle nötigen Rechte;
in den letzten 24 Stunden kein einziger `permission denied`-Eintrag. Restrisiko: bei einem
mitten in der Sitzung ablaufenden Token sähe ein Nutzer kurzzeitig einen leeren Feed
(unbelegt für diesen Vorfall).

**MINIMALER FIX:** Keiner an Datenbank, Policies oder Grants. Optional und separat: 42501 im
Frontend als Sitzungsverlust behandeln; Lasttests künftig nur mit gültigen Sessions.

**SECURITY IMPACT:** Keine Änderung – RLS bleibt auf allen betroffenen Tabellen aktiv, `anon`
erhält keine neuen Rechte, keine `USING (true)`-Policy, keine Tabelle wird öffentlich.

**STAGING RESULT:** BLOCKED – kein Staging-Datenbank-/Auth-Zugriff; Grant-Diff und Testlauf
nicht durchführbar.

**PRODUCTION:** UNVERÄNDERT.

## Nachtrag 18.09.2026 – Fehlalarm-Einstufung und Monitoring-Klassifizierung

Der Monitoring-Befund wurde geprüft und als **Fehlalarm (false positive)** geschlossen.
Keine Änderung an RLS-Policies, Grants oder Datenbankberechtigungen.

**Klassifizierungs-Prüfung (Ergebnis):**

- Die Abweisungen entstanden durch den autorisierten Production-Lasttest
  (nicht authentifizierte Requests auf bewusst geschützte Tabellen). Sie sind
  erwartetes Verhalten des Zugriffsschutzes, kein Produktfehler.
- Die eigenen App-Überwachung (`src/lib/ops-monitor.server.ts`,
  `src/lib/observability.server.ts`) hat diese clientseitigen Lese-Abweisungen
  zu keinem Zeitpunkt als kritischen Produktfehler gewertet oder alarmiert –
  Feed-Ladefehler werden im Client nur protokolliert und als Hinweis angezeigt,
  sie erzeugen kein Monitoring-Ereignis.
- Der als kritisch eingestufte Befund stammt aus der plattformseitigen,
  Protokoll-basierten Überwachung (Postgres-Logs). Diese sieht nur die
  Datenbankabweisung, nicht den Absichts-Kontext (anonymer Lasttest vs.
  echter Nutzer). Eine sichere Unterscheidung „erwartete anon-Abweisung" vs.
  „echter authenticated-Fehler" ist auf dieser Protokollebene aus dem Projekt
  heraus nicht konfigurierbar.
- Gemäß Vorgabe („keine sichere Unterscheidung möglich → nichts ändern, nur
  dokumentieren") wurde **kein Code und keine Konfiguration geändert**. Es wurden
  keine Fehler verschluckt und keine Security-Prüfungen entfernt.

**Weiterhin gewährleistet:**

- Echte `permission denied`-Fehler im angemeldeten oder serverseitigen Kontext
  laufen weiterhin über die Fehler-Middleware in die Überwachung
  (Schweregrad „kritisch", alarmierbar) und bleiben in den Serverprotokollen
  sichtbar.
- Künftige Lasttests gegen Production sollten geschützte Pfade nur mit gültigen
  Sessions anfahren, damit erwartete anon-Abweisungen nicht erneut als
  Vorfall erscheinen (Empfehlung, keine Änderung).
