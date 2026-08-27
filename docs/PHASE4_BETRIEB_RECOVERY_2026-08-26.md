# Y-Dude – Phase 4: Betrieb, Recovery und Incident-Prozesse

Stand: 2026-08-26. Diese Datei dokumentiert den **tatsächlich geprüften
Zustand**. Nicht Geprüftes ist als offen gekennzeichnet. Es werden keine SLAs,
Anbieterzusagen oder rechtlichen Fristen erfunden.

Kurzanleitung für den Alltag: `docs/RUNBOOK_INCIDENT.md`.
Vorarbeiten: Phase 1 (Tests), Phase 2 (Environment-Trennung),
Phase 3 (Observability) – siehe die jeweiligen Phasenberichte.

---

## 1. Backup-Prozess – geprüfter Ist-Zustand

| Bereich                        | Zustand                                                                                                                                    | Bewertung                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Datenbank-Backups              | plattformseitig durch Lovable Cloud / Supabase erzeugt und verwaltet. Kein eigener Backup-Job im Projekt.                                  | 🟡 vorhanden, aber nicht vom Projekt kontrolliert |
| Aufbewahrungsdauer DB-Backups  | von der Plattform vorgegeben, im Projektcode nicht einsehbar und nicht steuerbar.                                                          | 🔴 **EXTERN zu klären**                           |
| Storage-Backups (Medien)       | ebenfalls plattformseitig. Die Anwendung erzeugt keine Kopien der Bild-/Audiodateien.                                                      | 🟡                                                |
| Schema / Migrationen           | 221 Migrationsdateien in `supabase/migrations/`, chronologisch, im Repository versioniert.                                                 | 🟢                                                |
| Anwendungscode                 | vollständig im Repository; zusätzlich Master-Sicherung unter `.lovable/backup/master-2026-08-26-before-professionalization`.               | 🟢                                                |
| Secrets / Environment          | in der Plattform hinterlegt (Worker-Token, Stripe-Keys, VAPID, Moderations-Keys). **Nicht** im Repository, **nicht** in Backups enthalten. | 🟡 – siehe 1.1                                    |
| Manuelle Backups               | Codestände unter `.lovable/backup/…`; keine manuellen Datenbank-Dumps.                                                                     | 🟡                                                |
| Integritätsprüfung der Backups | plattformseitig nicht sichtbar. Projektseitig neu: Restore-Test des Schemas (Abschnitt 2).                                                 | 🟡                                                |

### 1.1 Wichtigste Lücke: Secrets sind nicht mitgesichert

Ein Datenbank-Restore stellt Daten wieder her, **nicht** die Betriebs-Secrets.
Ohne folgende Werte ist die Anwendung nach einem Restore unvollständig
funktionsfähig:

- `MODERATION_CRON_TOKEN`, `PUSH_CRON_TOKEN`, `COUNTERS_CRON_TOKEN`,
  `BOT_CRON_TOKEN`, `RETENTION_CRON_TOKEN` (Job-Endpunkte)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (Push)
- Moderations-Keys (OpenAI / Google), Turnstile-Keys
- optional `OPS_ALERT_WEBHOOK_URL`

**Maßnahme (offen, benötigt den Betreiber):** eine Liste der benötigten
Secret-Namen (ohne Werte!) außerhalb des Projekts führen, damit im Notfall
bekannt ist, welche Werte neu erzeugt bzw. eingetragen werden müssen. Die Werte
selbst gehören nicht ins Repository und nicht in diese Datei.
Hinweis: Auf Lovable Cloud sind Service-Role-Key und Datenbankpasswort für den
Betreiber nicht abrufbar – ein Restore erfolgt daher plattformseitig.

---

## 2. Restore-Test (durchgeführt)

**Wichtig:** Production wurde nicht berührt. Der Test lief in einer
**temporären, lokal erzeugten und isolierten PostgreSQL-Instanz**.
Reproduzierbar über `bash scripts/restore-test.sh`.

