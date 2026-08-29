# Y-Dude – Security-Audit: RLS-Policies mit Rolle `public`

Datum: 2026-08-29 · Umgebung: PRODUCTION · Art: **reiner Audit, keine Änderungen**

Es wurden ausschließlich Leseabfragen (`pg_policies`, `aclexplode`, Funktionsdefinitionen)
und Leseversuche über die öffentliche Datenschnittstelle mit dem anon-Schlüssel
durchgeführt. Keine Policy, kein Grant, keine Migration, keine Daten, kein Secret
wurde verändert.

## 0. Grundsatz: „Policy für public definiert“ ≠ „private Daten lesbar“

Der Zugriff über die Datenschnittstelle ist zweistufig:

1. **Tabellenrecht (GRANT)** – ohne `SELECT`-Recht für `anon` endet jede Anfrage
   mit `42501 permission denied`, unabhängig von der Policy.
2. **Zeilensicherheit (RLS/USING)** – filtert erst danach die Zeilen.

`{public}` in `pg_policies.roles` bedeutet nur „für alle Rollen auswertbar“,
nicht „für nicht angemeldete Besucher freigegeben“. Der Scanner sieht Stufe 2,
nicht Stufe 1. Genau darin liegt die Ursache aller vier Warnungen.

## 1. `posts` – Policy `posts_select` gilt für `{public}`

- **Tatsächliche Leserollen:** `authenticated`, `service_role`. **`anon` hat kein
  SELECT-Recht.**
- **Nachweis (anon-Schlüssel, PostgREST):** `GET /rest/v1/posts` →
  `401 / 42501 permission denied for table posts`. Auch als Einbettung
  (`comments?select=*,posts(...)`) → dasselbe `42501`.
- **USING für anon:** wird nie erreicht.
- **USING für angemeldete Nutzer:** `(hidden_at IS NULL OR eigener Beitrag OR admin)
  AND test_user_visible(user_id) AND (visibility='public' OR eigener Beitrag OR
  (connections AND are_connected(...)) OR (following AND is_following(...)))`
  – Sichtbarkeit wird serverseitig aus `auth.uid()` abgeleitet, nie aus Requestdaten.
- **ID-/Request-Manipulation:** nicht möglich. Filter (`?id=eq.…`) werden **nach**
  RLS angewendet; `auth.uid()` stammt aus dem verifizierten JWT.
- **Bewertung: B – korrektes und bewusstes Verhalten.** Öffentliche Beiträge
  werden für Gäste ausschließlich über die Serverfunktion `getPublicPost`
  (Service-Rolle, harte Filter `visibility='public'` + `hidden_at IS NULL`)
  ausgeliefert, nicht über den anon-Schlüssel.

## 2. `slang_tags` – Policy `slang_tags_select` gilt für `{public}`

- **Tatsächliche Leserollen:** `authenticated`, `service_role`. **`anon` hat kein
  SELECT-Recht** (`GET /rest/v1/slang_tags` → `401 / 42501`).
- **USING für angemeldete Nutzer:** eigene/erstellte Tags, Admin, oder
  `deleted_at IS NULL AND moderation_status='approved' AND test_user_visible(...)`.
  Drafts, abgelehnte und gelöschte Tags sind damit für Fremde unsichtbar.
- **Bewertung: B – korrektes und bewusstes Verhalten.**

## 3. `comments` – Policy `comments_select` gilt für `{public}`

- **Tatsächliche Leserollen:** `anon` (nur SELECT), `authenticated`, `service_role`.
  Hier ist Gastlesen tatsächlich möglich.
- **USING für anon:** `user_id = NULL` und `has_role(NULL,'admin')` sind falsch,
  wirksam bleibt `can_view_post(post_id) AND test_user_visible(user_id)`.
  `can_view_post` reduziert sich ohne Sitzung auf
  „Beitrag existiert, `hidden_at IS NULL`, `visibility='public'`, Autor kein Testnutzer“.
- **Kann ein Gast geschützte Inhalte lesen?** Nein. Kommentare zu Beiträgen mit
  `connections`/`following`/`private` sowie zu moderativ ausgeblendeten Beiträgen
  (`hidden_at`) werden von `can_view_post` abgewiesen. Kontrollabfrage in
  Production: alle vorhandenen 9 Kommentare hängen an öffentlichen, nicht
  ausgeblendeten Beiträgen; es existiert derzeit kein nicht-öffentlicher Beitrag.
