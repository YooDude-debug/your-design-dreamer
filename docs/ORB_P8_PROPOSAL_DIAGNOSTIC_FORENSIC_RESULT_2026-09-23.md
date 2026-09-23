# ORB Core – P8 Forensik der Vorschlags-/Diagnose-Abfragen (2026-09-23)

Status: READ-ONLY abgeschlossen. Kein Produktionscode geändert. Keine Optimierung.
Referenz: `docs/ORB_P7_DB_FORENSIC_RESULT_2026-09-23.md`

Alle Befunde sind als **BEWIESEN**, **WAHRSCHEINLICH** oder **UNBEKANNT** gekennzeichnet.

---

## 1. P7-Baseline

P7 hat die End-of-Turn-Momentaufnahme (`getSnapshot`, 9 Reads + 1 bedingter
Write) vollständig vermessen und zwei Abfragen auf `orb_suggestions` als offenes
Potenzial benannt, ohne sie zu bewerten. P8 untersucht ausschliesslich diese
zwei Abfragen. Der Code ist unverändert (Stand P6/P7).

## 2. Erste Abfrage (Vorschlagsliste)

**BEWIESEN** (`src/orb-core/engine.server.ts:384–389`)

| Merkmal | Befund |
| --- | --- |
| Query | `orb_suggestions`.select(`id, post_id, topic, reason, relevance, status, posts(title)`), `eq user_id`, `order relevance desc`, `limit 20` |
| RPC | keiner |
| auslösende Funktion | `getSnapshot` (innerhalb `Promise.all`) |
| Zeitpunkt | Zugende, nach allen Entscheidungen und Schreibvorgängen; ausserdem bei jedem direkten Snapshot-Aufruf (Seitenaufruf, `observeFeed`, `decideSuggestion`, `recordFeedback`) |
| gelesene Tabellen | `orb_suggestions` + Join `posts(title)` |
| gelesene Zeilen | 0–20 (Limit 20; gemessen 0/3/13/20) |
| Consumer | `snapshot.suggestions` → `OrbSuggestions` (`channels.orb.tsx:382`), dort gefiltert auf `pending`/`shown` |
| weitere Verwendung | keine – kein Zugriff auf `snapshot.suggestions` ausserhalb dieser Komponente |

Einfluss auf: Antwort **nein**, Memory **nein**, Graph **nein**, Connections
**nein**, Thought Threads **nein**, Curiosity **nein**, Energy **nein**,
autonome Fragen **nein**, Status **nein**, sichtbare UI **ja** (Vorschlagsleiste).

Der Datenfluss wurde über den Codepfad verfolgt, nicht über Variablennamen: die
Momentaufnahme entsteht erst nach allen ORB-Entscheidungen, ihr Rückgabewert
wird ausschliesslich an die Oberfläche gegeben.

## 3. Zweite Abfrage (Statuszählung)

**BEWIESEN** (`src/orb-core/engine.server.ts:390–395`)

| Merkmal | Befund |
| --- | --- |
| Query | `orb_suggestions`.select(`status`), `eq user_id`, `in status [accepted, rejected]`, `limit 500` |
| auslösende Funktion | `getSnapshot` (gleiches `Promise.all`, Ergebnisvariable `countRes`) |
| gelesene Daten | nur die Spalte `status` entschiedener Vorschläge |
| Verarbeitung | zwei `Array.filter(...).length` (Zeilen 497–498) |
| Ergebnis | `snapshot.metrics.suggestionsAccepted` und `…Rejected` |
| Consumer | ausschliesslich `OrbDevPanel` (`OrbDevPanel.tsx:107`), Kachel „Vorschläge angenommen / abgelehnt" im eingeklappten Abschnitt „Testbereich (Experiment)" |
| Einfluss auf ORB-Entscheidungen | keiner – die Werte werden nirgends gelesen ausser in der Anzeige |
| Warum 500 Zeilen | keine Aggregation im Code; es wird die Zeilenmenge geladen und in JavaScript gezählt. Das Limit 500 ist eine Obergrenze, keine fachliche Grenze. |
| Werden alle Zeilen benötigt | für die zwei Zahlen wird jede Zeile genau einmal gezählt; die Zeileninhalte selbst werden nicht weiterverwendet |

**BEWIESEN** – Nebenbefund: durch `limit 500` sind die beiden Zahlen bei mehr als
500 entschiedenen Vorschlägen systematisch abgeschnitten (Messung: 2000
entschiedene → angezeigt 250/250). Die Anzeige ist damit schon heute keine
verlässliche Gesamtzahl. Das belegt den rein diagnostischen Charakter, ändert
aber nichts am Verhalten des ORB.