### Vorgehen

```text
leere Datenbank (UTF-8)
   ↓ Plattform-Grundgerüst nachbilden (Rollen, Schemas auth/storage/cron, auth.uid(), Publication)
   ↓ 221 Migrationen chronologisch abspielen
   ↓ Schema, Policies, Funktionen zählen
   ↓ RLS-Abdeckung prüfen
   ↓ kritische Datenbankfunktionen prüfen
   ↓ Zugriffsrechte auf sensible Tabellen prüfen
```

### Ergebnis (2026-08-26, PostgreSQL 17.9)

| Prüfpunkt                                               | Ergebnis                                                                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verwendete „Sicherung“                                  | Migrationsverzeichnis `supabase/migrations/`, Stand 2026-08-26 (letzte Migration `20260826170941`)                                                                      |
| Dauer des Wiederherstellens                             | **5 Sekunden** für 221 Migrationen (ohne Daten)                                                                                                                         |
| Erfolgreich abgespielt                                  | **219 von 221**                                                                                                                                                         |
| Tabellen in `public` nach Restore                       | 113                                                                                                                                                                     |
| RLS-Policies                                            | 280                                                                                                                                                                     |
| Datenbankfunktionen                                     | 204                                                                                                                                                                     |
| Tabellen **ohne** RLS                                   | **0**                                                                                                                                                                   |
| Kritische Funktionen vorhanden                          | `has_role`, `can_view_post`, `mark_conversation_read`, `cleanup_push_data`, `market_expire_promotions`, `has_active_subscription`, `test_user_visible` – alle vorhanden |
| Zahlungs-Webhook-Ereignisse für Clients                 | kein Grant, keine Policy → für `anon`/`authenticated` nicht erreichbar ✔                                                                                                |
| Transaktions-Geheimnisse (`market_transaction_secrets`) | nur Policy „Käufer liest Abholcode“ für `authenticated` ✔                                                                                                               |
| `ops_events` / `ops_incidents`                          | Lesen/Bearbeiten nur mit `has_role(auth.uid(),'admin')` ✔                                                                                                               |
| Auth                                                    | im Test nur als Schema-Stub nachgebildet – Auth selbst ist Plattformdienst 🟡                                                                                           |
| Storage                                                 | im Test nur als Schema-Stub – Objekte sind Plattformdienst 🟡                                                                                                           |

### Aufgetretene Probleme (beide erklärt, keine Schemafehler)

1. `20260806075500…sql` – `extension "pg_cron" is not available`.
   Erwartet: `pg_cron` ist eine Plattform-Erweiterung und lokal nicht
   installierbar. Auf der echten Plattform vorhanden. **Kein Handlungsbedarf am Schema.**
2. `20260813113728…sql` – `null value in column "company_id"`.
   Diese Migration ist ein **einmaliges Sicherheits-Selbsttestskript**, das
   bestehende Nutzerdatensätze voraussetzt. In einer leeren Datenbank hat es
   keine Grundlage. Es erzeugt kein Schema. **Kein Handlungsbedarf.**
3. Beim ersten Durchlauf brach zusätzlich `20260812045512…sql` ab, weil sie zwei
   **fest verdrahtete Nutzer-IDs** (Owner-Registry) einfügt, die in einer leeren
   Datenbank nicht existieren. Folge: sechs spätere Migrationen scheiterten an
   den in dieser Datei definierten Funktionen (`is_admin_owner`,
   `can_view_test_users`, `test_user_visible`).
   **Erkenntnis mit Betriebsrelevanz:** ein Wiederaufbau „von null“ setzt voraus,
   dass die Owner-Konten zuerst existieren. Im Restore-Skript ist dieser Schritt
   dokumentiert und vorbereitet.

### Bewertung

