# Root-Cause-Audit – 2 bestehende Findings (2026-08-30)

Read-only. Keine GRANTs, keine RLS-/Policy-Änderungen, keine Migration.
Der Performance-Release 2026-08-29 wurde nicht angefasst.

---

## Finding 1 – Lange Beiträge (> ~300 Zeichen) ohne SlangTag lassen sich nicht veröffentlichen

**Status: reproduzierbar, Ursache eindeutig (Client-seitiger Feldschnitt, kein DB-Problem)**

Ablauf:

1. `src/components/CreatePostDialog.tsx:642`

   ```ts
   title: first ? `$${first.name}` : description.trim() || t.post,
   ```

   Ohne SlangTag (`tagIds` leer) wird der **komplette Caption-Text** in `title`
   geschrieben – zusätzlich zu `description`.

2. `src/lib/post-moderation.functions.ts:30-31`

   ```ts
   title: z.string().max(300).default(""),
   description: z.string().max(5000).default(""),
   ```

   Der Zod-Validator von `createModeratedPost` bricht bei `title.length > 300` ab.

3. `src/lib/data.tsx:1749-1754` fängt den Fehler ab, protokolliert
   `[post] post_insert_error` und zeigt die generische Meldung `modFailed`
   („Prüfung fehlgeschlagen“) – daher wirkt es für Nutzer wie ein Moderations-
   oder Serverfehler, nicht wie eine Längenbegrenzung.

Warum nur ohne SlangTag: mit SlangTag ist `title = "$name"` (kurz), das
Längenlimit greift dort nie. Deshalb betrifft der Fehler ausschließlich
Textbeiträge ohne SlangTag mit Caption > 300 Zeichen.

Nebeneffekt: die bereits hochgeladenen Medien werden korrekt wieder entfernt
(`removeUploads`), es entsteht kein Datenmüll.

Datenbank: `public.posts` hat **keine** Längen-Constraints (nur PK/FKs), kein
Trigger blockiert lange Texte. Das Limit ist rein applikativ.

Sicherheitsauswirkung: **keine** (Fail-closed, kein Datenverlust, kein Leak).
Auswirkung ist reine UX/Conversion (Beitrag nicht publizierbar, irreführende
Fehlermeldung).

Mögliche Behebungsrichtungen (nicht umgesetzt):
Titel beim Fallback auf ≤ 300 Zeichen kürzen bzw. Titel leer lassen und
Caption ausschließlich in `description` führen (`post-caption.ts` unterdrückt
Doppelanzeige bereits), plus spezifische Fehlermeldung.

---

## Finding 2 – „permission denied for function can_view_post“ für signed-out Besucher

**Status: für echtes `anon` aktuell NICHT mehr reproduzierbar (Altlast); verbliebene
Fehlerbilder haben andere Ursachen**

### Aktuelle Rechte- und Definitionslage

| Prüfpunkt | Ergebnis |
| --- | --- |
| `can_view_post(uuid)` EXECUTE | `anon`, `authenticated`, `service_role`, `postgres` – **anon hat EXECUTE** |
| SECURITY | `SECURITY DEFINER`, `STABLE`, `LANGUAGE sql` |
| `search_path` | `SET search_path TO 'public'` (fixiert, korrekt) |
| verschachtelte Helfer | `has_role`, `test_user_visible`, `are_connected`, `is_following` – alle SECURITY DEFINER mit fixiertem search_path; laufen im Definer-Kontext, eigene anon-Grants dort nicht erforderlich |
| Policies, die `can_view_post` nutzen | `comments_select` (Rolle `public`, also inkl. anon), sowie `post_hashtags_select_visible`, `post_translations_read`, `comment_translations_select`, mehrere INSERT-`WITH CHECK` – diese ausschließlich `authenticated` |

### Historie (Ursache des gemeldeten Fehlers)

