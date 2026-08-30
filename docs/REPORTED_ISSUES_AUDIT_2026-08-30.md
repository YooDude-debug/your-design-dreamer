# Audit der 2 gemeldeten Probleme (2026-08-30)

Read-only Audit. **Keine** Änderung an Code, RLS, Policies, GRANTs, `can_view_post`
oder der SlangTag-Logik. Performance-Release 2026-08-29 unangetastet.

---

## Problem 1 – Lange Beiträge (> 300 Zeichen) ohne SlangTag lassen sich nicht veröffentlichen

**Reproduzierbar: JA** (deterministisch, rein applikativ, ohne DB-Beteiligung)

### Reproduktion (Matrix)

| Fall | Caption | SlangTag | gesendeter `title` | Ergebnis |
| --- | --- | --- | --- | --- |
| A | kurz (< 300) | nein | Caption-Text (kurz) | ✅ veröffentlicht |
| B | > 300 Zeichen | nein | **Caption-Text (> 300)** | ❌ Abbruch, generische Meldung |
| C | > 300 Zeichen | ja | `"$name"` (kurz) | ✅ veröffentlicht |
| D | kurz | ja | `"$name"` | ✅ veröffentlicht |

Validator-Nachweis (isolierter Zod-Lauf mit dem Produktionsschema):

```
title 120 Zeichen → OK
title 350 Zeichen → too_big: expected string to have <=300 characters
```

### Root Cause

1. `src/components/CreatePostDialog.tsx:642`

   ```ts
   title: first ? `$${first.name}` : description.trim() || t.post,
   ```

   Ohne SlangTag wird die **vollständige Caption** zusätzlich in `title` gespiegelt.

2. `src/lib/post-moderation.functions.ts:30` – `createSchema.title: z.string().max(300)`.
   Die Prüfung läuft im `.inputValidator()` von `createModeratedPost`, also **vor**
   `.handler()` und damit vor jedem Datenbankzugriff.

3. `src/lib/data.tsx:1749-1753` fängt den Fehler ab, loggt `[post] post_insert_error`
   und zeigt `modFailed` („Prüfung fehlgeschlagen“) – daher wirkt es wie ein
   Moderations-/Serverfehler statt wie ein Längenlimit.

### Wird der Beitrag geschrieben?

**Nein.** Der Abbruch erfolgt im Input-Validator der Server-Funktion; es gibt kein
`INSERT` in `public.posts`. Hochgeladene Medien werden im `catch` über
`removeUploads([...])` entfernt – kein Datenmüll, aber der **Eingabetext im Dialog
ist nach dem Fehlschlag verloren**, was den Eindruck „Beitrag verschwunden“ erzeugt.

- Client oder Server: Fehler entsteht **serverseitig** (Zod), Ursache ist die
  **clientseitige Feldbelegung**.
- Fehlermeldung (intern): `Too big: expected string to have <=300 characters` (Pfad `title`).
- Betroffene Funktion/Route: `createModeratedPost` (POST-Server-Funktion), aufgerufen aus `createPost` in `src/lib/data.tsx`.
- DB/RLS beteiligt: **nein**. `public.posts` hat keine Längen-Constraints und keinen blockierenden Trigger.

### Sicherheitsauswirkung

**Keine.** Fail-closed, kein Datenabfluss, keine Rechteausweitung. Reine UX/Conversion.

### Vorgeschlagene minimale Lösung (nicht umgesetzt)

Nur im Client, ohne SlangTag-Logik anzufassen: Fallback-Titel auf ≤ 300 Zeichen
kürzen (z. B. `description.trim().slice(0, 300)`), und im Fehlerfall eine
spezifische Meldung statt `modFailed` anzeigen. Optional: Dialoginhalt bei
Fehlschlag erhalten.

### Mögliche Nebenwirkungen

Gekürzte Titel in Ansichten, die `title` nutzen; `src/lib/post-caption.ts`
unterdrückt Doppelanzeige von Titel + Caption bereits, also keine sichtbare
Regression im Feed. Kein Einfluss auf Moderation (Textprüfung erhält weiterhin
die vollständige `description`).

### Benötigte Tests

- Unit: Titel-Fallback wird auf 300 Zeichen begrenzt (A–D-Matrix).
- Unit: `post-caption` zeigt keinen doppelten Text bei gekürztem Titel.
- E2E: Beitrag mit 1.000 Zeichen ohne SlangTag wird veröffentlicht und erscheint im Feed.

**Bewertung: 🟡 echter Fehler, sichere Lösung vorhanden (rein clientseitig).**

---

## Problem 2 – „permission denied for function can_view_post“ für Ausgeloggte

**Reproduzierbar: NEIN** (für echtes `anon` nicht mehr; Altlast, bereits durch
Migration vom 2026-08-28 behoben)

### Rechte- und Definitionslage (Live geprüft)

