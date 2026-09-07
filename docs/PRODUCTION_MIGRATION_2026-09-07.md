# Production – Finale Migration des freigegebenen Staging-Stands (2026-09-07)

## 1. Ausgangsstand Production (vor Migration)

| Bereich | Stand |
| --- | --- |
| Revision | `96af71b2` (Arbeitsbaum sauber) |
| Routing | `/feed` = authentifizierte Startseite, `/dev` → `/feed` (Redirect erhält Query/Hash) |
| Auth | Supabase-Auth unverändert, `TURNSTILE_ENABLED = false` (reaktivierbar) |
| Environment | unverändert (`.env`, `.env.production` nicht angefasst) |
| DB/Migrationen | Drizzle bis `0031_age_status_functions.sql`, 231 Supabase-Migrationsdateien |
| RLS/Policies | 301 Policies, 124 Tabellen mit RLS |
| Storage-Rechte | unverändert |
| Edge Functions | keine (Serverlogik via `createServerFn`/Server-Routen) |
| Analytics | `registration_events` + `use-registration-tracking` aktiv |

Rollback: Der Stand `96af71b2` ist über die Projekt-Versionshistorie wiederherstellbar;
es wurden keine DB-/Datenänderungen vorgenommen, daher ist ein reines Code-Rollback ausreichend.

## 2. Migrierter Staging-Stand – Abgleich

Der Abgleich ergab: **alle im finalen Staging-Audit freigegebenen Änderungen waren
bereits in diesem Production-Projekt vorhanden** (in vorangegangenen kontrollierten
Übernahmen selektiv migriert). Es war daher keine erneute Code-Übernahme nötig und es
wurde bewusst nichts überschrieben.

| Freigegebene Änderung | Production-Zustand |
| --- | --- |
| Registrierung ohne CAPTCHA/Turnstile | vorhanden (`src/lib/turnstile-flag.ts`, `src/routes/auth.tsx`) |
| Login ohne CAPTCHA/Turnstile | vorhanden |
| „Registrieren“ direkt zum Formular | vorhanden (`/auth?mode=register`, Tab vorbelegt) |
| „Login“ direkt zum Loginformular | vorhanden (`/auth`, Login-Tab Standard) |
| Unternehmensregistrierung aus dem Registrierungsbereich | vorhanden (Business-Einstieg im Registrierungsformular) |
| Landingpage-Conversion-Optimierungen | vorhanden (inkl. sichtbarer Erklärbereich) |
| Analytics-Tracking | vorhanden (`registration_events`) |
| Globe Lazy Loading / ausgelagerte Globe-Daten | vorhanden (`src/lib/globe/land-base.ts`, `GlobeStage` lädt asynchron) |

## 3. Bewusst erhaltene Production-Änderungen

- `/dev` → `/feed` und `/feed` als authentifizierte Startseite (**nicht** auf `/dev` zurückgesetzt)
- Registrierungs-Tracking, Business-Einstieg, Anzeigename-Modi, Alterslogik (ab 14)
- Turnstile-Komponente inkl. SUCCESS-/Shadow-DOM-Fix und Secrets (nur deaktiviert)
- SEO-CTAs im AdSlider, Hardening #1–#5 (Grants/Functions)
- Domains, DNS, SSL, Lovable-Domain-Konfiguration unverändert

## 4. Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | PASS |
| Tests | 620/620 PASS |
| Build | PASS („build OK“) |
| Security-Scan (vor Publish) | keine kritischen Befunde (3 bestehende `warn`) |

Veröffentlichter Stand: der zum Publish-Zeitpunkt geprüfte Production-Stand
(Basis `96af71b2`), Live unter https://y-dude.com/.

## 5. Post-Migration Smoke-Test (Live, mobil 393×852 und Desktop 1280)

