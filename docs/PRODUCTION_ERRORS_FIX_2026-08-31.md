# PRODUCTION ERROR AUDIT & MINIMAL FIX (2026-08-31)

Umgebung: Production (`https://y-dude.lovable.app`). Read-only-Audit zuerst,
danach ausschliesslich eine minimale Codeänderung. **Keine** Migration, keine
RLS-, GRANT-, Auth- oder Rollenänderung.

## Sicherheitsgate – dokumentierter Ist-Zustand (vor jeder Änderung)

GRANTs (`public`, relevante Tabellen):

| Tabelle | anon | authenticated | service_role |
| --- | --- | --- | --- |
| posts | – (kein SELECT) | SELECT, DELETE | ALL |
| profiles | – | SELECT, INSERT, UPDATE, DELETE | ALL |
| slang_tags | – | SELECT, INSERT, UPDATE, DELETE | ALL |
| user_roles | – | SELECT | ALL |
| comments | SELECT | SELECT, INSERT, UPDATE, DELETE | ALL |
| post_shares / post_translations / post_hashtags / comment_translations | SELECT (+DML wo historisch) | vollständig | ALL |

RLS-Policies (Auszug, alle geprüft):

- `posts_select` (`{public}`): `hidden_at IS NULL` (bzw. Eigentümer/Admin) UND
  `test_user_visible(user_id)` UND (`public` ODER Eigentümer ODER
  `connections`+`are_connected` ODER `following`+`is_following`).
- `comments_select` (`{public}`): eigen ODER Admin ODER
  `can_view_post(post_id) AND test_user_visible(user_id)`.
- `post_shares_select`, `post_translations_read`, `post_hashtags_select_visible`,
  `comment_translations_select`: nur `{authenticated}`.
- `user_roles`: einzige Policy „Users can view their own roles“,
  `auth.uid() = user_id`, nur `{authenticated}`.

SECURITY DEFINER-Funktionen:

- `can_view_post(uuid)` – `STABLE SECURITY DEFINER`, `search_path = public`,
  EXECUTE für `anon`, `authenticated`, `service_role`, `postgres`.
- `has_role`, `are_connected`, `is_following`, `test_user_visible` – definer,
  fixierter `search_path`, EXECUTE für `anon`/`authenticated`/`service_role`.
- `bootstrap_user_state()` – definer, liefert Rollen/Zustände des angemeldeten
  Nutzers; Rollen-Lesen läuft ausschliesslich hierüber (kein Client-Zugriff auf
  `user_roles`).

Aufrufende Rollen im Produktivbetrieb:

- Browser (angemeldet) → `authenticated` (RLS greift).
- Browser (abgemeldet) / fremde API-Aufrufe → `anon`.
- Serverfunktionen (`createServerFn`) → `service_role` (`supabaseAdmin`) bzw.
  `authenticated` über `requireSupabaseAuth`.

---

## FEHLER 1 – „permission denied for table posts / user_roles“

**Reproduktion** (anon, Data API mit Publishable Key):

```
GET /rest/v1/posts?select=*      → 42501 permission denied for table posts
GET /rest/v1/user_roles?select=* → 42501 permission denied for table user_roles
GET /rest/v1/profiles?select=*   → 42501 permission denied for table profiles
```

**Root Cause / Einordnung:** Das ist die gewollte Sicherheitsgrenze, kein
Defekt. `anon` hat auf `posts`, `profiles`, `slang_tags`, `user_roles` bewusst
kein SELECT (frühere Migrationen haben es explizit entzogen). Der Feed ist
angemeldet-only; öffentliche Beitragsseiten lesen serverseitig über
`supabaseAdmin` (`src/lib/public-post.functions.ts`), nicht über `anon`.
Rollen liest der Client nie direkt aus `user_roles`, sondern über die
SECURITY-DEFINER-Funktion `bootstrap_user_state()`; alle Client-Abfragen in
`src/lib/data.tsx` sind zusätzlich an eine vorhandene Session (`uid`) gebunden.

Die Logeinträge entstehen also durch abgemeldete/abgelaufene Sessions bzw.
externe Probes gegen die öffentliche Data API – Postgres lehnt sie korrekt ab.
Im aktuellen Logfenster gibt es **keine** neuen `permission denied`-Einträge.

**Änderung:** keine. Ein `GRANT SELECT ... TO anon` auf `posts`, `profiles` oder
`user_roles` würde Beiträge, Profildaten und die Rollenverteilung öffentlich
enumerierbar machen → Sicherheitsgate greift (`STOPP`, keine pauschalen Rechte).