- Migration `20260801124755…`: `REVOKE ALL ON FUNCTION public.can_view_post(uuid) FROM PUBLIC, anon;`
  → gleichzeitig blieb `comments_select` für Rolle `public` bestehen.
  Ab diesem Punkt lief jeder anonyme `SELECT` auf `comments` in
  `permission denied for function can_view_post` statt in ein leeres Ergebnis.
- Migration `20260828090228…`: `GRANT EXECUTE … TO anon, authenticated, service_role;`
  → Fehlerbild für `anon` behoben.

Das erklärt auch das „teilweise“: betroffen war nur der Pfad
`comments` (Rolle `public`); Shares/Likes-Pfade sind ohnehin
`authenticated`-only und liefern für anon leere Mengen ohne Fehler.

### Live-Verifikation mit dem öffentlichen (anon) Key

| Request | Ergebnis |
| --- | --- |
| `GET /comments?select=id,post_id` | `200`, Rows – kein Permission-Fehler |
| `GET /post_shares`, `/post_likes`, `/post_views` | `200 []` (Policy nur `authenticated` → still leer) |
| `GET /post_translations` | `200 []` |
| `GET /posts?select=id` | `401 / 42501 permission denied for **table** posts` |

### Abgelaufene Session vs. echtes anon

- **Echtes anon** (nur `apikey`): kein Funktionsfehler mehr (siehe oben).
- **Abgelaufene Session**: der Client sendet weiterhin ein Bearer-Token; PostgREST
  antwortet mit `401 PGRST301 JWT expired`, bevor Policies/Funktionen ausgeführt
  werden. Diese Fehlerklasse kann `can_view_post` gar nicht erreichen und wird in
  der UI nur ähnlich generisch dargestellt.
- Ein verbleibendes „permission denied“ für Ausgeloggte betrifft **`table posts`**,
  nicht die Funktion. Öffentliche Beitragsseiten umgehen das bewusst über die
  Server-Funktion `src/lib/public-post.functions.ts`, die intern den privilegierten
  Client verwendet und nur die freigegebenen Felder eines öffentlichen Beitrags
  ausliefert.

### Welche öffentlichen Daten sollen über `can_view_post` erreichbar sein

Nur Sichtbarkeits-Entscheidung („darf dieser Beitrag gesehen werden“) für:
öffentliche, nicht versteckte, nicht-Testnutzer-Beiträge. Die Funktion gibt
ausschließlich `boolean` zurück, keinerlei Inhalt. Anonyme Leserechte bestehen
gewollt für `comments` zu öffentlichen Beiträgen; `posts`, `profiles`,
`slang_tags` bleiben für anon direkt gesperrt (Auslieferung nur über
kontrollierte Server-Funktionen).

### Ist eine Berechtigungserhöhung erforderlich?

**Nein.** Der bestehende EXECUTE-Grant an `anon` ist ausreichend und nicht
privilegierend: `can_view_post` liefert nur ein Boolean, hat fixierten
`search_path` und leitet die Identität ausschließlich aus `auth.uid()` ab.
Weitere GRANTs (insbesondere `SELECT ON public.posts TO anon`, wie im
PostgREST-Hint vorgeschlagen) wären eine echte Ausweitung der Angriffsfläche und
werden **nicht** empfohlen.

### Sicherheitsbewertung

| Aspekt | Bewertung |
| --- | --- |
| Datenabfluss | keiner – Boolean-Rückgabe, keine Inhalte |
| Privilege Escalation | nicht möglich (definer + fixierter search_path + `auth.uid()`) |
| Verbliebenes Risiko | nur UX: generische Fehlermeldungen bei 401/JWT-expired |
| Einstufung | **A- / akzeptabel**, kein Handlungsbedarf an Rechten |

---

## Gate-Ergebnis

- Finding 1: **echter Bug** (Client-Titelbelegung vs. 300-Zeichen-Validator), rein funktional, ohne Sicherheitsbezug.
- Finding 2: **Altlast**, Ursache identifiziert und durch Migration vom 2026-08-28 bereits behoben; verbleibende Meldungen sind `table posts`/`JWT expired`, keine Funktionsrechte.
- Es wurden **keine** Änderungen vorgenommen.