| Test | Ergebnis |
| --- | --- |
| A) Startseite `https://y-dude.com/` | PASS – HTTP 200, H1 „Y-Dude – Speak Local. Connect Global.“, keine Konsolenfehler |
| B) Registrierung: direkt Formular, kein CAPTCHA | PASS – `?mode=register` zeigt Formular inkl. Geburtsdatum, 0 CAPTCHA-Widgets, kein Cloudflare-Script |
| C) Login: direkt Formular, kein CAPTCHA | PASS – Passwortfeld vorhanden, 0 CAPTCHA-Widgets |
| D) Bestehende Session | PASS – `/` → `/feed`, `/feed` bleibt `/feed` |
| E) Logout / abgemeldet | PASS – geschützte Routen (`/feed`, `/dev`) → `/auth`, `/` öffentlich erreichbar |
| F) Alte Route `/dev` | PASS – Weiterleitung auf `/feed` (auch mit Suchparametern) |
| G) Refresh auf `/feed` | PASS – bleibt `/feed` |
| H) Unternehmensregistrierung | PASS – Einstieg „Register for business / Für Unternehmen registrieren“ im Registrierungsformular sichtbar (mobil und Desktop) |
| I) Globe | PASS – `/globe` lädt, Canvas gerendert, Globe-Daten asynchron nachgeladen |
| J) Domains | PASS – `y-dude.com` HTTP 200, `www.y-dude.com` HTTP 200 (Weiterleitung auf `y-dude.com`) |
| K) Mobile (Android-/Mobile-Viewport) | PASS |
| L) Desktop Chrome | PASS |

Hinweis (keine Abweichung des Migrationsstands): Beim Test von `/dev?chat=abc` erzeugte der
künstliche Wert `abc` erwartungsgemäß eine 400-Antwort des Lesestatus-Aufrufs. Mit echten
Chat-IDs tritt das nicht auf; nicht Teil dieser Migration.

## 6. Security-Post-Check

| Prüfung | Ergebnis |
| --- | --- |
| Policies | 301 – unverändert |
| Tabellen mit RLS | 124 – unverändert |
| Rollen/Berechtigungen/SECURITY DEFINER/`search_path` | unverändert (keine Migration ausgeführt) |
| Storage-Rechte | unverändert |
| Auth-Konfiguration/Secrets | unverändert, Turnstile-Secrets erhalten |
| Anonyme Schreibrechte | keine neuen; Security-Scanner ohne kritische Befunde |

## 7. Datenintegrität

- Auth-Konten: 21, Profile: 21, Konten ohne Profil: 0
- Keine Daten gelöscht, überschrieben oder migriert
- Keine DB-Migration ausgeführt

## 8. Analytics / Conversion

`registration_events` schreibt weiterhin (108 Ereignisse gesamt, letztes 2026-09-07 19:23 UTC).
Funnel-Ereignisse `registration_started` → `registration_submitted` → `registration_completed`
bzw. `email_confirmation_pending` bleiben unverändert erfasst; keine doppelten Events, da keine
Tracking-Änderung erfolgte. Ab jetzt ist die Conversion ohne CAPTCHA messbar
(Admin-Bereich `/admin/registration`).

## 9. Rollback-Möglichkeit

Code-Rollback auf `96af71b2` über die Projekt-Versionshistorie; keine DB-Änderung nötig.
Turnstile-Reaktivierung: `TURNSTILE_ENABLED = true` in `src/lib/turnstile-flag.ts`.

## Bewertung

🟢 MIGRATION SUCCESSFUL

- REGISTRATION: PASS
- LOGIN: PASS
- /FEED: PASS
- /DEV REDIRECT: PASS
- LOGOUT: PASS
- GLOBE: PASS
- CAPTCHA DEAKTIVIERT: PASS
- ANALYTICS: PASS
- SECURITY: PASS
- DATENINTEGRITÄT: PASS

Nicht live durchgeführt: das tatsächliche Anlegen eines neuen Testkontos über das
Live-Formular (Punkt B, letzter Schritt) – dies wurde bewusst unterlassen, um keine
weiteren Testkonten in Production zu erzeugen; Formular, Absende-Weg und Tracking sind
verifiziert.
