# Y-Dude – Phase 3: Observability + Alerting

Stand: 2026-08-26

## 1. Ausgangslage

Vorhanden waren: strukturierte Serverprotokolle (`src/lib/observability.server.ts`),
Laufzeitkennzahlen (`src/lib/runtime-metrics.server.ts`) und das Admin-Log für
Moderationsaktionen. Es fehlten: zentrale Fehlererfassung über alle Bereiche,
Gruppierung gleichartiger Fehler, Schwellenwerte, Alarmierung und eine
technische Gesamtübersicht.

## 2. Architektur

```text
Fehler/Messung
  → recordOpsEvent()            (src/lib/ops-monitor.server.ts)
      → Serverprotokoll         (immer, auch bei DB-Ausfall)
      → ops_events              (Rohereignis, 14 Tage Aufbewahrung)
      → Fingerprint             (Bereich:Ereignis:Dienst)
      → ops_incidents           (offener Vorfall je Fingerprint + Umgebung)
      → shouldAlert()           (Schwellenwert, Schweregrad, Sperrzeit, Umgebung)
      → dispatchAlert()         (Webhook oder Serverprotokoll)
```

Zentrale Dateien:

| Datei | Zweck |
| --- | --- |
| `src/lib/ops-monitor.shared.ts` | Bereiche, Schweregrade, Regeln, Fingerprint, Alarmtext, Ampel, DTOs |
| `src/lib/ops-monitor.server.ts` | Erfassung, Aggregation, Alarmversand, Systemprüfung, Aufräumen |
| `src/lib/ops-health.server.ts` | Aufbereitung der Kennzahlen für die Übersicht |
| `src/lib/ops.functions.ts` | Adminzugriff (Übersicht, Vorfallstatus, Selbsttest) |
| `src/routes/admin.health.tsx` | Dashboard „Systemzustand“ |
| `src/routes/api/public/ops-health-run.ts` | Zeitplanlauf: aktive Prüfungen + Aufräumen |

Tabellen: `ops_events` (Rohereignisse) und `ops_incidents` (gruppierte Vorfälle),
beide mit RLS, Zugriff ausschließlich für Admins bzw. den Serverdienst.

## 3. Umgebungstrennung

Jedes Ereignis trägt die Umgebung (`development` | `staging` | `production`),
ermittelt über `appEnvironment()` aus Phase 2. Vorfälle werden je Umgebung
getrennt gruppiert, die Übersicht zeigt immer nur eine Umgebung.
`development` löst grundsätzlich keinen Alarm aus; Staging-Alarme sind im Titel
mit `STAGING` gekennzeichnet und können nie als Production-Störung erscheinen.

## 4. Überwachte Bereiche

| Bereich | Was gemessen wird | Alarmregel |
| --- | --- | --- |
| API / Server-Funktionen | unbehandelte Serverfehler (`start.ts`) | 10× in 10 min |
| Datenbank | Erreichbarkeit, Antwortzeit (Budget 800 ms) | 3× in 10 min |
| Datenbankfunktionen (RPC) | Erreichbarkeit, Antwortzeit (1200 ms) | 5× in 10 min |
| Anmeldung/Auth | Fehler im Anmeldeweg | 20× in 10 min |
| Zahlungen | fehlgeschlagene Zahlungen, hängende Vorgänge | 1× in 60 min |
| Zahlungs-Webhook | Signatur-/Verarbeitungsfehler, Laufzeit (3000 ms) | 3× in 15 min |
| Push | endgültig gescheiterte Zustellungen, Ausfallquote | 25× in 30 min |
| Performance | Überschreitung der Latenzbudgets | 10× in 15 min |
| Sicherheit | Umgebungsverstöße (z. B. Live-Zahlung in Staging) | 1× in 60 min |

Schweregrade: `info` (nur Protokoll), `warning` (Auffälligkeit, Ampel gelb),
`critical` (sofortige Bewertung, Ampel rot).

## 5. Alarmierung

- Gruppierung über Fingerprint verhindert Alarmfluten: ein Vorfall, viele Ereignisse.
- Wiederholungssperre je Bereich (15–120 min) statt Dauerbenachrichtigung.
- Kanal: optionaler Webhook über `OPS_ALERT_WEBHOOK_URL` (Slack/Discord-kompatibel).
  Ohne Kanal bleibt der Alarm im Serverprotokoll und im Dashboard sichtbar –
  er geht nie verloren.
- Alarmtexte enthalten Umgebung, Bereich, Schweregrad, Ereignis, Vorfalls-ID,
  Häufigkeit, Zeit und den Verweis `/admin/health` – keine Nutzerinhalte,
  keine E-Mail-Adressen, keine Schlüssel.

## 6. Zeitplan (aktive Prüfung)

`POST /api/public/ops-health-run` (Token: `OPS_HEALTH_CRON_TOKEN`) prüft
Datenbank, Datenbankfunktion, Push-Warteschlange, Zahlungsfehler und
inkonsistente Zahlungszustände, meldet Auffälligkeiten selbstständig und
räumt Ereignisse älter als 14 Tage auf. Vorfälle ohne neues Ereignis in 24 h
werden nachvollziehbar automatisch geschlossen.

## 7. Dashboard `/admin/health`

Zeigt Gesamtampel, Umgebung, Alarmweg, Kennzahlen je Bereich (Fehler 1 h / 24 h,
kritische Fehler, p95-Antwortzeit, offene Vorfälle, geltende Alarmregel),
die Vorfallsliste mit „Gesehen“/„Erledigt“ und die letzten 40 Ereignisse.
Aktualisiert sich automatisch jede Minute. Zugriff nur für Admins.

## 8. Tests

`tests/observability-alerting.test.ts` (15 Tests) prüft Gruppierung,
Schwellenwerte, Schweregradlogik, Umgebungstrennung, Wiederholungssperre,
Ampellogik und dass Alarmtexte keine sensiblen Daten enthalten.
Gesamtsuite: 371 Tests grün.

Zusätzlich prüfbar über das Dashboard: Schaltfläche „Selbsttest“ erzeugt
kontrolliert Testereignisse – in der Produktion gesperrt.

## 9. Offene Punkte

- `OPS_ALERT_WEBHOOK_URL` ist noch nicht hinterlegt; bis dahin laufen Alarme
  nur ins Serverprotokoll und ins Dashboard.
- Der Zeitplanlauf muss extern getaktet werden (Cron auf
  `/api/public/ops-health-run`).
