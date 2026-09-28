# Cognitive Globe – visuelle Layer-Korrektur

## Ziel
Die vorhandene kompakte Cognitive Observation wird als echte, räumlich geschichtete 3D-Struktur dargestellt. Der bestehende Memory Core, seine Positionen, Verbindungen, Abfrage und Retrieval-Semantik bleiben unverändert.

## Umsetzung

1. **Darstellungsmodell testbar machen**
   - In der bestehenden Cognitive-Globe-Darstellung eine reine Layout-Beschreibung für Nodes und nachweisbare Verbindungen erzeugen.
   - Jeder Eintrag behält Layer, Identität, Zustand und Datenherkunft; `maximumOverlap` und Coverage werden unverändert weitergereicht.
   - Keine Zufallspositionen: Candidate-Positionen werden radial aus der Position ihrer eindeutig zugeordneten Memory-ID abgeleitet.

2. **Sichtbare Nodes auf den Schalen**
   - **Memory:** unveränderte bestehende Instanzen, keine Duplikate.
   - **Factors:** nur Nodes für tatsächlich vorhandene Faktoren; derzeit bei null/false leer.
   - **Candidates:** ein Node je Candidate mit bekannter Memory-Zuordnung.
   - **Competition:** je belegtem Paar zwei relationale Endpunkte auf der Competition-Schale plus Verbindung; Intensität ausschließlich aus `maximumOverlap`, null bleibt sichtbar unknown.
   - **Snapshot:** die sieben vorgesehenen Bereiche als gleich große Nodes; vorhanden und nicht vorhanden klar neutral unterscheiden.
   - **Strategy:** alle acht gelieferten Strategy-Einträge gleich groß; `available`/`unavailable` visuell unterscheiden, ohne Auswahl oder Rangfolge.
   - **Decision:** sieben gleich große Coverage-Nodes; echte Coverage und `unknown` unterscheiden, Bezeichnung bleibt Coverage.
   - **Action:** nur vorhandene Action-Pläne; aktuell leer.
   - **Outcome / Adaptation:** nur Schalen, solange null.
   - Instanz-Matrizen und -Farben nach Aufbau explizit für die GPU aktualisieren, damit die Nodes im echten Browser sichtbar sind.

3. **Nur belegte Beziehungen verbinden**
   - Memory → Candidate nur bei exakter Memory-ID-Zuordnung.
   - Candidate → Competition nur für die beiden IDs eines vorhandenen Competition-Paars.
   - Competition → Snapshot nur zu den belegten Snapshot-Bereichen `candidates` und `competitions`.
   - Snapshot → Strategy nur für vorhandene Strategy-Einträge als gemeinsame beobachtete Snapshot-Grundlage; keine Strategie wird ausgewählt oder bevorzugt.
   - Strategy → Decision nur typgleich, wenn derselbe Strategy-Typ in der vorhandenen Decision-Grundlage nachweisbar ist. Falls diese Zuordnung in der kompakten Payload nicht enthalten ist, wird keine solche Kante erfunden.
   - Keine Kanten zu leeren Action-, Outcome- oder Adaptation-Layern.

4. **Retrieval und Layer-Steuerung**
   - Der rote Puls bleibt ausschließlich auf echten Retrieval-Memory-IDs.
   - Nur die bereits belegte Memory→Candidate-Verbindung wird bei aktivem Retrieval neutral hervorgehoben; keine rote Semantik auf Cognitive-Layern.
   - Beim Ebenenfokus bleiben fokussierte Schale, Nodes und angrenzende belegte Verbindungen hervorgehoben; andere sichtbare Ebenen werden zurückgenommen statt die Memory-Daten umzubauen.
   - Ein-/Ausblenden und „Alle“ bleiben erhalten.

5. **Tests und Prüfung**
   - Neue Tests für Layer-Nodezahlen, radiale Candidate-Zuordnung, belegte Verbindungen, leere Layer, unverändertes `maximumOverlap`, Coverage/unknown, fehlendes Ranking und Retrieval-Grenzen.
   - Quellgrenzen absichern: keine neue Datenbankabfrage, kein Modellaufruf, keine Polling-Schleife und keine Änderung an ORB Engine, Cognitive-Phasen, Observation, Retrieval oder Memory-Graph.
   - Vollständige Testsuite, Typecheck, Lint und Build ausführen.
   - Danach den 3D-Globe im echten Browser auf Desktop und Mobile prüfen: sichtbare Nodes, räumliche Trennung, Fokus, Ein-/Ausblenden und fehlerfreie Konsole.

## Voraussichtlich geänderte Dateien
- `src/lib/orb-knowledge-graph/cognitive-layer-scene.ts`
- `src/lib/orb-knowledge-graph/graph-engine.ts` nur soweit für Fokus/Verbindungsdarstellung nötig
- `tests/orb-cognitive-globe.test.ts`
- gegebenenfalls eine neue reine Layout-Testdatei unter `tests/`

## Unverändert
ORB Engine, Cognitive Phasen 1–16, Cognitive Observation, Retrieval-Erzeugung, Memory-Daten/Positionierung/Connections, Curiosity, Energy, Autonomy und Datenbank.

## Abschluss
Bericht A–L mit Dateien, dargestellten und leeren Layern, belegten Verbindungen, Performance, zusätzlichen DB-/Modellaufrufen sowie Test-, Typecheck-, Lint- und Build-Ergebnis. Kein Deployment; STOP nach dem Build.