Das **Schema** ist belastbar und vollständig wiederherstellbar (🟢).
Der Restore von **Daten, Auth-Konten und Storage-Objekten** ist plattformseitig
und wurde **nicht** getestet, weil dafür keine Zugriffsmöglichkeit besteht (🔴).
Damit gilt: die Wiederherstellbarkeit der Struktur ist bewiesen, die
Wiederherstellbarkeit der Inhalte ist eine Zusage der Plattform, die noch
verifiziert werden muss.

---

## 3. Recovery-Ziele

### Datenklassen

| Klasse            | Inhalte                                                                                                                                 | Verlust wäre                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **A – kritisch**  | Auth-Konten, `profiles`, `posts` + `post_originals`, Storage-Medien, `messages`/`conversations`, `market_transactions` + Zahlungsbezüge | nicht ersetzbar, Vertrauens- und ggf. Geldverlust |
| **B – wichtig**   | SlangTags, Arena-Daten, Connections, Kommentare, Likes/Saves                                                                            | inhaltlich schmerzhaft, teils rekonstruierbar     |
| **C – ersetzbar** | Feed-/Interessensignale, Zähler-Deltas, Caches, Test-/Botdaten, `ops_events`                                                            | neu erzeugbar                                     |

### Zielwerte

| Ziel                                   | Klasse A                                                                                                  | Klasse B        | Klasse C |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- | -------- |
| Maximal akzeptabler Datenverlust (RPO) | **offen** – abhängig von der Backup-Frequenz der Plattform, die aktuell nicht belegt ist                  | 24 h angestrebt | beliebig |
| Angestrebte Wiederverfügbarkeit (RTO)  | **offen** – die Wiederherstellung erfolgt durch die Plattform, eine belastbare Zeitangabe liegt nicht vor | –               | –        |

Bewusst **keine** SLA-Zusage. Realistisch belegbar ist heute nur:
Schema-Wiederaufbau ≈ Sekunden, Neuveröffentlichung der Anwendung ≈ Minuten.
Der zeitbestimmende Faktor ist der Datenbank-/Storage-Restore der Plattform.

**Festzulegen (Betreiber + ggf. DevOps):** Backup-Frequenz und Aufbewahrung
bestätigen, daraus RPO ableiten, RTO nach einem echten Plattform-Restore messen.

### Wiederherstellungsreihenfolge

```text
1. Datenbank (Schema + Daten)          – alles andere hängt daran
2. Auth (Konten/Sessions)              – ohne Anmeldung kein Zugriff auf RLS-Daten
3. Secrets / Environment               – Zahlungen, Push, Jobs, Moderation
4. Storage (Medien)                    – Beiträge bleiben sonst ohne Bild/Audio
5. Anwendung veröffentlichen           – SSR/Server-Funktionen
6. Job-Zeitpläne (cron)                – Moderation, Push, Zähler, Retention, Ops-Health
7. Funktionsprüfung                    – Smoke-Test, Runbook Abschnitt 6
```

---

## 4. Incident- und Security-Prozess

Vollständig in `docs/RUNBOOK_INCIDENT.md`:

- Ablauf: erkennen → melden → Severity → dokumentieren → eingrenzen → Maßnahme
  → prüfen → schließen → Ursache dokumentieren.
- Vier Betriebsstufen **Critical / High / Medium / Low** mit Beispielen und
  Reaktionsverhalten; technische Zuordnung zu `ops_events.severity` und
  `ops_incidents`.
- Dokumentationsvorlage ohne personenbezogene Daten.
- Eigener Security-Ablauf inkl. Spurensicherung (Löschläufe aussetzen),
  Secret-Rotation und Nachprüfung per Sicherheits-Scan und Testsuite.
- Ausdrücklich **keine** automatischen destruktiven Maßnahmen bei Verdacht:
  Accountsperre (`user_bans`) und Inhaltsverbergung bleiben manuell.

Technische Grundlage steht bereits aus Phase 3: `ops_events`, `ops_incidents`,
Schwellenwerte und Alarmaggregation (`src/lib/ops-monitor.shared.ts`),
Dashboard `/admin/health`, Cron-Endpunkt `/api/public/ops-health-run`.