- **ID-Manipulation:** ein geratener `post_id`/`id`-Filter ändert nichts, da die
  USING-Bedingung pro Zeile geprüft wird. Einbettungen auf `posts`/`profiles`
  scheitern für anon am fehlenden Tabellenrecht (`42501`) – Klarnamen, Handles
  und Profildaten sind über diesen Weg nicht erreichbar.
- **Tatsächlich exponierte Daten:** `id`, `post_id`, `user_id` (UUID),
  `body`, `slang_tag_ids`, `parent_id`, `created_at` – ausschließlich zu
  öffentlichen Beiträgen. Keine E-Mail, kein Klarname, keine Standortdaten.
- **Bewertung: C – breiter als nötig, kein Datenleck.** Für die Gästeansicht
  geteilter Beiträge werden Kommentare serverseitig geladen; das anon-Recht ist
  dafür nicht zwingend erforderlich. Eine Einschränkung auf `authenticated`
  wäre reine Angriffsflächen-Reduktion (Enumerierbarkeit öffentlicher
  Kommentartexte), kein Schutz privater Daten. **Bewusst nicht geändert.**

## 4. `channel_categories` – „readable by public role“

- **Policies:** `categories readable` (SELECT, `{public}`, `USING is_active`) und
  `admins manage categories` (ALL, nur `authenticated` + Adminrolle).
- **Exponierte Daten:** Katalogdaten eines redaktionellen Verzeichnisses
  (Name, Slug, Icon, Sortierung, Übersetzungen). Keine Nutzerdaten.
  Inaktive Kategorien sind gefiltert (`is_active=eq.false` → 0 Zeilen;
  derzeit 169 aktive, 0 inaktive).
- **Schreibpfad:** `anon` besitzt aus den Plattformvorgaben pauschale
  INSERT/UPDATE/DELETE-Rechte, es existiert dafür jedoch **keine** Policy.
  Praxistest: `POST /rest/v1/channel_categories` als Gast →
  `401 / "new row violates row-level security policy"`. Schreiben ist wirksam
  blockiert.
- **Bewertung: B – korrektes und bewusstes öffentliches Verzeichnis**
  (mit Randnotiz C für die überflüssigen anon-Schreibrechte, die RLS bereits
  neutralisiert). **Bewusst nicht geändert.**

## 5. Sicherheit der Hilfsfunktionen

| Funktion              | Befund                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `can_view_post`       | `STABLE SECURITY DEFINER`, `search_path=public`, liefert nur `boolean`, Identität aus `auth.uid()`     |
| `test_user_visible`   | dito; ruft `can_view_test_users` auf, das für `anon` **nicht** ausführbar ist – zulässig, da DEFINER   |
| `can_view_test_users` | EXECUTE nur `postgres`/`service_role`; ohne Sitzung `false`                                            |
| `are_connected`       | prüft ausschließlich `status='accepted'`, gibt keine Zeilen zurück                                     |
| `is_following`        | rein boolesch                                                                                         |

Kein Eskalationspfad: keine Funktion nimmt eine Nutzerkennung als Vertrauensquelle,
keine gibt Inhalte zurück, alle setzen einen festen Suchpfad. Ohne Sitzung ist
`auth.uid()` NULL, wodurch alle Eigentümer-, Admin- und Beziehungszweige
deterministisch `false` ergeben.

## 6. Production Security Gate

| Finding             | Anon-Leserecht | Private Daten erreichbar | Kategorie | Aktion                |
| ------------------- | -------------- | ------------------------ | --------- | --------------------- |
| `posts`             | nein (`42501`) | nein                     | **B**     | keine                 |
| `slang_tags`        | nein (`42501`) | nein                     | **B**     | keine                 |
| `comments`          | ja             | nein (nur zu öffentl. Beiträgen) | **C** | keine, dokumentiert |
| `channel_categories`| ja (Katalog)   | nein                     | **B**     | keine                 |

Zusätzlich stichprobenartig als Gast geprüft: `profiles` → `42501`,
`connections` → `[]`, `messages` → `[]`.

**Gate-Ergebnis: 🟢 GRÜN – keine Kategorie A, keine Kategorie D.**
Kein Launch-Blocker. Es ist nachgewiesen, dass die als „public“ gemeldeten
Policies keine privaten, connection-only, Draft- oder moderierten Inhalte über
den anon-Zugang freigeben und dass IDs oder Requestparameter die
USING-Bedingungen nicht umgehen können. Production wurde durch diesen Audit
nicht verändert.
