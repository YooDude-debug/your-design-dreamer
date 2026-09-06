# Y-Dude Production – Staging Migration Release (2026-09-06)

SOURCE: Y-Dude Staging, Commit `718202d`
Paket: `staging-to-production-2026-09-06.tar.gz` (Manifest, 2 Migrationen, 22 Code-/Testdateien, Rollback-Baseline)

## 1. Pre-Flight (read-only)

- Production-Datenbank: PostgreSQL 17.6, 20 Profile, `profiles.birthday` (date, nullable) vorhanden.
- `public.registration_health_checks`: **fehlte** → Migration erforderlich.
- `public.age_status_of` / `public.my_age_status`: **fehlten** (0 Treffer) → Migration erforderlich.
- `public.has_role` vorhanden (Voraussetzung der RLS-Policy).
- Migrationsstand vor Release: bis `0029_registration_events_tracking.sql`.
- Konflikte gegen die Paket-Baseline: `src/routes/auth.tsx`, `src/components/Turnstile.tsx`,
  `src/routes/admin.index.tsx`, `src/lib/data.tsx`, `src/integrations/supabase/types.ts`,
  `src/routeTree.gen.ts`. Ursache: bereits in Production vorhandene Änderungen
  (Turnstile-UI-Fix, Registrierungs-Messung `registration_events`, Admin-Karte).
  → Keine Datei blind überschrieben; selektiver Merge (siehe 3).

## 2. Datenbank

Angewendet, additiv, ohne Datenverlust und ohne Backfill bestehender Nutzer:

- `drizzle/migrations/0030_registration_health_checks.sql` – Tabelle, GRANTs
  (`authenticated` SELECT, `service_role` ALL), RLS aktiv, Admin-only SELECT-Policy, Index.
- `drizzle/migrations/0031_age_status_functions.sql` – `age_status_of(date)` (STABLE, `search_path=public`)
  und `my_age_status()` (SECURITY DEFINER, `search_path=public`), `REVOKE` von `PUBLIC`/`anon`,
  EXECUTE nur `authenticated`/`service_role`.

Verifikation nach Migration:

| Objekt | SECURITY DEFINER | search_path | anon EXECUTE | authenticated | service_role |
|---|---|---|---|---|---|
| `age_status_of(date)` | nein | `public` | **nein** | ja | ja |
| `my_age_status()` | ja | `public` | **nein** | ja | ja |

`registration_health_checks`: RLS aktiv, SELECT nur für Admins (Policy `has_role(auth.uid(),'admin')`).
Ein direkter Aufruf von `age_status_of` über die eingeschränkte Leserolle scheitert mit
`42501 permission denied` – der Entzug für anonyme Zugriffe ist wirksam.

Bestehende Nutzer ohne Geburtsdatum bleiben `UNKNOWN`; kein Datensatz wurde geändert oder gelöscht.

## 3. Code-Übernahme

Direkt übernommen (Baseline identisch): `ProfileEditDialog.tsx`, `ads/use-ad-targeting.ts`,
`age-policy.ts`, `auth.functions.ts`, `data-context.ts`, `i18n-auth.ts`, `i18n.tsx`,
`interest-engine.functions.ts`, `lang-geo.ts` sowie neu: `age-guard.server.ts`,
`age-status.functions.ts`, `registration-health.{shared,server,functions}.ts`,
`routes/admin.registration-check.tsx`, `tests/age-policy.test.ts`.

Zusammengeführt (bestehende Production-Änderungen erhalten):

- `src/routes/auth.tsx` – vereinfachtes Formular (Username, E-Mail, Passwort, Pflicht-Geburtsdatum,
  Zustimmung), CTA „Jetzt registrieren“ / „Register now“ / „Εγγραφή τώρα“; Vor-/Nachname und
  Anzeigename-Auswahl entfallen. Die bestehende Registrierungs-Messung (12 Ereignis-Aufrufe) und
  die dauerhaft sichtbare Captcha-Fehlermeldung bleiben erhalten.
- `src/components/Turnstile.tsx` – Paketstand (Polling, Ausfall erst nach 15 s, Wiederherstellung
  bei spätem Rendern, deutliche Fehlermeldung `unavailable`); der Production-Callback `onLoaded`
  für die Messung bleibt erhalten.
- `src/routes/admin.index.tsx` – beide Karten: „Registrierungen“ (Funnel) und
  „Registrierungs-Check“.