---

## 5. Datenschutzprozess

Bestehende Bausteine geprüft und weiterhin gültig:
`docs/DATENSCHUTZ_TECHNIK.md` (Datenflüsse, Drittdienste, Löschung, Export) und
`docs/BETRIEB_LOGS_BACKUPS_VORFALL.md` (Protokolltabellen, Löschläufe).

Neu festgehalten (Runbook Abschnitt 7): Erkennung, Bestimmung der betroffenen
Datenkategorien, interne Information, Dokumentation, weitere Prüfungen.

Offen:

- **OFFEN (Konfiguration):** verantwortliche Person und Erreichbarkeit.
- **PRÜFUNG (rechtlich):** Meldepflicht, Fristen, Benachrichtigung Betroffener,
  Einordnung der Plattform-Backups in die Datenschutzerklärung.

---

## 6. Support-Kanal – geprüft, ausreichend für den Start

Vorhanden und funktionsfähig:

- Feedback-Dialog in der App (Kategorien Fehler / Verbesserung / Design /
  Performance / Sonstiges) → `feedback` → `/admin/feedback` mit Statusverwaltung.
- Melde-Funktion für Inhalte und Profile → `reports` → `/admin/reports`.
- E-Mail-Adresse im Impressum.
- Datenschutzwege `/request-data` und `/delete-account` (öffentlich erreichbar).

Lücke: Der Feedback-Dialog erfordert eine Anmeldung. Fälle wie „Login
funktioniert nicht“ laufen daher zwingend über die Impressum-Adresse. Keine neue
Support-Plattform gebaut – der bestehende Weg genügt für den Start.

---

## 7. Statusinformation

Bewertung: eine eigene Statusseite **innerhalb** der Anwendung hilft beim
schlimmsten Fall nicht, weil sie beim Ausfall derselben Infrastruktur ebenfalls
ausfällt. Deshalb wurde bewusst **nichts** gebaut.

Empfohlene einfachste Umsetzung, wenn sie gebraucht wird (Reihenfolge nach
Aufwand):

1. **Kurzfristig, ohne Infrastruktur:** kurze Statusmeldung auf einem externen
   Kanal des Betreibers (z. B. ein Social-Media-Profil), verlinkt im Impressum.
2. **Mittelfristig:** eine statische Statusseite auf einer **anderen** Domain
   bzw. einem anderen Anbieter mit vier Angaben: Störung bekannt (ja/nein),
   betroffener Bereich, wird bearbeitet, behoben um.
3. **Später:** externer Statusdienst mit Uptime-Prüfung gegen
   `https://y-dude.com/` – erkennt den Ausfall unabhängig von der Anwendung.

Intern existiert bereits eine vollständige Statusansicht: `/admin/health`.

---

## 8. Backup-, Restore- und Notfalldokumentation

### Backup

| Frage               | Antwort                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Was wird gesichert? | Datenbank und Storage plattformseitig; Schema und Code über das Repository (`supabase/migrations/`, `.lovable/backup/…`).              |
| Wie oft?            | Plattform: **nicht belegt, EXTERN zu klären.** Repository: bei jeder Änderung.                                                         |
| Wo?                 | Plattform-Backupspeicher (Lovable Cloud / Supabase); Repository im Projekt.                                                            |
| Wie lange?          | Plattform: **nicht belegt, EXTERN zu klären.** Repository: dauerhaft.                                                                  |
| Integritätsprüfung? | Schema: `bash scripts/restore-test.sh` (leere DB, alle Migrationen, RLS-Prüfung). Daten/Storage: derzeit keine eigene Prüfung möglich. |

### Restore

Reihenfolge und Abhängigkeiten: Abschnitt 3 („Wiederherstellungsreihenfolge“).

