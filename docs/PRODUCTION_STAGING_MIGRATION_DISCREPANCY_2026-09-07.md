# Production/Staging – Abweichung der Startseite (Diagnose)

Datum: 2026-09-07 · Modus: **read-only** · Code geändert: NEIN · DB geändert: NEIN · Deployment: NEIN

## 1. Autorisierter Staging-Stand

- Staging-Projekt: `Y-Dude Staging` (ID `4a5bd367-098d-4501-b206-9e1696fcc09c`)
- Read-only-Snapshot-Revision: **`36c49182`**
- Landingpage-Dateien: `src/routes/index.tsx`, `src/components/landing/SlangTagTester.tsx`,
  `src/components/landing/InstallAppButton.tsx`, `src/lib/i18n-auth.ts`
- Live geprüft: `https://y-dude-staging.lovable.app/` → HTTP 200, enthält
  „Kostenlos registrieren“ (1×), „Y-Dude auch als App nutzen“ (1×), „Zugang:“ (0×).
  Die ABOUT-Texte („Was ist Y-Dude?“) sind vorhanden, aber **nur `sr-only`**.

## 2. Aktueller Production-Stand

- Production-HEAD: **`285e3085`** („Migrierten Stand livegesetzt“); Arbeitsbaum sauber.
- Live geprüft: `https://y-dude.com/` → HTTP 200, enthält „Was ist Y-Dude?“ (1×, sichtbar),
  „Jetzt Y-Dude entdecken“ (1×), „Zugang:“ (1×), „Kostenlos registrieren“ (0×).
- Die live ausgelieferte Startseite entspricht **exakt** dem lokalen Production-Quellstand `285e3085`.

## 3. Diff (Staging `36c49182` → Production `285e3085`)

| Bereich | Staging (autorisiert) | Production (live) |
|---|---|---|
| Hero-Zusatzsatz | `valueProp`: „Entdecke Stimmen, Slang und Geschichten …“ vorhanden | fehlt (Key `valueProp` in `i18n-auth.ts` nicht vorhanden) |
| Vorschau-Titel | „Vorschau auf Y-Dude“ | „SlangTag Tester“ |
| Vorschau-CTA | „Kostenlos registrieren“ + Unterzeile „E-Mail bestätigen und direkt loslegen.“ (`discoverSub`) | „Jetzt Y-Dude entdecken“, keine Unterzeile |
| App-Hinweis | `InstallAppButton` **innerhalb** `SlangTagTester` | `InstallAppButton` in eigener Sektion in `index.tsx` |
| E-Mail-/Zugangshinweis | nicht im Hero-Abschluss | Sektion „Zugang: Registrieren, E-Mail bestätigen, los geht's.“ |
| „Was ist Y-Dude?“ | `<section className="sr-only">` (unsichtbar) | sichtbare Sektion mit H2 + zwei H3-Karten („SlangTag – Slang als Sound“, regionale Sprache) |
| Analytics | `trackChallenge("challenge_seen")` beim Seitenaufruf | dieser Aufruf nicht vorhanden |
| Routing / Auth-Einstieg | `/feed` als Ziel, direkte `/auth`-Einstiege | identisch, plus Production-Korrektur `/dev → /feed` (erhalten) |

## 4. Migrationsprozess

Die Migration wurde **nicht** als Übernahme des Staging-Commits durchgeführt, sondern als
selektive Übernahme der ausdrücklich genannten Punkte (CAPTCHA-Deaktivierung, direkte
Auth-Einstiege, Unternehmensregistrierung, Analytics, Globe-Lazy-Loading, `/feed`).
Die Landingpage-Dateien waren nicht Teil dieser Liste und blieben auf dem Production-Stand.

- Falsches Projekt: NEIN
- Falscher Branch/Commit deployed: NEIN (`285e3085` ist der Stand, der live ist)
- Alter Build ausgeliefert: NEIN
- Cache/CDN-Problem: NEIN – Antwort-Header `cache-control: no-cache, must-revalidate, max-age=0`;
  der Live-HTML-Inhalt stimmt Textmerkmal für Textmerkmal mit dem Quellstand `285e3085` überein
  (siehe Zähler in Abschnitt 2).

## 5. Herkunft der nicht autorisierten sichtbaren Beschreibung

- Datei: `src/routes/index.tsx` (Texte in `ABOUT`/`SEO_DESCRIPTION` dort definiert)
- Texte eingeführt in Production-Commit `d315d4c2` (2026-08-25), damals `sr-only`.
- **Sichtbar gemacht** in Production-Commit `72bc97ac` (2026-09-07 18:31 UTC,
  „Made homepage content visible“) – Reaktion auf das SEO-Finding
  `agent_content:content` („Homepage content is visually hidden“).
- Im autorisierten Staging-Stand ist der Text vorhanden, aber ausschließlich `sr-only`.
- Der abweichende Vorschau-Titel/CTA stammt aus dem älteren Production-Stand von
  `SlangTagTester.tsx`/`i18n-auth.ts`, der nie durch die Staging-Version ersetzt wurde.

## 6. Antworten

1. Autorisierter Staging-Stand: `36c49182`
2. Production aktuell: `285e3085`
3. Identisch: **NEIN**
4. Grund: Migration war selektiv; Landingpage-Dateien waren nicht im Übernahmeumfang.
   Zusätzlich wurde in Production der SEO-Fix `72bc97ac` angewendet, der die ABOUT-Sektion
   sichtbar machte.
5. „Was ist Y-Dude?“: aus Production-Historie (`d315d4c2`), sichtbar durch `72bc97ac`.
6. Staging-Landingpage deployed: **NEIN**
7. Klassifizierung: **kein** falsches Projekt, **kein** falscher Deploy, **kein** Cache-Problem –
   sondern unvollständiger Migrationsumfang plus nachträglicher SEO-Fix in Production.
8. Minimale Korrektur (nach Freigabe): Übernahme von exakt vier Dateien aus Staging `36c49182` –
   `src/routes/index.tsx`, `src/components/landing/SlangTagTester.tsx`,
   `src/components/landing/InstallAppButton.tsx`, `src/lib/i18n-auth.ts` (nur Landing-Keys) –
   unter Beibehaltung von `/dev → /feed`, CAPTCHA-Deaktivierung, Auth-Einstiegen und
   Unternehmensregistrierung. Konsequenz: das SEO-Finding „hidden content“ kommt zurück,
   weil ABOUT dann wieder `sr-only` ist.

## 7. Unverändert

Datenbank, Auth, RLS, Policies, User, Profile, Posts, Analytics-Daten, DNS, Domains, SSL,
Secrets, Storage, Functions, Routing (`/dev → /feed` bleibt bestehen).
