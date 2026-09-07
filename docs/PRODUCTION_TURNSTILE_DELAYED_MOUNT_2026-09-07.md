# Production – Turnstile Delayed Mount (Registrierung)

Datum: 2026-09-07 · Scope: ausschließlich Registrierungs-Turnstile-Flow

## Production-Stand vorher

- `src/routes/auth.tsx` (RegisterForm) rendert `<Turnstile>` unbedingt beim Öffnen
  des Formulars; Cloudflare-Script und Widget laden sofort.
- Fehlermeldung („Sicherheitsprüfung konnte nicht geladen werden“) kann vor jeder
  Nutzerinteraktion erscheinen.
- Absende-Button nur bei `loading` deaktiviert; Formularfelder und Turnstile-Ergebnis
  gehen nicht in den Button-Zustand ein.
- Kein Retry-Element nach FAILED/TIMEOUT.
- Kein Staging-Migrationspaket unter `/mnt/user-uploads/` für diese Änderung vorhanden;
  die beschriebene Änderung wurde daher gezielt im Production-Code umgesetzt
  (keine Blind-Überschreibung, kein Import fremder Dateien).

## Implementierte Änderung

1. `<Turnstile>` wird nur gerendert, wenn die Pflicht-Checkbox aktiv ist
   (`{accepted && (...)}`). Vorher: kein Script, kein Widget, keine Meldung.
2. Abwählen der Checkbox: Token gelöscht, Blocked-Status gelöscht, Remount-Key erhöht
   → Widget entfernt, Zustand vollständig zurückgesetzt.
3. SUCCESS/FAILED/TIMEOUT getrennt: SUCCESS setzt Token und hebt Blocked auf;
   FAILED/TIMEOUT setzen Blocked und zeigen die Meldung plus Retry-Button.
4. Retry (`retryCaptcha`) erzeugt über den Remount-Key ein frisches Widget.
5. „Jetzt registrieren“ ist nur aktiv bei: E-Mail valide, Username valide,
   Passwort 2× ≥ 8 Zeichen und identisch, Geburtsdatum valide + Mindestalter 14,
   Pflicht-Checkbox aktiv, Turnstile-Token vorhanden (`formReady`).
6. Neuer Text `turnstile.retry` in de/en/el.

Nicht verändert: `verifyTurnstileToken`, `signUpWithCaptcha`, Alterslogik 14–17/18+,
Login, Passwort-Reset, Profil, SlangTag-Tester, Market, Ticket-/Pickup-Logik, Admin,
Stripe/Zahlungen, Versand, RLS/Policies, Datenbank (keine Migration).

## Geänderte Dateien

- `src/routes/auth.tsx` (nur RegisterForm)
- `src/lib/i18n-auth.ts` (nur neuer `turnstile.retry`-Text)
- `src/components/Turnstile.tsx` (nur Formatierung/Leerzeile, keine Logik)
- `tests/turnstile-delayed-mount.test.ts` (neu)

## Ergebnisse

| Prüfung                                   | Ergebnis |
| ----------------------------------------- | -------- |
| Typecheck (`tsc --noEmit`)                | PASS     |
| Unit-/Logiktests                          | PASS (34 Dateien / 602 Tests vor dem neuen Test; neue Suite 5/5) |
| Lint (geänderte Dateien, eslint+prettier) | PASS     |
| Build (Production)                         | PASS     |
| Mobile 390px / Android-UA                 | PASS – vor Checkbox: 0 Widgets, kein Script, keine Meldung; nach Checkbox: Script + API geladen; nach Abwahl: Meldung entfernt; Submit ohne Token dauerhaft deaktiviert |
| Security / Serverprüfung                  | PASS – `verifyTurnstileToken` unverändert, fail-closed; ohne gültiges Token `{status:"captcha"}`; kein Frontend-Status wird als Nachweis akzeptiert |

Hinweis: Auf `localhost` liefert Cloudflare `110200` (Domain nicht freigegeben),
daher ist der FAILED-Pfad lokal reproduzierbar, der SUCCESS-Pfad nicht.
Ein echter menschlicher Challenge-Durchlauf ist headless nicht automatisierbar
(bereits dokumentiert) und muss manuell auf dem Gerät bestätigt werden.

## Deployment

- Production-Smoke-Test (https://y-dude.com/auth?mode=register, 390px, Android-UA):
  PASS – HTTP 200; vor der Zustimmung kein Cloudflare-Script, kein Widget, keine
  Meldung, Absende-Button deaktiviert; nach Aktivierung der Pflicht-Checkbox wird
  das Script geladen und der Button bleibt ohne gültiges Token deaktiviert.
- Interaktives Challenge-iframe wird headless nicht ausgeliefert (Bot-Erkennung,
  bereits dokumentiert) → echter menschlicher Durchlauf manuell auf dem Gerät.
- Deployment-Status: veröffentlicht am 2026-09-07 (Production-Commit siehe
  Veröffentlichungsvorgang dieses Datums).
