# Cognitive Globe: räumliche Layer-Korrektur

## Ziel
Den bestehenden Cognitive Globe so korrigieren, dass der unveränderte Memory Core innen bleibt und vorhandene Cognitive-Nodes im echten Desktop- und Mobile-Browser eindeutig auf getrennten äußeren Schalen sichtbar sind.

## Umsetzung
- Den tatsächlichen Memory-Core-Radius aus den vorhandenen Memory-Positionen bestimmen, statt den festen Layoutwert als Schalenbasis anzunehmen.
- Alle Cognitive-Radien aus diesem gemessenen Radius und einem proportional klar sichtbaren Abstand ableiten.
- Candidate-Nodes exakt entlang der Richtung ihres zugeordneten Memory-Nodes auf die Candidate-Schale setzen; Competition-, Snapshot-, Strategy-, Decision- und vorhandene Action-Nodes jeweils exakt auf ihre eigene Schale setzen.
- Cognitive-Nodes moderat vergrößern und belegte Schalen klarer von leeren Schalen unterscheiden, ohne die neutrale Semantik oder Retrieval-Farben zu ändern.
- Die Kamera anhand des äußersten belegten Cognitive-Radius und des aktuellen Seitenverhältnisses rahmen; Desktop und Mobile werden getrennt visuell geprüft. Zoom-Grenzen folgen dem berechneten Szenenradius.
- Layer-Fokus und „Alle“ erhalten; Fokus hebt die gewählte Schale, ihre Nodes und belegte angrenzende Beziehungen hervor, während der Memory Core sichtbar bleibt.

## Semantische Grenzen
- Keine Änderung an ORB Engine-Logik, Cognitive Observation/Phasen, Memory-Daten/Positionen/Verbindungen, Retrieval, Curiosity, Energy, Autonomy oder Datenbank.
- Keine neuen Datenquellen, Abfragen, Modellaufrufe oder Polling-Schleifen.
- Keine erfundenen Nodes, Beziehungen, Werte, Auswahl, Rangfolge oder Gewinner.

## Prüfung
- Neue Tests für gemessenen Memory-Radius, getrennte Radien, exakte Schalenpositionen, äußersten belegten Radius und Kamera-Framing ergänzen.
- Bestehende Globe- und Gesamttests, Typecheck, Lint und Build ausführen.
- Im echten Desktop- und Mobile-Browser prüfen, dass Memory Core und belegte Cognitive-Schichten klar getrennt erkennbar sind; bei „Nein“ weiter korrigieren.
- Abschlussbericht mit allen tatsächlichen Radien und klarem JA/NEIN; kein Deployment.
