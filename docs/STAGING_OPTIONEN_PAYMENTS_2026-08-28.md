# Y-Dude – Staging trotz aktivierter Payments: Entscheidungsbericht

Datum: 2026-08-28 · Status: **Analyse, keine Änderung durchgeführt**

Production wurde für diesen Bericht **nicht** verändert: keine Migration, keine
Secrets, keine Stripe-/Webhook-Konfiguration, keine Domains, keine Daten.

## 0. Ausgangslage (geprüft)

| Punkt | Befund |
|---|---|
| Remix mit Payments | Offiziell **nicht unterstützt** („Remixing projects with payments enabled is not supported.“) |
| Zweites Backend im selben Projekt | Nicht möglich – ein Projekt = ein Backend (DB/Auth/Storage/Secrets) |
| GitHub-Repo-Import in ein Lovable-Projekt | Offiziell **nicht unterstützt** (GitHub ist Export/Backup-Richtung) |
| Codeübernahme in ein neues Projekt | Möglich – über projektübergreifenden Zugriff (@-Erwähnung eines Projekts im Chat des neuen Projekts, gleiche Workspace) |
| Host-Erkennung | `src/lib/environment.shared.ts`: alles außer `y-dude.com`, `www.y-dude.com`, `y-dude.lovable.app` gilt als `staging` |
| Zahlungssperre | `src/lib/stripe.server.ts`: `live` in staging/development blockiert; `src/lib/stripe.ts` leitet Modus aus `pk_test_`/`pk_live_` ab |

Damit gilt: ein neues Projekt unter anderer Domain ist **ohne Codeänderung**
automatisch `staging` und kann keine Live-Zahlungen auslösen.

## 1. OPTION A – innerhalb von Lovable (Remix / Drafts / private Publish)

- **Machbarkeit:** Remix ❌ (Payments-Sperre). Drafts/private Publish ✅, aber sie
  teilen weiterhin **dasselbe** Backend.
- **Aufwand:** minimal.
- **Risiko:** **hoch** für das eigentliche Ziel – Tests schreiben weiterhin in
  echte Daten; nur Scheinisolation.
- **Production:** unverändert.
- **Payments:** unverändert, aber Test und Live liegen im gleichen Secret-Satz.
- **DB/Auth/Storage:** **nicht** getrennt.
- **Empfehlung:** nur als Übergangslösung für Code-Review, **nicht** als Staging.

## 2. OPTION B – neues Lovable-Projekt „Y-Dude Staging“ (empfohlen)

- **Machbarkeit:** ✅. Neues, leeres Projekt in derselben Workspace anlegen,
  Cloud aktivieren, dann im **Staging-Chat** dieses Production-Projekt per
  `@`-Erwähnung referenzieren und die Codebasis übernehmen lassen.
- Übernehmbar: Frontend, Komponenten, Routing (`src/routes`), Supabase-Integration
  (neu generiert, eigene Keys), Migrationen (`supabase/migrations`, `drizzle/`),
  vorhandene Edge Functions, RLS/Policies (über Migrationen), Auth-Logik,
  Storage-Logik (Buckets neu anlegen), Tests (`tests/`), Konfiguration
  (`vite.config.ts`, `vitest*.config.ts`, `playwright.config.ts`, `scripts/verify.sh`).
- **Nicht** übernehmen: Datenbankinhalte, Storage-Objekte, Secrets, `.env`.
- **Aufwand:** einmalig ca. 2–4 h (Projekt anlegen, Code übernehmen, Migrationen
  anwenden, Testdaten erzeugen, Secrets mit Testwerten belegen, Google-Auth mit
  eigenen Redirect-URLs, Prüflauf).
- **Risiko:** niedrig; Production wird nicht berührt. Hauptrisiko danach:
  Schema-Drift zwischen zwei Projekten.
- **Production:** unverändert.
- **Payments:** Staging erhält **nur** Sandbox/Test (`pk_test_`/`sk_test_`),
  eigene Test-Webhooks; Production-Live-Keys, -Webhooks und -Kunden bleiben
  unverändert und werden nie kopiert. `ALLOW_TEST_FEATURES_IN_PRODUCTION` in
  Staging nicht setzen, `PRODUCTION_HOSTS` in Staging nicht erweitern.
- **DB/Auth/Storage:** vollständig getrennt (eigenes Backend).
- **Empfehlung:** ✅ **das ist der sicherste Weg.**

Hinweis zu Payments im Staging: Payments dort **nur aktivieren, wenn Zahlungs-
flows getestet werden müssen**. Ohne Payments-Aktivierung bleibt das Staging-
Projekt zudem remix-fähig – nützlich für spätere Wegwerf-Kopien.

## 3. OPTION C – GitHub / Code-Import

- **Machbarkeit:** ❌ als direkter Import. Praktisch nur als *Datenquelle*:
  Repo lokal auschecken und Dateien manuell in ein neues Projekt übertragen.
- **Aufwand:** höher als Option B (manuelles Kopieren, generierte Dateien wie
  `src/routeTree.gen.ts` und `.env` fehlen im Repo).
- **Risiko:** mittel – unvollständige Übernahme, Versionsdrift.
- **Production:** unverändert, solange kein Deployment-Workflow entsteht.
- **Payments:** wie Option B (nur Testkonfiguration in Staging).
- **DB/Auth/Storage:** wie Option B getrennt, aber Migrationen müssen manuell
  nachgezogen werden.
- **Empfehlung:** nur Fallback, falls der projektübergreifende Zugriff nicht
  verfügbar ist. GitHub bleibt in jedem Fall **reines Backup**
  (`.github/workflows/ci.yml` läuft nur über `workflow_dispatch`).

## 4. Migrationsworkflow nach Umsetzung von Option B

```text
Development (Chat im Staging-Projekt)
  → Migration im Staging anwenden
  → Tests: bun run test, test:e2e, test:db
  → bun run verify
  → manuelle Freigabe durch Betreiber
  → identische Migration im Production-Projekt anwenden
```

Keine automatische Migration nach Production. Kein GitHub-Deployment.
Regel: identische SQL-Datei in beiden Projekten, sonst entsteht Schema-Drift.

## 5. Empfehlung

**Option B.** Payments in Production bleiben unangetastet; das Staging-Projekt
wird neu aufgebaut, erhält ein eigenes Backend und ausschließlich Testzahlungen.
Erforderlicher manueller Schritt vorab: neues leeres Projekt „Y-Dude Staging“ in
derselben Workspace anlegen und dort Lovable Cloud aktivieren. Danach kann die
Codeübernahme, das Anwenden der Migrationen und der komplette Prüflauf im
Staging-Chat beauftragt werden.

## 6. Verbleibende Risiken bis dahin

- Vorschau-Tests schreiben weiterhin in echte Daten → keine Last-, Lösch- oder
  Zahlungstests in der Vorschau.
- Doppelte Pflege zweier Projekte; Schema-Drift ist die häufigste Fehlerquelle.
- Kosten für ein zweites Cloud-Backend.