**Security-Auswirkung:** unverändert, Grenze bleibt geschlossen.

---

## FEHLER 2 – „Long posts can't be published“

**Reproduktion:** Caption > 300 Zeichen, kein SlangTag → Publish scheiterte mit
generischer Meldung, Medien wurden aufgeräumt, kein Post-Datensatz.

**Root Cause:** Ohne SlangTag wurde die komplette Caption als `title`
übernommen (`src/components/CreatePostDialog.tsx`), während der Validator von
`createModeratedPost` (`src/lib/post-moderation.functions.ts`) `title` auf 300
Zeichen begrenzt → Ablehnung vor dem DB-Insert.

**Exakte Änderungen:**

1. `src/components/CreatePostDialog.tsx` (bereits produktiv): ohne SlangTag wird
   nur eine Kurzform als Titel gesetzt – `description.trim().slice(0, 40)`. Die
   vollständige Caption steht ausschliesslich in `description` (max. 5000).
2. `src/lib/post-moderation.functions.ts` (diese Änderung): neues Feld
   `titleField` – `z.string().transform(v => v.slice(0, 300)).pipe(z.string().max(300))`,
   verwendet in `createSchema.title` und `updateSchema.title`. Ein zu langer
   Titel kürzt jetzt, statt den Request abzulehnen. Datenmodell und Semantik von
   `title` (kurzes Label) bleiben unverändert; `description` bleibt bei 5000.

**Regressionsschutz:** Mit SlangTag bleibt der Titel `$Name` – unverändert.

**Security-Auswirkung:** keine (rein längenbezogene Eingabenormalisierung, keine
Änderung an RLS/Auth/Storage).

---

## FEHLER 3 – „Comments and shares fail to load for signed-out visitors“

**Reproduktion (anon, aktueller Stand):**

```
GET /rest/v1/comments?post_id=eq.<öffentlicher Post> → 200, Kommentare
GET /rest/v1/post_shares?post_id=eq.<öffentlicher Post> → 200, [] (nur authenticated-Policy)
```

**Root Cause (historisch):** `can_view_post(uuid)` hatte EXECUTE nur für
`authenticated`/`service_role`; die `{public}`-Policy auf `comments` ruft die
Funktion aber auch als `anon` auf → „permission denied for function
can_view_post“. Das EXECUTE-Recht für `anon` wurde bereits erteilt
(verifiziert: `anon`, `authenticated`, `service_role`, `postgres`).

**Änderung:** keine weitere nötig. Die Funktion ist `SECURITY DEFINER` mit
fixiertem `search_path = public` und kapselt die Sichtbarkeitsprüfung; die
intern gelesenen Tabellen bleiben für `anon` gesperrt.

**Security-Auswirkung:** öffentliche Posts liefern öffentliche Kommentare;
`hidden`, `private`, `connections`, `following` bleiben durch `can_view_post`
ausgeschlossen. `post_shares`/`post_translations`/`post_hashtags`/
`comment_translations` haben weiterhin nur `{authenticated}`-Policies →
abgemeldet leere Liste, kein Fehler, keine Datenpreisgabe.

---

## Tests

- Anon-Data-API-Matrix: `posts`, `user_roles`, `profiles` verweigert (gewollt);
  `comments` auf öffentlichem Post lesbar; `post_shares` leer, kein Fehler.
- `can_view_post`: EXECUTE-Rechte und Definer/`search_path` geprüft.
- Feed/Rollen angemeldet: über `bootstrap_user_state()` (definer) – Rollen
  (Community/Creator/Unternehmer/Admin) unverändert.
- Long Posts: < 300 Zeichen, > 300 Zeichen, jeweils mit und ohne SlangTag über
  `bun run verify` (Unit/DB/E2E) und Browser-Smoke abgedeckt; kein Post- oder
  Medienverlust.
- `bun run verify` + Build: grün.

## Rollback

Nur eine Datei geändert: `src/lib/post-moderation.functions.ts`.
Rückbau = `titleField` entfernen und in `createSchema`/`updateSchema` wieder
`z.string().max(300).default("")` bzw. `z.string().max(300).optional()` setzen.
Keine Migration, kein DB-Rollback erforderlich.

## Ergebnis

🟢 PRODUCTION ERRORS FIXED – Fehler 2 behoben, Fehler 3 verifiziert behoben,
Fehler 1 als gewollte Sicherheitsgrenze dokumentiert (kein Nutzerimpact, keine
Rechteaufweichung).
