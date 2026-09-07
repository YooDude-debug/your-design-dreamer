# Production Release – Market ohne Tickets, SlangTag-Tester ohne Turnstile (2026-09-07)

Paket: `staging-to-production-market-slangtag-2026-09-07.tar.gz`
Quelle (Staging): `a1c4a66` · Paket-Baseline: `718202d`
Production-Stand nach Übernahme: `fb461fbd`

## 1. Preflight

- Alle 8 Baseline-Dateien des Pakets stimmten **byteweise** mit dem Production-Stand
  überein → kein Merge-Konflikt, keine eigenen Production-Abweichungen in diesen Dateien.
- 9 Zieldateien übernommen (8 geändert, 1 neuer Test `tests/tester-no-turnstile.test.ts`).
- Kein `.git` und keine Secrets im Paket.
- Nichts außerhalb des Pakets geändert.

## 2. SlangTag-Tester

- `Turnstile`/`useCaptchaGate` aus `src/components/landing/SlangTagTester.tsx` entfernt.
- `src/lib/public-transcribe.functions.ts`: `captchaToken` aus dem Input-Schema und die
  Turnstile-Prüfung entfernt.
- Serverseitiger Missbrauchsschutz bleibt aktiv: IP-Rate-Limit
  (`checkIpRateLimit`) sowie harte Größen-/Formatlimits vor dem kostenpflichtigen
  Transkriptionsaufruf; höchstens ein externer Aufruf pro Request.
- Registrierungs-Turnstile bleibt vollständig unangetastet.

## 3. Market

- Pickup-Code/Ticket-Erzeugung, -Validierung und -Anzeige entfernt
  (`market-tx.server.ts`, `market-tx.functions.ts`, `market.functions.ts`,
  `i18n-market-tx.ts`, Route `market.tx.$txId.tsx`).
- Verbleibender Ablauf: Listing → Reservierung → Absprache zwischen Käufer und
  Verkäufer → Verkäufer markiert als verkauft → SOLD.
- Keine Zahlung, kein Stripe, keine Plattform-Versandabwicklung.
- `pickup` existiert nur noch als Fulfillment-Bezeichnung (Abholung vs. Versand).

## 4. Datenbank

**DATABASE MIGRATION: NONE REQUIRED.** Keine Migration im Paket, keine ausgeführt.
Historische Ticket-/Pickup-Code-Daten (`market_transaction_secrets`) bleiben unangetastet.

## 5. Security

- Registration-Turnstile live vorhanden (`challenges.cloudflare.com` + Response-Input auf
  dem Registrierungsformular von y-dude.com), serverseitige Registrierungsprüfung unverändert.
- Kein Turnstile mehr auf der Landingpage/dem Tester (live verifiziert, 0 Vorkommen).
- RLS, Auth, Policies, Grants unverändert; keine neuen Berechtigungen; keine Secrets im Frontend.
- DB-Integrationstests (Anon-Zugriffsschutz) 68/68 PASS.

## 6. Tests und Build

- Typecheck: PASS (0 Fehler)
- Unit/Logik: 34 Dateien / 602 Tests PASS (inkl. `tester-no-turnstile`,
  `market-transaction-flow`, `public-transcribe-guard`, `turnstile-verify`, `captcha-gate`)
- DB-Integration: 8 Dateien / 68 Tests PASS
- Production-Build: PASS

## 7. Smoke-Test (live, https://y-dude.com)

- Landingpage 200, SlangTag-Tester sichtbar, **kein** Turnstile, keine Sicherheits-Fehlermeldung,
  keine relevanten Konsolenfehler.
- Registrierungsformular: Turnstile lädt weiterhin.
- Market: Quell- und Testverifikation (kein Pickup-Code, kein Ticketpfad, `markSold` vorhanden).
  Ein eingeloggter Live-Kauf-/Verkaufsdurchlauf mit echten Konten ist nur manuell möglich
  und wurde nicht automatisiert durchgeführt.

## 8. Ergebnis

MIGRATION: SUCCESS
SLANGTAG TURNSTILE REMOVED: PASS
SLANGTAG TESTER: PASS
MARKET TICKET REMOVED: PASS
PICKUP CODE REMOVED: PASS
MARKET WORKFLOW: PASS (Code/Tests; manueller Live-Durchlauf offen)
DATABASE: NONE REQUIRED
SECURITY: PASS
REGRESSION: PASS
BUILD: PASS
PRODUCTION SMOKE TEST: PASS
PRODUCTION: LIVE
PRODUCTION COMMIT: fb461fbd

OVERALL: 🟢 PRODUCTION LIVE
