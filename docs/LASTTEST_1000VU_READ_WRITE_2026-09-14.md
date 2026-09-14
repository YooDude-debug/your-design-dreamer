# Y-Dude – Read-/Write-Lasttest 1.000 VU: **NICHT DURCHGEFÜHRT (BLOCKED)**

**Datum:** 14.09.2026, 08:20–08:35 UTC
**Ergebnis:** Der Test wurde **nicht** ausgeführt. Es fehlt eine geeignete, beschreibbare Testumgebung.
**Am Produkt geändert:** nichts (kein Code, keine Datenbank, keine Regeln, keine Rechte, keine Testkonten, keine Testdaten).

---

## Executive Summary

Der gewünschte kombinierte Lese-/Schreib-Lasttest mit bis zu 1.000 gleichzeitigen Nutzern **konnte nicht durchgeführt werden**. Ihre eigene Vorgabe – „nur Testumgebung, niemals Production erzwingen" – ist mit den hier verfügbaren Zugängen nicht erfüllbar:

- Das Projekt, in dem ich arbeite, ist **Y-Dude Production**. Vorschau und veröffentlichte Website teilen **eine einzige Datenbank**. Jeder Schreibvorgang aus einem Lasttest würde also in den echten Live-Daten landen (Konten, Beiträge, Nachrichten, Market-Artikel, Vorgänge, Dateien).
- Es existiert ein getrenntes Projekt **Y-Dude Staging** (`y-dude-staging.lovable.app`). Ich habe darauf jedoch **nur Lesezugriff auf den Quellcode**, keinen Zugang zu dessen Datenbank, Anmeldedienst, Speicher oder Schlüsseln. Ich kann dort weder Testkonten anlegen noch Last erzeugen noch messen.

Damit sind **alle** Schreibteile des Auftrags blockiert (Punkte 1, 3, 5, 6, 7, 8-Schreibanteil, 10-Schreibanteil, 11-Bearbeiten, 12, 13, 14-Schreibanteil, 15, 17-Schreibmetriken, 18, 20-Schreibvergleich). Ein reiner Lesetest wäre möglich, würde aber nur den Lauf vom 14.09.2026 (`docs/LASTTEST_1000VU_2026-09-14.md`) wiederholen und keine neue Aussage liefern; er wurde deshalb nicht erneut gestartet.

**Es liegen aus diesem Auftrag keine Messwerte vor.** Alle Bereichsbewertungen (Auth, Feed, Profile, Suche, Messenger, Market, Transaktionen, Uploads, Datenbank, RLS, Datenintegrität) bleiben für kombinierte Schreiblast **ungemessen** – nicht „grün".

---

## 1. Was tatsächlich geprüft wurde (Vorbereitung, rein lesend)

| Prüfung | Ergebnis |
|---|---|
| Umgebungslage im Code (`src/lib/environment.shared.ts`) | Drei logische Umgebungen (development/staging/production) werden **nach Hostname** unterschieden – nicht nach Datenbank. |
| Datenbank-Trennung im aktuellen Projekt | **Keine.** Eine Cloud-Instanz bedient Vorschau **und** veröffentlichte Website. |
| Getrenntes Staging-Projekt | Vorhanden: „Y-Dude Staging" (`y-dude-staging.lovable.app`). Zugriff von hier: **nur Quellcode lesen**. |
| Backend-Zustand Production | Erreichbar und unauffällig (Anmeldedienst, Datenbank). |
| Registrierung automatisierbar? | **Nein.** Bot-Prüfung (Turnstile) vorgeschaltet; Umgehen ist laut Auftrag und Grundsatz ausgeschlossen. |
| Zahlungen | Market-Käufe laufen bewusst **nicht** über Y-Dude; es gibt keinen Mock-Zahlungspfad, der einen Kaufabschluss simuliert. Der Abschluss läuft über `market_complete_transaction`. |

---

## 2. Warum der Test in Production nicht erzwungen wurde

Ein Schreib-Lasttest mit 1.000 Nutzern hätte in der Live-Datenbank erzeugt:

- mehrere hundert echte Konten im Anmeldedienst (dauerhaft, nur einzeln entfernbar),
- Beiträge, Nachrichten, Konversationen, Aufrufzähler, Follow-Beziehungen,
- Market-Artikel samt Bildern im Speicher, Reservierungen, abgeschlossene Vorgänge und damit auf „verkauft" gesetzte Artikel,
- Verfälschung aller Live-Kennzahlen (Nutzerzahl, Nachrichten, Artikel, Vorgänge) – genau der Datenbestand, der in Ihren Förderunterlagen als belegbar auftritt.

Das widerspricht Ihrer Vorgabe direkt. Deshalb: Abbruch statt Notlösung.

---

## 3. Was für die Testumgebung noch fehlt

Damit dieser Test vollständig laufen kann, sind folgende Punkte nötig. Ohne sie bleibt der Auftrag blockiert.

### P0 – zwingend

1. **Beschreibbare Staging-Umgebung mit eigener Datenbank.** Entweder wird im Projekt „Y-Dude Staging" gearbeitet (dann muss dieser Auftrag **dort** gestellt werden, nicht hier), oder es wird eine separate Testinstanz mit identischem Schema bereitgestellt.
2. **Aktueller Schemastand in Staging.** Alle Migrationen (u. a. 0037/0038 mit `market_complete_transaction` und den Rechten) müssen dort angewendet sein, sonst messen wir ein anderes System.
3. **Vorgesehener Mechanismus zum Anlegen von Testkonten in Staging** – z. B. Bot-Prüfung in Staging abschaltbar oder ein serverseitiger Anlegepfad, der ausschließlich in Staging existiert. Kein Umgehen der Produktions-Bot-Prüfung.
4. **Ausdrückliche Freigabe, dass Staging-Daten anschließend gelöscht werden dürfen** (Konten, Artikel, Nachrichten, Dateien).

