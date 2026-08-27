# Y-Dude – Phase 2: Trennung von Development, Staging und Production

Stand: 2026-08-26 · Keine Produktfunktion geändert · Keine Datenbankänderung ausgeführt
Tests: `bunx vitest run` → **351 Tests, 10 Dateien, alle grün**

---

## Schritt 1 – Bestandsaufnahme (Ist-Zustand)

| Bereich                 | Development (lokal)                                           | Staging (Vorschau)                                                          | Production                                                              |
| ----------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Anwendung / Build       | Vite-Dev-Server, `localhost:8080`                             | Vorschau-Adresse (`id-preview--…lovable.app`, `project--…-dev.lovable.app`) | `y-dude.com`, `www.y-dude.com`, `y-dude.lovable.app`                    |
| Backend / Datenbank     | **gemeinsam**                                                 | **gemeinsam**                                                               | **gemeinsam** (ein Cloud-Backend)                                       |
| Storage / Medien        | **gemeinsam**                                                 | **gemeinsam**                                                               | **gemeinsam**                                                           |
| Auth (Nutzerkonten)     | **gemeinsam**                                                 | **gemeinsam**                                                               | **gemeinsam**                                                           |
| Umgebungsvariablen      | `.env` + `.env.development`                                   | identische Werte                                                            | identische Werte                                                        |
| Geheimnisse (11)        | **gemeinsamer Speicher**                                      | **gemeinsam**                                                               | **gemeinsam**                                                           |
| Zahlungen               | Stripe-Testmodus                                              | Stripe-Testmodus                                                            | **derzeit ebenfalls Testmodus** (nur Sandbox-Schlüssel vorhanden)       |
| Zahlungs-Webhook        | ein Endpunkt `?env=sandbox\|live`                             | derselbe Endpunkt                                                           | derselbe Endpunkt                                                       |
| Hintergrundläufe (Cron) | `api/public/*`, secret-geschützt                              | identisch                                                                   | identisch                                                               |
| Externe Dienste         | Turnstile, Push (VAPID), KI-Zugang                            | **gemeinsam**                                                               | **gemeinsam**                                                           |
| Test-/Demo-Mechanismen  | Testwerbung, Livetest-Messung, Demo-Messenger, Landing-Tester | dieselben                                                                   | **im gleichen Pfad vorhanden**, Sichtbarkeit über Adminrechte gesteuert |
| Migrationen             | –                                                             | –                                                                           | ~220 Migrationen wirken direkt auf das Produktivsystem                  |

**Gemeinsam genutzt** (kritisch): Datenbank, Storage, Auth, Geheimnisse, Zahlungs-Webhook, externe Dienste.
**Bereits getrennt**: Anwendungs-Auslieferung (Vorschau vs. veröffentlichte Version), Zahlungsmodus als Parameter, Cron-Zugriff über Geheimnisse.

### Test-/Entwicklungsmechanismen im Detail (Schritt 4)

| Mechanismus                 | Ort                                                                     | Bewertung                                                                                            |
| --------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Testwerbung im Feed         | `ad-test-counter.ts`, `FeedAdCard`, `FeedVideoAdCard`                   | nur für Admins sichtbar; schreibt ausschließlich `ad_test_events`, keine Kampagnen-/Abrechnungsdaten |
| Livetest-Schalter           | `admin.livetest.tsx`, `live-test.server.ts`, Tabelle `ad_test_settings` | legitimes Admin-Werkzeug, bleibt erhalten – nur Admins dürfen schreiben                              |
| Werbepause / Werbung an-aus | `ad_pauses`, `ad_preferences`                                           | **produktives** Feature, kein Testflag → bleibt                                                      |
| Demo-Messenger              | `src/routes/demo.messenger.tsx` (öffentlich)                            | reine Schaufensterseite ohne Datenzugriff                                                            |
| Landing-SlangTag-Tester     | `components/landing/SlangTagTester.tsx`                                 | reine Anzeige                                                                                        |
| Globe-Demo-Daten            | `lib/globe/demo-data.ts`                                                | Rückfalldaten für die Weltkugel, keine Nutzerdaten                                                   |
| Testkonten-Sichtbarkeit     | `is_test_profile`, `can_view_test_users`                                | Datenbankseitige Markierung; Testprofile sind nur für Berechtigte sichtbar                           |

