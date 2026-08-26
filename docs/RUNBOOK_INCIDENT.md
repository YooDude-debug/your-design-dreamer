# Y-Dude – Runbook: Störungen, Security- und Datenschutzvorfälle

Stand: 2026-08-26. Kurzanleitung für den laufenden Betrieb. Ausführliche
Hintergründe: `docs/PHASE4_BETRIEB_RECOVERY_2026-08-26.md`.
Keine rechtlichen Fristen oder Pflichten – rechtliche Bewertung ist als
**PRÜFUNG (rechtlich)** markiert.

---

## 1. Wo schaue ich zuerst hin?

| Frage                             | Ort                                                                    |
| --------------------------------- | ---------------------------------------------------------------------- |
| Ist eine Störung bekannt?         | Adminbereich → **Systemzustand** (`/admin/health`)                      |
| Welche Fehler treten gerade auf?  | `/admin/health` → „Letzte Ereignisse“ (`ops_events`, 24 h)              |
| Gibt es offene Vorfälle?          | `/admin/health` → „Vorfälle“ (`ops_incidents`)                          |
| Serverfehler im Detail            | Lovable-Projekt → Server-Logs (Preview und Published getrennt)          |
| Datenbank / Auth                  | Lovable Cloud → Backend (Logs, Auth, Tabellen)                          |
| Auslieferung / Netzwerk           | Cloudflare-Konto des Betreibers                                         |
| Zahlungen                         | Stripe-Dashboard (Events, Webhook-Zustellversuche)                      |
| Nutzermeldungen                   | Adminbereich → **Feedback** (`/admin/feedback`), **Meldungen** (`/admin/reports`) |
| Migrationen / Schemastand         | `supabase/migrations/` (chronologisch)                                  |
| Backups                           | Lovable Cloud (plattformseitig verwaltet)                               |

---

## 2. Severity festlegen

| Stufe        | Kriterium (mindestens eines)                                                                                  | Erste Reaktion                              |
| ------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Critical** | Production nicht erreichbar; Datenbank/Auth global gestört; Zahlungen falsch verbucht; bestätigter Security-Vorfall | sofort, alles andere zurückstellen          |
| **High**     | zentrale Funktion (Feed, Messenger, Anmeldung, Checkout) stark beeinträchtigt; deutlich erhöhte Fehlerquote     | sofort, aber ohne Notabschaltung            |
| **Medium**   | eine wichtige Einzelfunktion fehlerhaft; nur begrenzter Nutzerkreis betroffen                                  | geplant am gleichen Arbeitstag              |
| **Low**      | kleiner Fehler, kein wesentlicher Betriebseinfluss (Darstellung, Text, Einzelfall)                             | im normalen Arbeitsablauf                   |

Technische Zuordnung: `ops_events.severity` (`info`/`warning`/`critical`) und
`ops_incidents.severity` aus `src/lib/ops-monitor.shared.ts`. Die
Betriebs-Severity oben ist die menschliche Bewertung – sie kann höher liegen
als die technische.

---

## 3. Checkliste: kritischer Production-Vorfall

- [ ] Alert / Meldung prüfen (Systemzustand, Server-Logs, Nutzermeldung)
- [ ] Environment bestätigen (`production` vs. `staging` – steht in jedem Ereignis)
- [ ] betroffenen Dienst identifizieren (Bereich: API, DB, RPC, Auth, Payments, Webhook, Push, Performance, Security)
- [ ] Auswirkung feststellen (alle Nutzer / Teilgruppe / einzelne Funktion)
- [ ] Logs prüfen (Server-Logs + `ops_events` der letzten Stunde)
- [ ] letzte Änderungen prüfen (letzte Veröffentlichung, letzte Migration)
- [ ] falls Ursache eine Änderung ist: keine weiteren Deployments, Veröffentlichung stoppen
- [ ] Ursache eingrenzen (Reproduktion in Preview/Staging, nicht in Production experimentieren)
- [ ] Maßnahme durchführen (Fix, Rücknahme der Änderung, Abschalten der betroffenen Funktion)
- [ ] Funktion prüfen (Anmeldung, Feed laden, Nachricht senden, Zahlung – siehe Abschnitt 6)
- [ ] Vorfall dokumentieren (`ops_incidents.note` + Eintrag nach Vorlage unten)
- [ ] Folgearbeiten festhalten (Test ergänzen, Alarmregel schärfen, Ursache dauerhaft beheben)

Ablauf in Kurzform:

```text
Problem erkannt → Alert → Severity → Vorfall dokumentieren → Ursache eingrenzen
→ Maßnahme → System prüfen → Vorfall schließen → Ursache dokumentieren
```

---

## 4. Vorlage: Vorfallsdokumentation

Ablage: `ops_incidents.note` (kurz) und – bei Critical/High – zusätzlich als
Datei unter `docs/incidents/JJJJ-MM-TT-kurzname.md`.

```text
Zeitpunkt (erkannt / behoben):
Environment:            production | staging | development
Betroffener Dienst:     api | database | rpc | auth | payments | webhook | push | performance | security
Severity:               critical | high | medium | low
Beschreibung:
Auswirkung:             (welche Funktion, wie viele Nutzer, wie lange)
Erkannte Ursache:
Durchgeführte Maßnahmen:
Wiederherstellung um:
Offene Folgearbeiten:
```

