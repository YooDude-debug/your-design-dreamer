# ORB CORE – P5 DB-FORENSIK

**Datum:** 2026-09-23
**Art:** READ-ONLY / Forensik. Keine Optimierung, keine Zusammenlegung, kein
Entfernen, kein Caching, kein Batching, keine Migration, kein Deployment.
**Referenzen:** `docs/ORB_P4_MEASUREMENT_RESULT_2026-09-23.md`,
`docs/ORB_P2_MODEL_REQUEST_FORENSIC_2026-09-23.md`,
`docs/ORB_REQUEST_OPTIMIZATION_P1_RESULT_2026-09-23.md`

**Am Produktionscode geändert:** nichts. Für die Messung wurde ein temporäres
Messwerkzeug benutzt (protokollierende Datenbank-Attrappe + Sprachschicht-Attrappe);
es wurde nach der Auswertung entfernt. **Kein echter Modellaufruf, keine Credits,
kein Zugriff auf die Produktionsdatenbank.**

Kategorien im gesamten Bericht:
**BEWIESEN** = durch Messung und Codepfad eindeutig belegt ·
**POTENZIELL** = technisch plausibel, nicht vollständig bewiesen ·
**UNBEKANNT** = Datenlage reicht nicht.

---

## 1. Untersuchungsumfang

Untersucht wurde jede einzelne Datenbankoperation eines
Verarbeitungsvorgangs **in ihrer tatsächlichen Reihenfolge**: Tabelle, Aktion
(Read/Write), Filter, Sortierung, Limit, auslösender Verarbeitungsschritt,
Abnehmer des Ergebnisses. Grundlage sind die Codepfade
`src/orb-core/engine.server.ts` (`processInput`, `getSnapshot`,
`retrieveCandidates`, `touchConnection`, `upsertInterest`, `recordFeedback`,
`askProactively`), `src/orb-core/continuity-store.server.ts` und
`src/orb-core/process.server.ts`.

**Wichtige Einordnung (BEWIESEN):** Der in der Produktion gespeicherte Wert
`orb_metrics.db_queries` zählt **nicht alle** Datenbankoperationen eines Vorgangs.
Gezählt wird nur, was über den internen Zähler läuft. **Nicht gezählt** werden
die Momentaufnahme am Ende des Vorgangs (`getSnapshot`) und alle Operationen
innerhalb von `recordFeedback`. Die echte Last liegt damit **über** den
bisher berichteten Zahlen.