| Prüfpunkt | Ergebnis |
| --- | --- |
| `can_view_post(uuid)` | `SECURITY DEFINER`, `search_path=public` |
| EXECUTE | `postgres`, `anon`, `authenticated`, `service_role` – anon **hat** EXECUTE |
| `test_user_visible(uuid)` | SECURITY DEFINER, fixierter search_path, EXECUTE u. a. für `anon` |
| `can_view_profile(uuid)` | SECURITY DEFINER, **kein** anon-EXECUTE (gewollt) |

### Policies, die `can_view_post` aufrufen

| Tabelle | Policy | CMD | Rollen |
| --- | --- | --- | --- |
| comments | comments_select | SELECT | `public` (inkl. anon) |
| comments | comments_insert_own | INSERT | authenticated |
| comment_translations | comment_translations_select | SELECT | authenticated |
| post_hashtags | post_hashtags_select_visible | SELECT | authenticated |
| post_translations | post_translations_read | SELECT | authenticated |
| post_likes / post_saves / post_shares / post_views | *_insert_own | INSERT | authenticated |

Nur der `comments`-SELECT-Pfad ist für anon erreichbar – exakt der Pfad, der
historisch fehlschlug.

### Live-Verifikation mit dem öffentlichen (anon) Key

| Request | Ergebnis |
| --- | --- |
| `GET /comments?select=id,post_id` | **200**, Rows – kein Funktionsfehler |
| `GET /post_shares`, `/post_likes`, `/post_hashtags`, `/post_translations`, `/comment_translations` | **200 `[]`** (Policies nur `authenticated` → still leer) |
| `GET /posts?select=id` | **401 / 42501 permission denied for table posts** (mit Hint „GRANT SELECT … TO anon“) |
| ungültiges/abgelaufenes Bearer-Token | **401 PGRST301** (JWT-Fehler vor jeder Policy-/Funktionsauswertung) |
| eingeloggter Nutzer | Policies greifen wie modelliert, `can_view_post` ausführbar |

### Root Cause der Meldung

- Migration `20260801124755…`: `REVOKE ALL ON FUNCTION public.can_view_post(uuid) FROM PUBLIC, anon;`
  während `comments_select` weiterhin für Rolle `public` galt → jeder anonyme
  `SELECT` auf `comments` endete in `permission denied for function can_view_post`.
- Migration `20260828090228…`: `GRANT EXECUTE … TO anon, authenticated, service_role` → behoben.

Verbleibende Fehlerbilder für Ausgeloggte stammen aus zwei anderen Klassen:
`permission denied for **table** posts` (gewollt; öffentliche Beitragsseiten laufen
über `src/lib/public-post.functions.ts` mit kontrollierter Feldauswahl) und
`JWT expired/invalid` bei abgelaufener Session. Beide werden in der Oberfläche
generisch dargestellt und daher leicht verwechselt.

### Ist das Verhalten beabsichtigt?

Ja. Anonyme Leserechte bestehen gewollt nur für `comments` zu öffentlichen
Beiträgen. `posts`, `profiles`, `slang_tags` bleiben für anon direkt gesperrt.
`can_view_post` gibt ausschließlich `boolean` zurück, leitet die Identität nur
aus `auth.uid()` ab und respektiert weiterhin `hidden_at`, Visibility,
Connections/Following und `test_user_visible`.

### Sicherheitsauswirkung / erforderliche Änderungen

Keine Rechteausweitung nötig; der bestehende EXECUTE-Grant an `anon` genügt und
ist nicht privilegierend. `GRANT SELECT ON public.posts TO anon` (PostgREST-Hint)
wäre eine echte Ausweitung der Angriffsfläche und wird **nicht** empfohlen.

### Vorgeschlagene minimale Lösung (nicht umgesetzt)

Nur UX: 401/PGRST301 im Client als „Sitzung abgelaufen – bitte neu anmelden“
darstellen und stille leere Ergebnisse nicht als Fehler melden. Keine DB-Änderung.

### Mögliche Nebenwirkungen / Tests

Nebenwirkungen: keine (nur Meldungstexte). Tests: Integrationstest „anon
`GET /comments` → 200“, „anon `GET /posts` → 42501“, „ungültiges Token → PGRST301“
– Erweiterung von `tests/integration/db-anon-access.test.ts`.

**Bewertung: 🟢 kein Problem / Fehlinterpretation (Altlast, bereits behoben; Rest ist UX).**

---

## Gate

- Problem 1: 🟡 – Client-Titelbelegung vs. 300-Zeichen-Validator, ohne Sicherheitsbezug.
- Problem 2: 🟢 – bereits behoben, keine Rechte-/Policy-Änderung erforderlich.
- Es wurden **keine** Änderungen vorgenommen (kein Code, keine Migration, keine Policy, kein GRANT).