Keine Doppelladung: die Statuswerte werden an keiner anderen Stelle desselben
Vorgangs erneut gelesen. Die erste Abfrage liest zwar dieselbe Tabelle, aber mit
anderem Filter, anderen Spalten und anderem Limit (nicht filtergleich).

## 4. Datenfluss beider Ergebnisse

```text
getSnapshot
 ├─ Abfrage 1 → suggestions[] → snapshot.suggestions → OrbSuggestions (sichtbar)
 └─ Abfrage 2 → countRes.data → 2x filter().length
                              → snapshot.metrics.suggestionsAccepted/Rejected
                              → OrbDevPanel (Diagnosekachel)
```

**BEWIESEN** – kein Rückfluss in `processInput`, `autonomy`, `curiosity`,
`memory`, `continuity`/Threads, `impulse` oder `eligibility`. Keine
Persistierung: beide Ergebnisse existieren nur im Rückgabewert des Vorgangs.

## 5. Analyse der bis zu 500 Zeilen

| Fall (Attrappe) | Limit | gelesene Zeilen Abfrage 2 | erzeugte Werte | verwendete Datensätze |
| --- | --- | --- | --- | --- |
| 0 entschieden | 500 | 0 | 0 / 0 | 0 |
| 10 entschieden | 500 | 10 | 5 / 5 | 10 (nur Status) |
| 500 entschieden | 500 | 500 | 250 / 250 | 500 (nur Status) |
| 2000 entschieden | 500 | 500 | 250 / 250 | 500, Rest ignoriert |

- tatsächliche maximale Datenmenge: 500 Zeilen × 1 Spalte.
- Produktionsstand (lesend, `orb_suggestions`): insgesamt 1 Zeile, davon 0
  entschieden → derzeit liest Abfrage 2 in der Produktion **0 Zeilen**.
- durchschnittliche Datenmenge in der Produktion: praktisch 0 (**BEWIESEN** für
  den heutigen Datenstand, **UNBEKANNT** für künftige Nutzung).
- Alle geladenen Zeilen werden verarbeitet (je einmal gezählt).
- Benötigt werden nachweislich nur zwei Aggregatwerte.
- **WAHRSCHEINLICH** – die vollständige Zeilenmenge ist für die Berechnung nicht
  semantisch notwendig; bewiesen ist nur, dass der bestehende Code die Zählung
  in JavaScript durchführt. Ob eine `count`-Abfrage identische Anzeigewerte
  liefert (inklusive des heutigen 500er-Abschnitts), wurde nicht geprüft und
  gilt nicht als bewiesen.

## 6. Diagnosewerte

| Frage | Befund |
| --- | --- |
| Wo erzeugt | `getSnapshot`, Zeilen 497–498 |
| Wo gespeichert | nirgends – nur im Rückgabeobjekt (`snapshot.metrics`), keine Tabelle, kein Cache |
| Wo gelesen | `OrbDevPanel.tsx:107` |
| Wer verwendet | nur der eingeklappte Abschnitt „Testbereich (Experiment)" der ORB-Seite |
| nur Debug/Diagnose | **BEWIESEN** ja |
| für sichtbare Antwort erforderlich | nein |
| für autonome ORB-Entscheidung erforderlich | nein |
| persistent | nein, nur temporär |

→ Markierung: **potenziell optimierbar** (nicht entfernt, nicht verändert).

**WAHRSCHEINLICH** – derselbe Abschnitt zeigt auch `snapshot.style` und die
übrigen `metrics`-Werte. Ob der Abschnitt für Endnutzer sichtbar sein soll, ist
eine Produktentscheidung und wurde in P8 nicht bewertet (**UNBEKANNT**).

## 7. Tatsächliche DB-Kosten (Attrappe, kein Modellaufruf)

| Szenario | Gesamtoperationen der Momentaufnahme | davon Vorschlags-Abfragen | Zeilen Abfrage 1 | Zeilen Abfrage 2 | Dauer Momentaufnahme |
| --- | --- | --- | --- | --- | --- |
| leer | 9 | 2 | 0 | 0 | ~0,2–2,0 ms |
| 3 offene Vorschläge | 9 | 2 | 3 | 0 | ~0,2 ms |
| 3 offen + 10 entschieden | 9 | 2 | 13 | 10 | ~0,3 ms |
| 3 offen + 500 entschieden | 9 | 2 | 20 | 500 | ~3,1 ms |
| 3 offen + 2000 entschieden | 9 | 2 | 20 | 500 (Plateau) | ~3,1 ms |