Keine personenbezogenen Daten aufnehmen: keine E-Mail-Adressen, keine
Nachrichteninhalte, keine Zahlungsdaten. Nutzer nur über technische Kennungen
(User-ID) benennen, und nur wenn nötig.

---

## 5. Security-Vorfall (eigener Ablauf)

Auslöser: kompromittierter Account, verdächtige Anmeldeaktivität,
unberechtigter Datenzugriff, geleaktes Secret, ungewöhnlicher Adminzugriff,
möglicher RLS-Fehler.

```text
Security-Alert → Zugriff/Ursache eingrenzen → betroffene Systeme identifizieren
→ Credentials/Secrets absichern → Schwachstelle beheben → Auswirkung prüfen
→ Vorfall dokumentieren
```

Schritte:

1. **Nicht löschen, nicht überschreiben.** Löschläufe (`retention-run`) für die
   betroffenen Tabellen nicht aktivieren, damit Spuren erhalten bleiben.
2. **Eingrenzen:** `account_security_events`, `admin_audit_log`,
   `ops_events` (Bereich `security`/`auth`), Auth-Logs, Cloudflare-Logs.
3. **Betroffene Systeme benennen:** Tabellen, Storage-Objekte, Secrets,
   Endpunkte.
4. **Absichern:** betroffene Secrets rotieren (Worker-Token, Stripe-Webhook-Secret,
   API-Schlüssel), Sitzungen beenden bzw. Passwort-Reset anstoßen.
5. **Schwachstelle beheben:** RLS-Policy, Grant, Serverfunktion, Validierung –
   danach Sicherheits-Scan und `bunx vitest run` (RLS-Vertragstests).
6. **Auswirkung prüfen:** welche Daten waren erreichbar, über welchen Zeitraum.
7. **Dokumentieren** nach Vorlage in Abschnitt 4, Kennzeichnung „Security“.

Bewusst **nicht** implementiert: automatische Sperrung von Accounts oder
automatisches Löschen von Daten bei Verdacht. Sperren (`user_bans`) und
Verbergen von Inhalten (`posts.hidden_at`) bleiben manuelle Entscheidungen.

---

## 6. Funktionsprüfung nach einer Wiederherstellung („Smoke-Test“)

Reihenfolge einhalten – jede Stufe setzt die vorige voraus:

1. Startseite lädt (`/`) – SSR antwortet, kein 500.
2. Anmeldung funktioniert (`/auth`) – Session wird gesetzt.
3. Feed lädt Beiträge inkl. Bildvarianten.
4. Profil und Connections laden (RLS-Pfade als angemeldeter Nutzer).
5. Messenger: Nachricht senden und Lesestatus setzen.
6. Market: Artikelliste laden; Checkout nur in Sandbox testen.
7. Storage: Bild/Audio eines Beitrags spielt bzw. lädt.
8. Adminbereich → Systemzustand: keine neuen kritischen Ereignisse.

---

## 7. Datenschutzvorfall

1. **Erkennung:** wie Security-Vorfall (Abschnitt 5) plus Nutzermeldung über
   Feedback oder die im Impressum genannte Adresse.
2. **Betroffene Daten bestimmen:** Kategorien aus
   `docs/VERARBEITUNGSVERZEICHNIS_TECHNISCH.md` (Profil, Beiträge, Medien,
   Nachrichten, Standortangaben, Zahlungsbezüge, Protokolle).
3. **Intern informieren:** verantwortliche Person des Betreibers.
   **OFFEN (Konfiguration):** Name und Erreichbarkeit sind noch einzutragen.
4. **Dokumentieren:** Vorlage aus Abschnitt 4, zusätzlich betroffene
   Datenkategorien, Zeitraum, Anzahl betroffener Konten (Abfrage über die
   betroffenen Tabellen), bereits getroffene technische Maßnahmen.
5. **Weitere Prüfungen:** Umfang des Zugriffs, ob Daten abgeflossen sind, ob die
   Ursache anderswo ebenfalls besteht (gleiche Policy-Muster, gleiche Endpunkte).
6. **PRÜFUNG (rechtlich):** Meldepflicht, Fristen, Benachrichtigung Betroffener.
   Hier werden bewusst keine Fristen oder Pflichten festgelegt.

---

## 8. Support-Kanal (Stand heute)

- **In der App:** Feedback-Dialog im Profilbereich mit den Kategorien
  Fehler / Verbesserung / Design / Performance / Sonstiges → Tabelle `feedback`,
  sichtbar unter `/admin/feedback` mit Status Neu / In Bearbeitung / Erledigt / Abgelehnt.
- **Inhalte und Profile melden:** Melde-Funktion → `reports` → `/admin/reports`.
- **E-Mail:** die im Impressum genannte Adresse (`src/lib/legal/company.ts`).
- **Datenschutzrechte:** `/request-data` (Auskunft/Export) und
  `/delete-account` (Löschung), zusätzlich in den Einstellungen.

Offen: Der Feedback-Dialog setzt eine Anmeldung voraus. Wer sich **nicht
anmelden kann**, hat als Weg nur die E-Mail-Adresse aus dem Impressum. Diese
Adresse sollte auf der Startseite sichtbar bleiben.
