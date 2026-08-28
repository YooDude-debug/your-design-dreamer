# Y-Dude Staging-Remix – Anleitung und Prüfliste

Datum: 2026-08-28 · Status: **wartet auf manuellen Schritt des Betreibers**

## 0. Wichtiger Hinweis

Das Anlegen eines neuen Projekts (Remix) ist **kein** Vorgang, den der Agent innerhalb
dieses Projekts ausführen kann. Ein Projekt kann sich selbst nicht kopieren und kein
zweites Cloud-Backend anlegen. Der Remix muss einmalig im Lovable-Projektmenü
ausgelöst werden. Danach kann im neuen Projekt alles Weitere umgesetzt werden.

**Production wurde für dieses Dokument nicht verändert.**

## 1. Remix anlegen (Betreiber, 2 Minuten)

1. In diesem Projekt oben rechts das Projektmenü öffnen → **Remix / Duplicate**.
2. Name: `Y-Dude Staging`.
3. Im neuen Projekt **Lovable Cloud aktivieren**. Dabei entsteht automatisch:
   - eigene Datenbank
   - eigene Auth-Instanz (keine Benutzer aus Production)
   - eigenes Storage
   - eigener Secret-Satz
   - eigene `VITE_SUPABASE_*` / `SUPABASE_*` Variablen
4. Nichts aus Production kopieren – insbesondere keine Datenbank-Dumps, keine
   Storage-Objekte, keine Secrets.

Damit sind A–F aus dem Auftrag strukturell erfüllt: Staging kennt die
Production-Zugangsdaten nicht und kann deren Daten weder lesen noch schreiben.

## 2. Erstschritte im Staging-Projekt (im Staging-Chat beauftragen)

1. Alle Migrationen aus `supabase/migrations/` einmalig anwenden lassen.
2. Testdaten anlegen (Bots/KI-Testdaten wie im Production-Reset-Skript), **keine**
   Production-Daten.
3. Secrets mit Testwerten belegen:
   | Secret | Staging-Wert |
   |---|---|
   | Stripe | ausschließlich Test-Keys (`pk_test_`/`sk_test_`) |
   | `OPS_ALERT_WEBHOOK_URL` | eigener Test-Discord-Kanal oder leer |
   | KI-Schlüssel | Lovable AI des Staging-Projekts |
   | `ALLOW_TEST_FEATURES_IN_PRODUCTION` | nicht setzen |
4. Google-Auth im Staging separat konfigurieren (eigene Redirect-URLs).

## 3. Warum Staging automatisch als Staging erkannt wird

`src/lib/environment.shared.ts` ordnet Hosts zu und behandelt **jeden unbekannten
Host als `staging`**; nur `y-dude.com`, `www.y-dude.com`, `y-dude.lovable.app`
gelten als Production. Der Remix läuft unter einer anderen Domain, also gilt dort
ohne Codeänderung `staging`. Daraus folgt automatisch:

- `expectedPaymentsMode()` → `sandbox`, Live-Zahlungen sind gesperrt
  (`src/lib/stripe.server.ts`).
- Testmechanismen bleiben freigeschaltet, Production-Sonderfälle nicht.

Wichtig: Die Liste `PRODUCTION_HOSTS` im Staging-Projekt **nicht** erweitern.

## 4. Migrationsworkflow ab dann

```text
Development (lokal/Chat im Staging)
  → Migration im Staging anwenden
  → E2E-/Regressionstests (bun run test, test:e2e, test:db)
  → bun run verify
  → manuelle Freigabe durch Betreiber
  → identische Migration im Production-Projekt anwenden
```

Keine Migration wird automatisch auf Production angewendet. GitHub bleibt reines
Backup, es existiert kein Deployment-Workflow (`.github/workflows/ci.yml` läuft nur
über `workflow_dispatch`).

## 5. Testliste für das Staging-Projekt

Nach Punkt 2 im Staging durchlaufen: Registrierung/Login, Feed, Posts, Kommentare,
Shares, Messenger, Marketplace, Seller-Profile, Arena, Uploads, Übersetzungen, RLS
(öffentlich vs. privat), Payment-Sperre, Auth, Storage.

Zusätzliche Isolationsprüfungen im Staging:
- `.env`-Werte des Staging enthalten eine **andere** Projekt-ID als
  `lxhdvbtkulwgkvqpjsvt`.
- Keine Production-Domain in `PRODUCTION_HOSTS` ergänzt.
- Auth-Benutzerliste im Staging ist leer bzw. enthält nur Testkonten.
- Storage-Buckets im Staging enthalten nur Testmedien.

## 6. Verbleibende Risiken

- Bis der Remix existiert, sind Vorschau-Tests weiterhin Tests auf echten Daten:
  keine Last-, Lösch- oder Zahlungstests in der Vorschau.
- Zwei Projekte bedeuten doppelte Pflege: jede Migration muss zweimal angewendet
  werden; Abweichungen im Schema sind die häufigste Fehlerquelle.
- Kosten: zweites Cloud-Backend.
