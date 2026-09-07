# Production-Landingpage auf autorisierten Staging-Stand + SEO erhalten

Datum: 2026-09-07 · Basis Production `285e3085` · Referenz Staging `36c49182`
Veröffentlicht: **NEIN** (wartet auf Freigabe) · DB/RLS/Policies/Secrets/Daten: **unverändert**

## Geänderte Dateien (4)

| Datei | Änderung |
|---|---|
| `src/routes/index.tsx` | Staging-One-Screen übernommen; sichtbare lange ABOUT-Sektion entfernt; stattdessen kompakter aufklappbarer Erklärbereich; Analytics `challenge_seen` (Startseite besucht) wieder aktiv |
| `src/components/landing/SlangTagTester.tsx` | Staging-Version: Titel „VORSCHAU AUF Y-DUDE“, CTA „Kostenlos registrieren →“ mit Unterzeile, App-Hinweis im Tester; SEO-Fix beibehalten (`<h2 id="tester-title">` + `aria-labelledby`) |
| `src/components/landing/InstallAppButton.tsx` | Staging-Version: dezenter Hinweis „Y-Dude auch als App nutzen“ |
| `src/lib/i18n-auth.ts` | nur `valueProp` (de/en/el) ergänzt: „Entdecke Stimmen, Slang und Geschichten …“ – alle Auth-/Turnstile-Keys unverändert |

## Übernommen aus Staging (sichtbar)

Logo, „SPEAK LOCAL. CONNECT GLOBAL.“, „Ein Sound. Eine Region. Millionen Geschichten.“,
valueProp-Satz, „VORSCHAU AUF Y-DUDE“ + SlangTag-Vorschau, „Kostenlos registrieren →“,
„Y-Dude auch als App nutzen“, E-Mail-Hinweis, Footer – alles auf einem Screen
(gemessen: `scrollHeight <= innerHeight` auf 393px und 1280px).

## Entfernt (alter Production-Inhalt)

- große sichtbare Sektion „Was ist Y-Dude?“ mit zwei Karten
- sichtbare Karten „SlangTag – Slang als Sound“ und „Speak Local. Connect Global.“
- alter primärer CTA „Jetzt Y-Dude entdecken“ (verifiziert: 0 Vorkommen)
- zusätzlicher Scrollbereich unter dem One-Screen

## SEO-Fix erhalten – Lösung

Der Erklärinhalt ist **nicht** wieder `sr-only` und **kein** großer Inhaltsblock, sondern ein
natives `<details>`/`<summary>`-Disclosure am Ende des One-Screens:

- sichtbare, klickbare Zeile „WAS IST Y-DUDE?“ für alle Besucher (keine Cloaking-/Hidden-Technik,
  kein `display:none`-CSS-Trick, keine unterschiedlichen Inhalte für Crawler und Nutzer)
- semantische Struktur bleibt: H1 (Marke) → H2 (Vorschau, `tester-title`) → `summary` + H3/H3
- Inhalt vollständig im ausgelieferten HTML (SSR), unverändert – keine neuen Marketingtexte
- zusätzlich unverändert: Meta-Description, OG/Twitter, `canonical`, JSON-LD
  (Organization/WebSite/WebApplication/FAQPage mit denselben Texten)

## Nicht zurückgesetzt

- Auth: Login/Registrieren oben rechts führen direkt zu Formular; **kein** CAPTCHA/Turnstile
  (Live-Test: 0 Cloudflare-iframes, 2 Passwortfelder im Registrierungsformular);
  Unternehmensregistrierung unverändert
- Routing: `src/routes/_authenticated/dev.tsx` leitet weiter auf `/feed` (inkl. Query/Hash);
  Login → `/feed`; Logout → öffentliche Startseite
- Globe-Lazy-Loading und ausgelagerte Globe-Daten unverändert
- Analytics: `challenge_seen` (Startseite besucht) einmalig, `registration_started` beim Öffnen
  von `/auth?mode=register` (CTA-Ziel), `registration_submitted`, Account/Login unverändert –
  keine doppelten Events

## Tests

| Prüfung | Ergebnis |
|---|---|
| Typecheck | PASS |
| Vitest | 620/620 PASS |
| ESLint/Prettier (geänderte Dateien) | PASS (0 Fehler) |
| Build | PASS |
| Mobile 393px One-Screen | PASS |
| Desktop 1280px gleicher Aufbau | PASS |
| alter CTA „Jetzt Y-Dude entdecken“ | nicht mehr vorhanden |
| CTA → `/auth?mode=register` (Formular direkt) | PASS |
| `/dev` (angemeldet-Route) → `/feed` | PASS (abgemeldet korrekt `/auth`) |
| Browser-Konsolenfehler | keine |

## Status

**READY FOR PRODUCTION DEPLOY** – Veröffentlichung erst nach ausdrücklicher Freigabe.