### P1 – für Vollständigkeit des Auftrags

5. **Test-Zahlungs-/Abschlusspfad in Staging** (Sandbox-Schlüssel sind vorhanden) bzw. schriftliche Festlegung, dass der Abschluss weiterhin ohne Zahlung über `market_complete_transaction` gemessen wird.
6. **Eigener Speicher-Bereich in Staging** für Test-Uploads mit anschließender Bereinigung.
7. **Zugriff auf Datenbankkennzahlen der Staging-Instanz** (Verbindungen, langsame Abfragen, Sperren, Deadlocks, Rollbacks, CPU/Speicher) – sonst sind die Punkte 17/18 nicht belegbar.

### P2 – Qualität der Aussage

8. **Wiederverwendbarer Lastgenerator im Repo** (bisher nur ein Wegwerf-Skript außerhalb des Projekts), damit Läufe vergleichbar und wiederholbar werden.
9. **Referenz-Lesetest in Staging**, damit der Vergleich „vorher lesend / nachher lesend+schreibend" auf derselben Umgebung beruht. Ein Vergleich Staging-Schreiblast gegen Production-Lesetest (14.09.2026) wäre methodisch unsauber.

---

## 4. Bereichsanalyse

| Bereich | Status | Ergebnis |
|---|---|---|
| Auth | ⬜ ungemessen | Registrierung/Login in Masse nur in Staging zulässig |
| Feed lesen | ⬜ ungemessen (hier) | belegt aus dem Lesetest 14.09.2026, nicht aus diesem Auftrag |
| Feed schreiben (Posts, Aufrufe, Follows) | ⬜ ungemessen | BLOCKED |
| Profile | ⬜ ungemessen | Bearbeiten/Uploads BLOCKED |
| Suche | ⬜ ungemessen | nur Lesepfade wären möglich |
| Messenger lesen | ⬜ ungemessen (hier) | belegt aus dem Lesetest 14.09.2026 |
| Messenger schreiben | ⬜ ungemessen | BLOCKED |
| Market lesen | ⬜ ungemessen (hier) | belegt aus dem Lesetest 14.09.2026 |
| Market schreiben | ⬜ ungemessen | BLOCKED |
| Market-Transaktionen / Race Conditions | ⬜ ungemessen | BLOCKED – Nachweis nur über echte parallele Vorgänge möglich |
| Uploads | ⬜ ungemessen | BLOCKED |
| Datenbank unter Schreiblast | ⬜ ungemessen | BLOCKED |
| RLS/Security unter Schreiblast | ⬜ ungemessen | BLOCKED |
| Datenintegrität vorher/nachher | ⬜ ungemessen | BLOCKED |

Keine Bewertung 🟢/🟡/🔴 wird vergeben, weil keine Messwerte vorliegen. Eine grüne Bewertung ohne Messung wäre eine Falschaussage.

---

## 5. Antworten auf die Abschlussfragen

| Frage | Antwort |
|---|---|
| Konnte der vollständige Read/Write-Test durchgeführt werden? | **Nein.** |
| Welche Bereiche wurden getestet? | Keine. Nur Vorbereitung/Prüfung der Umgebungslage (rein lesend). |
| Welche Bereiche waren BLOCKED? | Alle Schreibpfade sowie alle Kennzahlen zu kombinierter Last. |
| Blieb die Datenintegrität erhalten? | **Ja** – es wurde nichts geschrieben, weder Konten, Beiträge, Nachrichten, Artikel, Vorgänge noch Dateien. |
| Traten Race Conditions auf? | Nicht prüfbar – kein Lauf. |
| Wurden Market-Transaktionen korrekt abgeschlossen? | Nicht prüfbar – kein Lauf. Bekannt bleibt der bestehende Unit-Test-Nachweis (13/13) zur Abschlusslogik. |
| Wurden Nachrichten korrekt geschrieben? | Nicht prüfbar – kein Lauf. |
| Funktionierten Uploads? | Nicht prüfbar – kein Lauf. |
| Wurden 1.000 VU stabil erreicht? | Für Schreiblast: nicht geprüft. Für reine Leselast ist es am 14.09.2026 belegt. |
| Welche Verbesserungen ergeben sich? | Ausschließlich der oben genannte Aufbau der Testumgebung (P0–P2). Keine Produkt- oder Datenbankempfehlung, da keine Messwerte vorliegen. |

---

## 6. Vergleich mit dem Lesetest vom 14.09.2026

Ein Vergleich ist **nicht möglich**, da für diesen Auftrag keine Werte erhoben wurden. Der bisherige Stand bleibt unverändert gültig: 606.325 Anfragen, 0 Serverfehler, 1 Zeitüberschreitung, bei 1.000 VU p50 52 ms / p95 98 ms, max. 38 Datenbankverbindungen, 0 Sperren, 0 Deadlocks, Datenbestand unverändert – **rein lesend**.

---

## 7. Gesamturteil

**⬜ Kein Urteil möglich.** Der Auftrag ist BLOCKED, nicht fehlgeschlagen. Sobald eine beschreibbare Staging-Umgebung nach Abschnitt 3 bereitsteht – und der Auftrag dort gestellt wird – kann der vollständige Read-/Write-Lauf einschließlich Race-Condition- und Integritätsprüfung genau nach Ihrer Vorgabe ausgeführt werden.

*Während dieser Prüfung wurden keine Code-, Datenbank-, Index-, Regel-, Rechte- oder Cache-Änderungen vorgenommen und keine Testdaten erzeugt.*