- Anteil an der Momentaufnahme: 2 von 9–10 Operationen (**ca. 20 %**).
- Anteil an einem vollständigen normalen Zug (24 tatsächliche Operationen laut
  P7): 2 von 24 (**ca. 8 %**).
- Die Operationszahl ist mengenunabhängig konstant; nur die Zeilenmenge von
  Abfrage 2 wächst (bis 500).
- Ausführungszeiten stammen aus der Attrappe und enthalten keine echte
  Netz-/DB-Latenz (**UNBEKANNT** für die Produktion).

## 8. Consumer (Zusammenfassung)

| Abfrage | Consumer | Art |
| --- | --- | --- |
| 1 – Vorschlagsliste | `OrbSuggestions` (sichtbare Vorschlagsleiste) | operativ/sichtbar |
| 2 – Statuszählung | `OrbDevPanel`, eine Kachel | Diagnose |

Keine weiteren Consumer im gesamten `src`-Baum.

## 9. Klassifikation

| Abfrage | Kategorie | Begründung |
| --- | --- | --- |
| 1 – Vorschlagsliste (limit 20 + Join `posts`) | **A) NOTWENDIG** | Ergebnis ist die sichtbare Vorschlagsleiste; ohne sie fehlt eine Benutzerfunktion |
| 2 – Statuszählung (limit 500) | **C) NUR DIAGNOSE** | Ergebnis fliesst ausschliesslich in zwei Zahlen eines Diagnoseabschnitts; nachweislich keine Auswirkung auf Antwort, Memory, Graph, Threads, Connections, Curiosity, Energy, autonome Fragen oder Status |

Kategorie B und D werden für diese zwei Abfragen nicht benötigt: der Datenfluss
beider Ergebnisse ist vollständig im Code nachvollziehbar.

## 10. Mögliche spätere Optimierungen (nur Hinweis, nicht freigegeben)

1. Abfrage 2 bei jedem Zug weglassen und nur beim Öffnen des Diagnoseabschnitts
   laden (Bedarfsabfrage). Erwartete Einsparung: 1 Read je Vorgang, dazu bis zu
   500 gelesene Zeilen.
2. Abfrage 2 durch eine Zählabfrage ersetzen (`count`), wenn die Anzeige einen
   abweichenden Wert oberhalb von 500 akzeptiert.
3. Abfrage 1 unverändert lassen (Kategorie A).

Beide Ansätze berühren die Anzeige und sind deshalb nicht Teil von P8.

## 11. Nicht bewiesene Hypothesen

- Dass eine Aggregation dieselben Anzeigewerte liefert (wegen des heutigen
  500er-Abschnitts): **WAHRSCHEINLICH**, nicht bewiesen.
- Dass der Diagnoseabschnitt für Endnutzer nicht benötigt wird: **UNBEKANNT**.
- Dass Abfrage 2 in der Produktion je nennenswerte Zeilenmengen liest:
  **UNBEKANNT** (heute 0 entschiedene Vorschläge).
- Ursache der P5/P7-Fälle mit 40/43 Abfragen: weiterhin **nicht eindeutig
  zuordenbar**; P8 hat dazu keine neuen Daten erhoben.

## 12. Tests

- Logiktests: 1371/1371 grün
- DB-/Sicherheitstests: 102/102 grün
- Typprüfung (`tsgo --noEmit`): fehlerfrei
- Lint: unverändert (nur bekannte Altlasten ausserhalb von `src/`)
- Build: erfolgreich
- Produktionscode: unverändert (keine Datei in `src/` berührt)

## 13. Kosten der Messung

- Messwerkzeug: temporäres Skript ausserhalb des Projekts (`/tmp/p8measure.ts`)
  über die bestehende Test-Attrappe; nach der Messung entfernt.
- Modellaufrufe: **0** (kein Pfad mit Sprachschicht ausgeführt).
- Produktive DB-Last: 2 lesende Aggregatabfragen auf `orb_suggestions`.
- Keine Schreibvorgänge, keine Migration, kein Deployment.

---

**STOPP** – P8 endet hier. Keine Optimierung, keine Codeänderung, keine weitere
Forensik ohne neue Freigabe.