| Pfad | gezählt (`db_queries`) | tatsächlich ausgeführt |
| --- | --- | --- |
| Nachricht, leeres Gedächtnis | 14 | **24** |
| Nachricht mit Erinnerungen | 17 | **28** |
| Nachricht, exakter Treffer | 22 | **33** |
| Korrekturfall („war ein Tippfehler") | 32 | **193** |
| autonome Frage (gestellt) | 10 | **21** |
| autonome Frage (still) | – | **7** |

## 2. Verwendete Events / Pfade

13 gemessene Pfade, alle über Attrappe:

| # | Pfad | Ergebnis | `db_queries` | Aufrufe total | Reads | Writes |
| --- | --- | --- | --- | --- | --- | --- |
| A | Nachricht, leeres Gedächtnis | answer | 14 | 24 | 20 | 4 |
| B | Nachricht, 12 Erinnerungen | answer | 17 | 28 | 21 | 7 |
| B2 | Nachricht, exakter Schlüsseltreffer | answer | 22 | 33 | 22 | 11 |
| C | Modellfehler HTTP 500 | remind | 22 | 33 | 21 | 12 |
| D | Guthabensperre HTTP 402 | remind | 22 | 33 | 21 | 12 |
| E | wenig Energie (0,05) | stay_silent | 22 | 33 | 21 | 12 |
| F | Antwort auf offene eigene Frage | answer | 23 | 34 | 23 | 11 |
| G | Aufforderung „frag mich" | answer | 19 | 30 | 23 | 7 |
| H | erkannte Handlungsabsicht | answer | 16 | 27 | 21 | 6 |
| I | ausdrückliche Korrektur | remind | 32 | **193** | 94 | 99 |
| J | grosses Gedächtnis (40/60/12) | remind | 28 | 39 | 21 | 18 |
| M | neue Erinnerung, grosses Gedächtnis | answer | 26 | 37 | 22 | 15 |
| K | autonome Frage gestellt | asked | 10 | 21 | 16 | 5 |
| L | autonome Frage, wenig Energie | silent | – | 7 | 7 | 0 |

**BEWIESEN:** Pfad A reproduziert exakt die in P4 gemessene Grundlast von
**14** Abfragen; die Produktionsspanne 11–43 wird durch die gemessenen Pfade
vollständig eingeschlossen.

## 3. Aufschlüsselung der Basis-DB-Last (Pfad A, 14 gezählte Abfragen)

| # | Abfrage | Schritt | liefert | Abnehmer | verwendet? | Lage zu Writes | schon geladen? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `orb_state` SELECT single | `ensureState` | Zustandszeile (Energie, Neugier, Ziele) | Entscheidung, Energiegate, Sprachkontext | ja | vor allen Writes | nein |
| 2 | `orb_nodes` SELECT `norm_key` limit 1 | Abruf, Schlüsseltreffer | exakte Erinnerung | Verstärkung statt Duplikat (`exact`) | ja | vor Writes | nein |
| 3 | `orb_nodes` SELECT `topic` limit 20 | Abruf, Themenkreis | Kandidaten | Relevanzranking | ja | vor Writes | nein |
| (3b) | `orb_nodes` SELECT `topic=intentTopic` limit 20 | Abruf, Informationsbereich der Frage | Kandidaten | Relevanzranking | ja | vor Writes | nein – nur wenn Intent-Thema ≠ Thema |
| 4 | `orb_nodes` SELECT nach `last_accessed_at` limit 10 | Abruf Ebene A | jüngster Kontext | Relevanzranking | ja | vor Writes | nein |
| 5 | `orb_nodes` SELECT `or(content.ilike …)` limit 20 | Abruf, Textsuche (max. 3 Wörter) | Kandidaten | Relevanzranking | ja | vor Writes | nein |
| 6 | `orb_connections` SELECT `or(source in … , target in …)` limit 60 | Kantenlast der Kandidaten | Gewichte | `bestWeight` → Relevanz | ja | vor Writes | nein – entfällt bei 0 Kandidaten |
| 7 | `orb_messages` SELECT (role, body) limit 8 | Gesprächsfenster | letzte 8 Nachrichten | Sprachkontext, Merk-Auflösung, Stil | ja | vor Writes | nein |
| 8 | `orb_interests` SELECT limit 8 | Interessenlage | Top-8 Interessen | Fadenrelevanz, Sprachkontext | ja | vor Writes | nein |
| 9 | `orb_threads` SELECT limit 12 | `loadThreads` | Anzeige-/Wiederaufnahmefäden | Wiederaufnahme, Pausieren, Auflösung | ja | vor Writes | nein |
| 10 | `orb_threads` SELECT `neq(status,RESOLVED)` limit 60 | `loadMatchCandidates` | Zuordnungskandidaten | `syncThreads` | ja | vor Writes | **andere Abfrage** (Filter + Limit) |
| 11 | `orb_style` SELECT single | `loadStyle` | Stilzählwerte | Stilhinweis, `recordStyle` | ja | vor Writes | nein |
| 12 | `orb_questions` SELECT offen, limit 1 | `findOpenQuestion` | offene eigene Frage | „ist das eine Antwort?" | ja | vor Writes | nein |
| 13 | `orb_style` UPDATE/INSERT | `recordStyle` | – | – | – | Write | – |
| 14 | `orb_state` UPDATE | Zustandsfortschreibung | – | – | – | Write | – |
| 15 | `orb_messages` INSERT (2 Zeilen) | Verlauf | – | – | – | Write, gebündelt | – |
| 16 | `orb_metrics` INSERT | Kennzahlen | – | – | – | Write | – |

**BEWIESEN:** Die Reads 1–12 liegen **alle vor dem ersten Write**; keiner von
ihnen wird im selben Vorgang wiederholt. Alle zwölf Ergebnisse haben einen
nachweisbaren Abnehmer. Die vier Writes sind fachlich verschieden
(Stil, Zustand, Verlauf, Kennzahl); der Verlauf wird bereits als **eine**
Anweisung mit zwei Zeilen geschrieben.

Zusatzlast oberhalb der Grundlast (BEWIESEN, jeweils gezählt):
Reaktivierung je abgerufener Erinnerung = 1 UPDATE (max. 6);
Verbindung je abgerufener Erinnerung = 1 Read + 1 Write, bei neu eingefügtem
Fokusknoten nur 1 Write (P1); Interessen = 1 Read + 1 Write;
Fadenzuordnung = 1 Write; Pausieren = 1 Write je überalterter Faden (bis 12);
Wiederaufnahme, Fadenauflösung, Widerspruch = je 1 Write.

## 4. Analyse der 9er-Momentaufnahme

Sie stammt aus `getSnapshot(db, userId, perf)` am Ende von `processInput`
(Zeile 1690) und besteht **BEWIESEN** aus 9 Reads + bis zu 1 Write:

| # | Abfrage | Zweck | verwendet? |
| --- | --- | --- | --- |
| 1 | `orb_state` SELECT single | Zustand **nach** dem Zug | ja (Oberfläche, Gesicht) |
| 2 | `orb_nodes` SELECT limit 40 | Graphknoten | ja (Spiderweb, Knotenzahl) |
| 3 | `orb_connections` SELECT limit 40 | Kanten + Verfallsrechnung | ja (Spiderweb, stark/schwach) |
| 4 | `orb_messages` SELECT limit 40 | Verlauf der Oberfläche | ja (Chatliste) |
| 5 | `orb_interests` SELECT limit 20 | Interessenanzeige | ja |
| 6 | `orb_suggestions` SELECT limit 20 (+ `posts(title)`) | Vorschlagsliste | ja |
| 7 | `orb_suggestions` SELECT `status` limit 500 | Zähler angenommen/abgelehnt | ja (2 Kennzahlen) |
| 8 | `orb_threads` SELECT limit 12 | Fadenanzeige | ja |
| 9 | `orb_style` SELECT single | Stilanzeige | ja |
| W | `orb_state` UPDATE (`decay_computations`, `energy`) | Verfallszähler | – (nur wenn Kanten vorhanden) |

**BEWIESEN:** Jede der 9 Abfragen hat einen Abnehmer im zurückgegebenen
Snapshot-Objekt. Die Abfragen 1, 4, 5, 8, 9 wirken wie Wiederholungen der
Grundlast (1, 7, 8, 9, 11), sind es aber **nicht**: dazwischen liegen Writes
auf genau diese Tabellen (Zustand, Verlauf, Interessen, Fäden, Stil), und die
Limits unterscheiden sich (40 statt 8, 20 statt 8). Muster **READ → WRITE →
READ** – nach Prüfkriterium C nicht redundant.

**POTENZIELL (einzige nachweisbare Überschneidung):** Abfragen 6 und 7 lesen
**dieselbe Tabelle im selben Verarbeitungskontext ohne dazwischenliegenden
Write**; 7 liefert nur die Spalte `status` von bis zu 500 Zeilen für zwei
Zähler. Ein einziger Read kann die Zähler technisch nicht ersetzen, weil
Abfrage 6 auf 20 Zeilen nach Relevanz begrenzt ist – eine Zusammenlegung
verlangt eine andere Zählweise und ist damit **kein risikofreier Umbau**.
Nicht umgesetzt.

**POTENZIELL:** Der Snapshot wird bei jedem Zug vollständig neu geladen,
obwohl der Browser die vorigen Werte bereits besitzt. Ob die Oberfläche alle
neun Blöcke nach jedem Zug braucht, ist aus dem Servercode **nicht** beweisbar
(die Entscheidung liegt in den Oberflächenkomponenten). Nicht bewertet.

## 5. Analyse der 40/43-Query-Ausreisser

**BEWIESEN:** Die Ausreisser entstehen **nicht** durch eine zusätzliche
Komponente, sondern durch mengenabhängige Schleifen desselben Pfads
`turn_reply`. Gemessen wurden die Steigerungstreiber einzeln:

| Treiber | Zusatz je Einheit | gemessene Obergrenze | Beleg |
| --- | --- | --- | --- |
| abgerufene Erinnerungen reaktivieren | 1 Write | 6 (Pfad C/E/J) | Pfad J, Aufrufe 12–17 |
| Verbindungen zum Fokusknoten | 1 Write (neuer Knoten) bzw. 1 Read + 1 Write | 6 | Pfad B2/F |
| überalterte Fäden pausieren | 1 Write je Faden | 7 (Pfad J/M, 12 geladene Fäden) | Pfad M, Aufrufe 17–23 |
| Interessen fortschreiben | 1 Read + 1 Write | 2 | Pfad B2/M |
| neuer Faden | 1 Write | 1 | Pfad M |
| Antwort auf eigene Frage | 1 Write + Verbindung + Interessen | 4 | Pfad F |

Grundlast 14 + diese Treiber ergibt gemessen bis **32** (Pfad I) bzw. **28**
(Pfad J) im Zähler. Ein Zug mit gleichzeitig 6 Reaktivierungen, neuem Knoten,
6 neuen Verbindungen, Interessen und 12 pausierten Fäden liegt rechnerisch bei
**≈ 40–43** – also genau in der beobachteten Grössenordnung.

**BEWERTUNG:** Der Mechanismus ist damit **WAHRSCHEINLICH** geklärt, die
einzelnen Produktionsfälle mit 40 bzw. 43 bleiben aber **nicht eindeutig
zuordenbar**: `orb_metrics` speichert nur die Gesamtzahl, keine
Aufschlüsselung je Abfrage. Es wurde nichts nachträglich zugeordnet.

**BEWIESEN und bisher unberichtet – der eigentliche Ausreisser:** Im
Korrekturpfad („… war ein Tippfehler") ruft `processInput` für **jede**
betroffene abgerufene Erinnerung `recordFeedback` auf. `recordFeedback`
endet mit einer **vollständigen eigenen Momentaufnahme** (`getSnapshot`,
9 Reads + 1 Write), deren Rückgabewert von `processInput` **verworfen** wird.
Gemessen: 6 Rückmeldungen → **193** Datenbankoperationen insgesamt, während
`db_queries` nur **32** meldet. In der Produktion erscheint dieser Fall
deshalb **nicht** als Ausreisser, obwohl er die grösste gemessene Last hat.

## 6. Vergleich der Verarbeitungspfade

| Pfad | Reads | Writes | Besonderheit gegenüber A |
| --- | --- | --- | --- |
| A normale Nachricht (leer) | 20 | 4 | Grundlast; keine Kantenabfrage (0 Kandidaten) |
| B mit Erinnerungen | 21 | 7 | + Kantenabfrage, + 1 Reaktivierung, + Fadenzuordnung, + Interessen |
| B2 exakter Treffer | 22 | 11 | + Knoten-Write, + neue Verbindung, + neuer Faden |
| C Modellfehler 500 | 21 | 12 | **identische DB-Last wie E**; Fehler ändert nur den Antworttext |
| D Guthabensperre 402 | 21 | 12 | identisch zu C – kein Wiederholversuch, keine Zusatzabfrage |
| E wenig Energie | 21 | 12 | identisch zu C/D; Gedächtnisarbeit läuft vollständig weiter |
| F Antwort auf eigene Frage | 23 | 11 | + `orb_questions` UPDATE, + Verbindung Frage→Antwort, + Interessen |
| G „frag mich" | 23 | 7 | + 3 Reads des Neugierkontexts (Knoten 12, Fragen 30, Kanten 60), Zustand/Verlauf/Interessen/Fäden **nicht** erneut geladen (P0-2) |
| H Handlungsabsicht | 21 | 6 | Prozesskontext wird nur bei erkannter Absicht geladen; im Messfall kein Treffer |
| I Korrektur | 94 | 99 | 6 × vollständige Momentaufnahme aus `recordFeedback` (Ergebnis verworfen) |
| J/M grosses Gedächtnis | 21/22 | 18/15 | mengenabhängige Schleifen (Reaktivierung, Pausieren) |
| K autonome Frage | 16 | 5 | eigener, schlanker Pfad: 7 Reads bis zur Entscheidung |
| L autonome Frage, still | 7 | 0 | **0 Writes, 0 Modellaufrufe** – Gate vor Formulierung (bestätigt P4) |

RPC/Datenbankfunktionen: **0** in allen Pfaden (BEWIESEN) – ORB arbeitet
ausschliesslich über Tabellenzugriffe.

## 7. Identifizierte redundante Reads (BEWIESEN)

1. **`getSnapshot` in `recordFeedback`, aufgerufen aus dem Korrekturpfad.**
   Alle Kriterien erfüllt: gleiche Daten, gleicher Verarbeitungskontext,
   Ergebnis wird **nachweislich nicht verwendet** (Rückgabewert verworfen),
   und der Aufruf wiederholt sich je betroffener Erinnerung.
   Gemessene Last: 10 Operationen je Rückmeldung, im Messfall 60 von 193.
   *Nur festgestellt – nicht geändert.*

Weitere eindeutig redundante Reads wurden **nicht** gefunden. Insbesondere
nicht: doppelte Kandidatenabfragen, doppelte Zustandslesung, doppelte
Fadenlesung (unterschiedliche Filter/Limits), doppelte Stillesung
(dazwischen Write).

## 8. Nur potenziell redundante Reads (POTENZIELL)

| Fall | Beobachtung | offene Voraussetzung |
| --- | --- | --- |
| `orb_suggestions` zweimal in der Momentaufnahme | gleiche Tabelle, kein Write dazwischen, verschiedene Spalten/Limits (20 nach Relevanz vs. 500 nur `status`) | Zusammenlegung ändert die Zählbasis der beiden Kennzahlen |
| Vollständige Momentaufnahme nach jedem Zug | 9 Reads, die die Oberfläche teils schon besitzt | Bedarf der Oberfläche ist serverseitig nicht beweisbar |
| Kandidatenabfragen 2–5 auf `orb_nodes` | vier getrennte, verschieden gefilterte Reads derselben Tabelle | eine gemeinsame Abfrage hätte andere Sortier-/Limitsemantik → anderes Abrufergebnis (Verhaltensänderung) |
| `orb_messages` 8 (Kontext) vs. 40 (Anzeige) | dieselbe Tabelle, dazwischen Insert | ohne Verhaltensänderung nur zusammenlegbar, wenn die Anzeige den neuen Verlauf nicht bräuchte |

## 9. Queries, die nachweislich notwendig erscheinen (BEWIESEN)

Alle 12 Reads der Grundlast (Abschnitt 3) und alle 9 Reads der Momentaufnahme
(Abschnitt 4) haben einen nachweisbaren Abnehmer; kein Ergebnis bleibt
ungenutzt. Die vier Grundlast-Writes sind fachlich verschieden und nicht
weiter bündelbar, ohne die Reihenfolge Eingabe → Antwort oder die Kennzahlen
zu verändern. Der Verlauf ist bereits gebündelt (ein Insert, zwei Zeilen).

## 10. Offene bzw. nicht beweisbare Punkte

- **UNBEKANNT:** Zuordnung der konkreten Produktionsfälle mit 40 bzw. 43
  Abfragen zu einzelnen Abfragen – `orb_metrics` speichert keine
  Aufschlüsselung. Mechanismus wahrscheinlich (Abschnitt 5), Einzelfall nicht.
- **UNBEKANNT:** tatsächlicher Anzeigebedarf der Oberfläche nach einem Zug.
- **UNBEKANNT:** Häufigkeit des Korrekturpfads in der Produktion; er ist in
  `orb_metrics` nicht als eigene Art erkennbar.
- **UNBEKANNT:** Zeitraum der Lovable-Verbrauchsanzeige (gilt seit P2 fort).
- Nicht gemessen: Sprach-, Bild- und Moderationspfade, `analysis`
  (in P4 mit konstant 3 Abfragen gemessen), Feed-Beobachtung.
- Die **134** historisch nicht zuordenbaren Modellaufrufe bleiben unverändert
  **nicht** zuordenbar und wurden nicht angetastet.

## 11. Mögliche Optimierungsstellen (nur benannt, nichts umgesetzt)

| # | Stelle | Beweisgrad | Wirkung | Risiko für ORB-Verhalten |
| --- | --- | --- | --- | --- |
| 1 | Momentaufnahme in `recordFeedback` beim Korrekturpfad (Ergebnis wird verworfen) | **BEWIESEN** | −10 Operationen je betroffener Erinnerung | gering – Rückgabewert wird nicht benutzt; Gedächtnis-, Gewichts- und Interessenlogik bleibt unberührt |
| 2 | Zwei `orb_suggestions`-Reads der Momentaufnahme | POTENZIELL | −1 Read je Zug | mittel – Kennzahlbasis ändert sich |
| 3 | Umfang der Momentaufnahme nach dem Zug | POTENZIELL | bis −9 Reads je Zug | hoch – Oberflächenverhalten, nicht serverseitig entscheidbar |
| 4 | `db_queries` misst nur einen Teil der Last | BEWIESEN (Messfehler, keine Optimierung) | bessere Messbarkeit | keins – reine Zählung |

## 12. Erwartbares Einsparpotenzial (nur, soweit messbar ableitbar)

| Pfad | heute gemessen | nach Punkt 1 (rechnerisch) | Grundlage |
| --- | --- | --- | --- |
| Korrekturfall mit 6 Rückmeldungen | 193 Operationen | **133** | 6 × 10 entfallende Operationen, gemessen |
| normale Nachricht | 24 Operationen | 24 (unverändert) | Punkt 1 greift nur im Korrekturpfad |
| Punkt 2 | 24 | 23 | eine Abfrage weniger |

Für Punkt 3 wird **kein** Wert angegeben – die Notwendigkeit ist nicht
bewiesen. Eine Hochrechnung auf Credits erfolgt nicht (Zeitraum der
Verbrauchsanzeige weiterhin unbekannt).

## 13. Teststatus

| Prüfung | Ergebnis |
| --- | --- |
| Logiktests (`bunx vitest run`) | 1371 / 1371 grün |
| Datenbank-/Sicherheitstests (`bun run test:db`) | 102 / 102 grün |
| Typprüfung (`tsgo --noEmit`) | fehlerfrei |
| Lint | unverändert (nur die bekannten Altlasten in `backups/`, `release/`, `remotion/` u. a.) |
| Build | erfolgreich |

Keine Regression. Am Produktionscode wurde in P5 nichts verändert; das
Messwerkzeug wurde nach der Auswertung entfernt.

## 14. Klare Empfehlung für das weitere Vorgehen

1. **P6-Kandidat mit der besten Beweislage:** Punkt 1 (verworfene
   Momentaufnahme im Korrekturpfad). Bewiesen, mengenabhängig, ohne Einfluss
   auf Gedächtnis, Graph, Neugier, Energie, Fäden, Stille oder Modellaufrufe.
2. **Zweiter Schritt, nur Messbarkeit:** die Zählung so ergänzen, dass
   `db_queries` die tatsächliche Last eines Vorgangs abbildet (heute fehlen
   Momentaufnahme und Rückmeldepfad). Ohne diese Korrektur bewertet jede
   künftige Vorher-/Nachher-Messung zu niedrig.
3. **Zurückstellen:** Punkte 2 und 3 – sie verlangen eine Entscheidung über
   Kennzahlen bzw. Oberflächenbedarf und sind kein risikofreier Umbau.
4. **Unverändert lassen:** Kandidatenabfragen, Fadenabfragen,
   Energie-Gate-Reihenfolge, stille Züge, Modellaufrufe.

**STOPP.** Keine Optimierung, keine Migration, kein Deployment, keine
ChatBridge, keine Änderung an ORB Core. P6 nur nach ausdrücklicher Freigabe.