- `src/lib/data.tsx` – Nachtragen von Vor-/Nachname im Profil.
- `src/integrations/supabase/types.ts` neu generiert; `src/routeTree.gen.ts` automatisch erzeugt.

## 4. Ergebnisprüfung

- Typecheck: PASS (`tsgo --noEmit`, 0 Fehler).
- Unit-/Logiktests: PASS – 33 Dateien, **597 Tests** (inkl. neuer `tests/age-policy.test.ts`).
  Die Staging-Referenz von 612 Tests bezieht sich auf den Staging-Testbestand; hier gilt der
  Production-Testbestand, keine Tests abgeschwächt oder übersprungen.
- Lint (geänderte Dateien): PASS.
- Production-Build: PASS.
- E2E/Browser: 10 PASS, 1 bestehender Skip (Beitragsdetailseite, unverändert). Der Feed-Test war
  in einem Durchlauf flaky und im Wiederholungslauf grün.
- Altersgrenzen (`age-policy`, 14/17/18, ungültig/leer → fail-closed): über `tests/age-policy.test.ts` PASS.
- Smoke (mobil, de-DE, lokal): Formular deutsch, CTA „Jetzt registrieren“, Geburtsdatumsfeld
  vorhanden, E-Mail/Passwort vorhanden. Turnstile lädt lokal nicht (Cloudflare-Fehler 110200,
  Hostname nicht freigegeben) – die Anzeige lautet korrekt „Ohne sie ist keine Registrierung
  möglich“, nicht mehr „Sie können fortfahren“. Der Live-Hostname-Test erfolgt nach dem Deployment.

## 5. Security

- RLS auf der neuen Tabelle aktiv, Lesen nur für Admins, Schreiben über `service_role`.
- Keine neuen anonymen Funktionsrechte; `anon` EXECUTE für beide Altersfunktionen entzogen.
- Turnstile bleibt serverseitig fail-closed (`auth.functions.ts` unverändert gegenüber Paketstand).
- Altersprüfung verbindlich serverseitig (Registrierung + `my_age_status()`); der Client rechnet nur
  für die Rückmeldung. Frontend-Manipulation ergibt kein `ADULT_18_PLUS`.
- Werbe-/Interessen-Profiling für `MINOR_14_17` blockiert (`age-guard.server.ts`,
  `interest-engine.functions.ts`, `use-ad-targeting.ts`), bei Unsicherheit fail-closed.
- Keine Secrets im Code; Production nutzt ausschließlich eigene Umgebungswerte, keine
  Staging-Secrets übernommen.

## 6. Abschluss

```
PRODUCTION MIGRATION: SUCCESS (Code + Datenbank im Preview-Stand, Veröffentlichung ausstehend)
SOURCE: Y-Dude Staging
SOURCE COMMIT: 718202d
PRODUCTION COMMIT: durch die Plattform verwaltet (kein Git-Zugriff) – NICHT VERIFIZIERBAR
DATABASE: PASS
BUILD: PASS
TESTS: 597 Unit/Logik PASS, 10 E2E PASS, 1 bestehender Skip
SECURITY: PASS
TURNSTILE: PASS (serverseitig fail-closed; Live-Widget nach Deployment nachzuprüfen)
REGISTRATION 14+: PASS
AGE VERIFICATION: PASS
MINOR ADVERTISING PROTECTION: PASS
GERMAN REGISTRATION: PASS
ADMIN HEALTH CHECK: PASS (Route /admin/registration-check, Admin-only)
EXISTING USERS: PASS (keine Daten geändert, kein Backfill)
SMOKE TEST: TEILWEISE – lokal PASS außer Turnstile-Widget (Hostname nicht freigegeben)
ROLLBACK: READY (Baseline im Paket; additive Tabelle bleibt bei Rollback bestehen)
OVERALL: 🔴 PRODUCTION NICHT FREIGEGEBEN – Veröffentlichung und Live-Smoke-Test stehen aus
```

Begründung des Status: Migration, Merge, Tests, Build und Security sind bestanden, aber der
verbindliche Live-Smoke-Test (Turnstile auf `y-dude.com`, echte Registrierung, E-Mail-Bestätigung,
Login, Admin-Check) ist erst nach der Veröffentlichung durchführbar. Erst danach kann der Status
auf 🟢 PRODUCTION LIVE gesetzt werden.