Kein Feature-Flag wurde entfernt. Entfernt wurde nichts – ergänzt wurde eine echte Umgebungsentscheidung, damit Flags nicht länger die Umgebungstrennung ersetzen.

---

## Schritt 2 – Zielarchitektur

```text
                 Y-Dude
                    │
          ┌─────────┴─────────┐
     STAGING              PRODUCTION
          │                   │
   Test-Datenbank        Produktiv-DB
   Test-Storage          Produktiv-Storage
   Test-Auth             Produktiv-Auth
   Stripe Testmodus      Stripe Live
   Test-Konten           echte Konten
   APP_ENV=staging       APP_ENV=production
```

Die Anwendung ist ab jetzt umgebungsbewusst: `src/lib/environment.shared.ts` (Zuordnung nach Hostname) und `src/lib/environment.server.ts` (Regeln) sind die einzige Quelle der Wahrheit.

| Umgebung    | Erkennung                                                                         | Zahlungsmodus                                                      | Test-Mechanismen                                                            |
| ----------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| production  | `y-dude.com`, `www.y-dude.com`, `y-dude.lovable.app` oder `APP_ENV=production`    | `live`, sobald Live-Schlüssel vorhanden; sonst weiterhin `sandbox` | nur nach ausdrücklicher Freigabe (`ALLOW_TEST_FEATURES_IN_PRODUCTION=true`) |
| staging     | jeder andere öffentliche Host (Vorschau, unbekannte Hosts) oder `APP_ENV=staging` | ausschließlich `sandbox`                                           | erlaubt                                                                     |
| development | `localhost`, `127.0.0.1`, `*.local`                                               | ausschließlich `sandbox`                                           | erlaubt                                                                     |

Grundregel: Ein unbekannter Hostname wird **niemals** als Production eingeordnet.

---

## Schritt 3 / 5 – Tatsächlich umgesetzte Schutzmaßnahmen

1. **Zahlungs-Webhook prüft die Umgebung** (`src/routes/api/public/payments/webhook.ts`):
   Eine Meldung mit `?env=live` wird in einer Staging-/Development-Instanz verworfen und protokolliert (`webhook_env_mismatch`), bevor irgendetwas geschrieben wird. Sobald Live-Schlüssel hinterlegt sind, verwirft Production umgekehrt Testmeldungen – eine Testzahlung kann dann produktive Daten nicht mehr verändern.