- **Schema/Struktur (selbst durchführbar, getestet):** `bash scripts/restore-test.sh`
  baut das komplette Schema in einer isolierten Datenbank auf. Bei einem
  Neuaufbau „von null“ müssen die Owner-Konten in `auth` vor der
  Owner-Registry-Migration existieren.
- **Daten / Auth / Storage (plattformseitig):** über Lovable Cloud anfordern
  bzw. auslösen. Ein Point-in-Time-Restore ist aus dem Projekt heraus nicht
  steuerbar.
- **Erfolgsprüfung:** Smoke-Test aus `docs/RUNBOOK_INCIDENT.md` Abschnitt 6,
  danach `/admin/health` auf neue kritische Ereignisse prüfen und
  `bunx vitest run` (371 Tests) ausführen.

### Notfall

| Frage                                  | Antwort                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wer erkennt den Ausfall?               | Observability aus Phase 3 (`ops_events`/`ops_incidents`, Alarmregeln, optionaler Webhook), zusätzlich Nutzermeldungen. Eine externe Verfügbarkeitsprüfung fehlt (siehe Abschnitt 7). |
| Wo sind die Logs?                      | `/admin/health`; Lovable Server-Logs (Preview/Published getrennt); Backend-Logs; Cloudflare; Stripe.                                                                                 |
| Wo sind die Backups?                   | Lovable Cloud (Daten/Storage); Repository (Schema/Code).                                                                                                                             |
| Wie wird getestet?                     | Restore-Test-Skript in isolierter DB; Preview-Umgebung als Staging; Zahlungen nur in Sandbox (Phase 2 erzwingt das).                                                                 |
| Wie wird Production wiederhergestellt? | Reihenfolge aus Abschnitt 3; Änderungen zuvor in Preview verifizieren; Production niemals als Testumgebung verwenden.                                                                |

Die Dokumentation ist so gehalten, dass externe Entwickler oder ein
DevOps-Spezialist damit arbeiten können: Skript, Reihenfolge, Prüfschritte und
offene Punkte sind benannt.

---

## 9. Notfall-Simulation – was getestet wurde

Sicher durchführbar und durchgeführt:

1. **Restore-Simulation** (Abschnitt 2): kompletter Schema-Wiederaufbau in einer
   isolierten Datenbank, inklusive Nachweis, dass alle 113 Tabellen RLS aktiv
   haben und sensible Tabellen für Clients gesperrt bleiben.
2. **Alarmkette auf Logikebene**: `tests/observability-alerting.test.ts` prüft
   Gruppierung gleichartiger Fehler, Schwellenwerte, Alarmentscheidung und
   Freiheit von personenbezogenen Daten. Gesamte Suite grün: **371 Tests**.
3. **Fehlerpfad Zahlungen**: die Webhook-Tests erzeugen bewusst ungültige
   Signaturen und Umgebungs-Fehlzuordnungen; dabei entstehen echte
   `critical`-Ereignisse in der Ops-Pipeline (im Test ohne Datenbank).

Nicht durchgeführt: ein echter Ausfall eines Staging-Dienstes. Grund: Datenbank
und Storage sind mit Production **geteilt** (siehe Phase-2-Bericht), ein
erzwungener Dienstausfall hätte Production getroffen. Voraussetzung für diesen
Test ist eine eigene Staging-Instanz.

---

## 10. Abschlussbericht Phase 4

