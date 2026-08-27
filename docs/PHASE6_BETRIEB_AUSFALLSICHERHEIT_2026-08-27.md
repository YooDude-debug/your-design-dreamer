# Y-Dude – Phase 2: Betrieb & Ausfallsicherheit

Stand: 2026-08-27. Keine neuen Produktfeatures, keine Erweiterung des Funktionsumfangs.

## 1. Alerting – Ausfälle werden aktiv erkannt

| Baustein | Umsetzung |
| --- | --- |
| Automatische Prüfung | Zeitplan `y-dude-ops-health` ruft `/api/public/ops-health-run` alle 5 Minuten auf (authentifiziert über das Worker-Geheimnis). |
| Kanäle | `OPS_ALERT_WEBHOOK_URL` (Hauptweg) und optional `OPS_ALERT_WEBHOOK_URL_2` (Ausweichweg, z. B. anderer Anbieter). |
| Zustellsicherheit | Jeder Kanal wird zweimal versucht, jeder Versuch mit 5 s Zeitgrenze; danach folgt der Ausweichkanal. |
| Nicht zugestellt | Wird als Ereignis `alert_dispatch_failed` (Schweregrad „info“) erfasst – bewusst kein Alarm, damit kein Alarmkreislauf entsteht. Der Alarm bleibt zusätzlich im Serverprotokoll und im Cockpit sichtbar. |
| Lebenszeichen | Nach jeder erfolgreichen Prüfung wird optional `OPS_HEARTBEAT_URL` aufgerufen („Totmannschalter“). Fällt Y-Dude oder der Zeitplan aus, bleibt das Lebenszeichen aus und der externe Dienst alarmiert unabhängig von Y-Dude. |
| Alarmtest | Admin-Cockpit → Systemzustand → Schaltfläche **Alarmtest**. Sendet eine als `[TEST]` markierte Meldung; erzeugt keine Vorfälle und ist auch in der Produktion gefahrlos. |

Offen (manuell durch den Betreiber): `OPS_ALERT_WEBHOOK_URL` und optional
`OPS_HEARTBEAT_URL` als Projektgeheimnisse hinterlegen. Ohne diese Werte
funktioniert das System vollständig, Alarme bleiben aber nur intern sichtbar.

## 2. Backup, RPO und RTO

| Bereich | Sicherung | RPO (max. Datenverlust) | RTO (max. Wiederherstellzeit) |
| --- | --- | --- | --- |
| Datenbank | Plattformseitige tägliche Sicherung (Lovable Cloud) | 24 h | 4 h |
| Schema/Migrationen | 221+ Migrationen im Projekt, vollständig wiederspielbar (`scripts/restore-test.sh`, letzte Prüfung: 219/221 in 5 s, 0 Tabellen ohne RLS) | 0 | < 1 h |
| Anwendungscode | Versionsverwaltung im Projekt | 0 | < 1 h |
| Medien (Storage) | Plattformseitig, kein eigener Zweitspeicher | 24 h | 4 h |
| Geheimnisse/Konfiguration | Nicht Teil der Sicherung – manuell dokumentiert nachzuziehen | – | manuell |

Restore-Prozess und Vorfallablauf: siehe `docs/RUNBOOK_INCIDENT.md` und
`docs/PHASE4_BETRIEB_RECOVERY_2026-08-26.md`.

## 3. Tests für reale Nutzerflüsse und bekannte Fehler

Neu in dieser Phase:

- `tests/alerting-delivery.test.ts` (11 Tests): Kanalerkennung, Testmeldung,
  Ausweichkanal, Zeitgrenze, Fehlschlag ohne Ausnahme, Lebenszeichen.
- `tests/messenger-navigation.test.ts` (8 Tests): Kategorieerkennung,
  Rücksetzen beim Öffnen/Schließen, einmaliger Kategoriewechsel und der
  Regressionsfall „Messenger bleibt nach Market-Chat in der Market-Liste“.

Die Messenger-Logik wurde dafür in `src/lib/messenger-view.ts` als reine,
prüfbare Logik herausgelöst; das Verhalten der Oberfläche bleibt unverändert.

## 4. Teststrategie

1. **Verträge zuerst**: RLS, Rollen, Auth-Gates und Geldpfade sind durch
   Vertragstests abgedeckt – dort ist ein Fehler am teuersten.
2. **Reale Fehler werden Tests**: Jeder in der Produktion beobachtete Fehler
   wird als Regressionstest festgeschrieben (aktuell u. a. Messenger-Kategorie,
   Übersetzungsguthaben, Server-Function-Aufteilung).
3. **Reine Logik statt Oberfläche**: Entscheidungslogik wird aus Komponenten
   herausgelöst und einzeln geprüft, statt Oberflächen nachzubauen.
4. **Freigabe-Gate**: `bun run verify` (Typprüfung, Lint, Tests) ist die
   verbindliche Stufe vor jeder Veröffentlichung; CI prüft dasselbe bei jedem
   Push und Pull Request.

## 5. Abschluss

- Alarmzustellung mit Wiederholung, Zeitgrenze, Ausweichkanal und Lebenszeichen: umgesetzt.
- Automatische Prüfung alle 5 Minuten: aktiv.
- Backup-/RPO-/RTO-Konzept: dokumentiert.
- Testsuite: 397 Tests grün (378 bestehende + 19 neue).
- Keine neuen Produktfeatures, keine Funktionsänderung in der Oberfläche außer
  der Betriebs-Schaltfläche „Alarmtest“ im Admin-Cockpit.