2. **Live-Zahlungen in Testumgebungen gesperrt** (`src/lib/stripe.server.ts`):
   Ist `APP_ENV=staging|development` gesetzt, schlägt jeder Live-Zugriff fehl („Live payments are disabled in staging"). Damit kann eine Testumgebung selbst bei gemeinsamem Geheimnisspeicher keine echte Zahlung auslösen. Dies gilt für alle Wege (Kauf, Hervorhebung, Abo, Kundenportal), weil die Sperre am gemeinsamen Zugangspunkt sitzt.
3. **Kein stillschweigender Rückfall auf „live"**: Der Browser leitet den Zahlungsmodus weiterhin ausschließlich aus dem Präfix des öffentlichen Tokens ab (`pk_test_` / `pk_live_`).
4. **Vertragstests** (`tests/environment-separation.test.ts`, 27 Tests): Hostzuordnung, Vorrang von `APP_ENV`, erlaubte Zahlungsmodi je Umgebung, Freigabe von Test-Mechanismen, keine Geheimnisse im Zustandsbericht.
5. **Webhook-Isolationstest** (`tests/payments-webhook-idempotency.test.ts`): Eine Live-Meldung an eine Staging-Instanz bewirkt nichts – die Signaturprüfung wird nicht einmal erreicht.

Nicht geändert: Produktlogik, Datenbank, Richtlinien, Geheimnisse, Auth-Konfiguration.

---

## Schritt 6 – Authentication

Aktuell nutzen alle Umgebungen **dasselbe** Auth-System; ein Staging-Testkonto ist damit technisch ein Produktionskonto. Innerhalb eines einzelnen Lovable-Cloud-Projekts lässt sich das nicht im Code lösen.
Bestehende Absicherungen: Anmeldepflicht über `_authenticated`, Bearer-Token-Prüfung serverseitig, Testprofile über `is_test_profile` gekennzeichnet und nur für Berechtigte sichtbar, Rollen in eigener Tabelle mit `has_role`.
Offen (manuell): eigene Auth-Instanz mit eigenen Redirect-/Auth-URLs für Staging.

---

## Schritt 7 – Datenbank und Migrationen

Ist-Zustand: Migrationen werden direkt gegen das Produktivsystem angewendet; eine Vorprüfung in einer separaten Datenbank existiert nicht. Bestehende ~220 Migrationen bleiben unverändert.
Soll-Ablauf: Migration → Staging-Datenbank → automatisierte Tests → Production. Bis eine zweite Datenbank existiert, gilt der Ersatzweg:

1. Vertragstests laufen lassen (`bunx vitest run`) – prüfen RLS, Rechtevergabe und Rollenmodell jeder Tabelle statisch.
2. Migration klein halten, keine Datenlöschung, immer mit Berechtigungen und Richtlinien in derselben Migration.
3. Nach dem Anwenden Sicherheitsprüfung ausführen und die betroffene Funktion in der Vorschau prüfen.

---

## Schritt 8 – Deployment-Prozess (verbindlich)

```text
Änderung
   ↓  Entwicklung (localhost, APP_ENV=development)
Vorschau-Version = Staging  (APP_ENV=staging setzen)
   ↓  bunx vitest run  (351 Tests müssen grün sein)
Manuelle Prüfung: Anmeldung · Feed · Messenger · Market-Testkauf · Admin
   ↓
Production: „Publish/Update" ausdrücklich auslösen
```

Wichtige Eigenschaften der vorhandenen Infrastruktur:

- Änderungen an der Oberfläche gehen erst mit einem ausdrücklichen Veröffentlichungsschritt live – ein experimenteller Stand wird nicht automatisch produktiv.
- Backend-Änderungen (Migrationen, Server-Funktionen) wirken dagegen **sofort** und teilen sich Vorschau und Produktion. Das ist die zentrale verbleibende Lücke.

---

## Schritt 9 / 10 – Smoke- und Isolationstest

Der vollständige Smoke-Test gegen eine _eigene_ Staging-Umgebung wurde **nicht** durchgeführt, weil es diese Umgebung nicht gibt: die Vorschau greift auf dieselbe Datenbank, denselben Storage und dieselben Konten wie die Produktion zu.
Gemäß Schritt 10 und 11 wurde daher **gestoppt statt weitergearbeitet**: kein Testkauf, keine Testzahlung, keine Statusänderung, kein Upload/Löschvorgang gegen den Produktivbestand.

Automatisiert nachgewiesene Isolation (ohne Produktionsdaten):

| Prüfung                                        | Ergebnis                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| Staging-Webhook (`env=live`) verändert nichts  | 🟢 nachgewiesen (Test)                                                     |
| Live-Zahlung aus Staging auslösbar             | 🟢 gesperrt (Test)                                                         |
| Testmeldung in Production nach Live-Umstellung | 🟢 wird verworfen (Test)                                                   |
| Unbekannter Host wird als Production behandelt | 🟢 ausgeschlossen (Test)                                                   |
| Staging-Datenbank getrennt von Production      | 🔴 nicht gegeben                                                           |
| Staging-Storage getrennt                       | 🔴 nicht gegeben                                                           |
| Staging-Auth/Testkonten getrennt               | 🔴 nicht gegeben                                                           |
| Testdaten erscheinen nicht in Production       | 🟡 nur logisch getrennt (Adminrechte, `ad_test_events`, `is_test_profile`) |

---

## Schritt 12 – Statusübersicht

| Bereich                         | Status                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Staging-Backend                 | 🔴 gemeinsames Backend                                                          |
| Staging-Datenbank               | 🔴 gemeinsame Datenbank                                                         |
| Staging-Storage                 | 🔴 gemeinsamer Storage                                                          |
| Staging-Auth                    | 🔴 gemeinsame Nutzerkonten                                                      |
| Stripe Test Mode                | 🟢 Testmodus aktiv; Live in Testumgebungen gesperrt                             |
| Webhooks getrennt               | 🟡 ein Endpunkt, aber umgebungsgeprüft und wirkungslos bei Verwechslung         |
| Umgebungsvariablen getrennt     | 🟡 Mechanik vorhanden (`APP_ENV`), Werte noch gemeinsam                         |
| Testdaten getrennt              | 🟡 logisch getrennt, nicht physisch                                             |
| Production geschützt            | 🟢 Zahlungspfad, Admin-Rechte, RLS, ausdrückliche Veröffentlichung              |
| Deployment-Prozess dokumentiert | 🟢                                                                              |
| Isolation getestet              | 🟡 Zahlungs-/Umgebungspfad nachgewiesen, Daten-/Storage-Isolation nicht möglich |

### Was wurde tatsächlich geändert?

- neu: `src/lib/environment.shared.ts`, `src/lib/environment.server.ts`
- geändert: `src/routes/api/public/payments/webhook.ts` (Umgebungsprüfung vor jeder Verarbeitung), `src/lib/stripe.server.ts` (Live-Sperre in Test-Umgebungen)
- neu: `tests/environment-separation.test.ts`; ergänzt: Isolationsfall im Webhook-Test
- neu: dieses Dokument

### Welche Geheimnisse müssen getrennt werden?

`STRIPE_LIVE_API_KEY` / `PAYMENTS_LIVE_WEBHOOK_SECRET` (nur Production), `STRIPE_SANDBOX_API_KEY` / `PAYMENTS_SANDBOX_WEBHOOK_SECRET` (nur Staging), `VITE_PAYMENTS_CLIENT_TOKEN`, `MASTER_ADMIN_PASSWORD`, `MODERATION_CRON_TOKEN`, `PUSH_CRON_TOKEN`, `VAPID_*`, `CLOUDFLARE_TURNSTILE_*` sowie alle `SUPABASE_*`-Werte.

### Offene Punkte und manuelle Schritte

1. **Zweites Projekt als Staging anlegen** (eigene Datenbank, eigener Storage, eigene Auth, eigene Geheimnisse) – nur außerhalb dieses Projekts möglich; hier ist ein Backend je Projekt vorgesehen.
2. `APP_ENV=staging` in der Staging-Instanz und `APP_ENV=production` in der Produktion setzen. Erst dann greifen alle Sperren in beide Richtungen.
3. Migrationen künftig zuerst im Staging-Projekt anwenden.
4. Eigene Stripe-Testkonfiguration und eigener Webhook-Endpunkt je Umgebung (`?env=sandbox` nur Staging, `?env=live` nur Production).
5. Auth-Redirect-/Auth-URLs und E-Mail-Absender je Umgebung eintragen.
6. Optional: sichtbare Umgebungskennzeichnung in der Oberfläche der Staging-Instanz (bewusst nicht umgesetzt, wäre eine Produktänderung).
7. Für Punkt 1–5 ist eine Person mit DevOps-/Backend-Erfahrung sinnvoll: Projektduplikat, Datenbank-Klon ohne Personendaten, getrennte Geheimnisverwaltung, Webhook-Registrierung.

Phase 3 (Observability + Alerting) wurde nicht begonnen.
