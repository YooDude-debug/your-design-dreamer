# Production – Übernahme Staging-Stand (Turnstile aus, Globe Lazy) 2026-09-07

Quelle: Projekt „Y-Dude Staging“, Snapshot-Commit `ee6ca7c5`
(read-only Vergleich, kein Überschreiben des Production-Baums).

## Vergleichsergebnis (Auszug)

Der Staging-Baum ist insgesamt eine ältere Linie (fehlende Registrierungs-
Erfassung, fehlender Business-Einstieg, älterer Turnstile-Zustandsfix).
Deshalb wurde **nicht** blind kopiert, sondern ausschließlich die vier
freigegebenen Änderungen übernommen.

### Übernommen

1. `src/lib/turnstile-flag.ts` (neu) – zentraler Schalter `TURNSTILE_ENABLED = false`
2. `src/lib/auth.functions.ts` – 4 Prüfstellen (Login, Resend, Registrierung,
   Passwort-Reset) laufen nur bei aktivem Schalter; sonst unverändert fail-closed
3. `src/routes/auth.tsx` – Widget/Warte-Text/Absende-Gate hinter dem Schalter
   (Login, Passwort vergessen, Bestätigung erneut senden, Registrierung)
4. Globe: `src/lib/globe/land-base.ts` (neu, eigener Chunk + Cache),
   `src/lib/globe/globe-engine.ts` (Landdaten als Parameter statt statischer
   Import), `src/components/globe/GlobeStage.tsx` (paralleles Laden +
   Ladezustand), `src/lib/globe/borders.ts` (feine Grenzen erst ab LOD 0.5)
5. Tests: `tests/turnstile-disabled.test.ts` (neu),
   `tests/turnstile-delayed-mount.test.ts` an den Schalter angepasst

### Nicht übernommen (Production bleibt führend)

- `src/components/Turnstile.tsx` – Production enthält den neueren
  SUCCESS-/Shadow-DOM-Fix; Staging-Version ist älter
- `src/routes/auth.tsx` als Ganzes – Production behält Registrierungs-
  Erfassung (`use-registration-tracking`), Business-Einstieg, Anzeigename-Modi
- Alle weiteren divergierenden Dateien (AdSlider-SEO-CTAs, Admin, Market,
  Supabase-Integration, Analytics/Health) blieben unverändert
- `/dev` → `/feed`: unverändert erhalten, `/feed` bleibt authentifizierte
  Startseite (kein Rücksetzen auf `/dev`)

Keine Änderung an Datenbank, Migrationen, RLS, Policies, Rollen,
SECURITY DEFINER, `search_path`, Secrets oder Auth-Konfiguration.
Die Turnstile-Konfiguration inklusive Secrets bleibt vollständig erhalten;
Reaktivierung = Schalter auf `true`.

## Vorab-Tests (lokaler Production-Codestand)

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | PASS |
| Tests | 620/620 PASS |
| Build | build OK |
| Registrierung ohne CAPTCHA (390px) | PASS – Konto angelegt, Bestätigungsseite |
| Login ohne CAPTCHA | PASS – Server erreicht (Fehlversuch = „Login fehlgeschlagen“, nicht CAPTCHA) |
| Kein Cloudflare-Script/Widget auf `/auth` und `/auth?mode=register` | PASS (0 Widgets, kein Script) |
| Login → `/feed`, bestehende Session → `/feed` | PASS |
| `/dev` → `/feed`, `/dev?chat=abc` → `/feed` | PASS |
| Abgemeldet: `/` öffentlich, `/feed` und `/dev` → `/auth` | PASS |
| Refresh bleibt auf aktueller Route | PASS |
| Globe (390px und 1280px) | PASS – Canvas gerendert, Ladezustand verschwindet |
| Analytics | PASS – `registration_started/submitted/completed` unverändert; `turnstile_*` entfallen erwartungsgemäß, solange der Schalter aus ist |
| Security | PASS – serverseitige Prüfung bleibt fail-closed und wird mit dem Schalter wieder aktiv; keine Rechte-/Policy-Änderung |
| Bestehende User/Daten | PASS – keine DB-/Datenoperation ausgeführt |

Hinweis: Für den Registrierungstest wurde ein Testkonto mit
`ydude.check…@example.com` erzeugt (unbestätigt).