| Bereich                   | Status | Begründung                                                                                                                                               |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup geprüft            | 🟡     | Backups existieren plattformseitig; Frequenz, Aufbewahrung und Integrität sind nicht belegt. Secrets sind nicht mitgesichert.                            |
| Restore getestet          | 🟡     | Schema-Restore erfolgreich getestet (219/221 Migrationen, 5 s, 0 Tabellen ohne RLS). Daten-, Auth- und Storage-Restore ungetestet, weil plattformseitig. |
| Recovery-Prozess          | 🟡     | Datenklassen, Reihenfolge und Abhängigkeiten definiert; RPO/RTO bewusst offen statt erfunden.                                                            |
| Incident-Prozess          | 🟢     | Ablauf, vier Severity-Stufen, Checkliste und Dokumentationsvorlage im Runbook.                                                                           |
| Security-Incident-Prozess | 🟢     | Eigener Ablauf inkl. Spurensicherung und Secret-Rotation; keine automatischen destruktiven Maßnahmen.                                                    |
| Datenschutz-Prozess       | 🟡     | Technisch dokumentiert; verantwortliche Person offen, rechtliche Bewertung ausstehend.                                                                   |
| Support-Kanal             | 🟢     | Feedback-Dialog, Meldungen, Impressum-E-Mail, Datenschutzwege vorhanden und im Admin sichtbar.                                                           |
| Statusinformation         | 🟡     | Intern vollständig (`/admin/health`); öffentliche Statusinformation bewusst nur als einfacher Umsetzungsweg dokumentiert.                                |
| Dokumentation             | 🟢     | Dieser Bericht, `docs/RUNBOOK_INCIDENT.md`, `scripts/restore-test.sh`.                                                                                   |
| Notfall-Simulation        | 🟡     | Restore- und Alarmkette simuliert; echter Dienstausfall nicht möglich, solange Staging die Datenbank mit Production teilt.                               |

### Tatsächlich umgesetzt

- Reproduzierbarer, isolierter Restore-Test als Skript (`scripts/restore-test.sh`)
  mit belegtem Ergebnis.
- Runbook mit Severity-Modell, Checkliste, Vorfallsvorlage, Security- und
  Datenschutzablauf, Smoke-Test-Reihenfolge.
- Backup-/Restore-/Notfalldokumentation inklusive Wiederherstellungsreihenfolge.
- Nachweis: 0 Tabellen ohne RLS, sensible Tabellen für Clients gesperrt,
  371 Tests grün.

### Nur dokumentiert (nicht gebaut)

- Öffentliche Statusseite (bewusst nicht in derselben Infrastruktur).
- RPO/RTO-Zielwerte (fehlende Datengrundlage).
- Secret-Inventar (darf nicht ins Repository).

### Externe Infrastruktur erforderlich

- Eigene Staging-Datenbank und eigener Storage-Bucket (Voraussetzung für einen
  echten Ausfalltest und einen echten Daten-Restore-Test).
- Externe Verfügbarkeitsprüfung und Statusseite außerhalb der Anwendung.
- Verbindliche Angaben der Plattform zu Backup-Frequenz und Aufbewahrung.

### Später durch DevOps/Security-Spezialisten

- Echter Point-in-Time-Restore mit Zeitmessung (liefert RTO/RPO).
- Aufbau eines Secret-Managements inkl. Rotationsplan.
- Einmalige Prüfung der Rollen- und Grant-Struktur gegen die Policies durch
  Dritte (die automatisierten Vertragstests ersetzen kein externes Audit).
- Rechtliche Prüfung des Datenschutz-Vorfallprozesses.

### Offene Risiken

1. **Geteilte Datenbank für Staging und Production** – größtes Restrisiko: kein
   echter Ausfall- oder Restore-Test ohne Auswirkung auf Production.
2. **Unbelegte Backup-Aufbewahrung** – der maximale Datenverlust ist derzeit
   nicht bezifferbar.
3. **Secrets nicht im Backup** – ein Restore stellt den Betrieb nicht
   vollständig wieder her, solange kein Secret-Inventar existiert.
4. **Ein-Personen-Betrieb** – Erkennung und Behebung hängen an der
   Erreichbarkeit einer Person; ohne externe Verfügbarkeitsprüfung kann ein
   nächtlicher Ausfall lange unbemerkt bleiben.
5. **Alte Seed-Migrationen mit fest verdrahteten Nutzer-IDs** – erschweren einen
   Wiederaufbau von null; im Restore-Skript umgangen, aber nicht bereinigt.
