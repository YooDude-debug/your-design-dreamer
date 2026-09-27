# ORB Chat: Live-Text und Auto-Follow

## Umsetzung
- Nur `OrbChat` und zugehörige UI-Regressionstests ändern; ORB Core, Server, Daten und Persistenz bleiben unberührt.
- Neue ORB-Antworten aus dem vorhandenen vollständigen Nachrichtentext in kleinen Wort-/Whitespace-Blöcken sichtbar aufbauen.
- Bereits vollständig dargestellte und bestehende Nachrichten unverändert lassen; der finale sichtbare Text entspricht exakt dem gelieferten Output.
- Den vorhandenen internen Chat-Scrollbereich erweitern: neue Antworten starten am Ende, während des Aufbaus folgt er nur bei aktivem Bottom-Follow.
- Manuelles Hochscrollen deaktiviert Follow sofort; Rückkehr in den bestehenden 80-Pixel-Endbereich aktiviert es wieder.
- Scrollbewegungen begrenzen und bündeln, statt bei jedem React-Render aggressiv zu scrollen; Seiten-Viewport und Eingabefokus bleiben unbeeinflusst.
- Laufende Timer und geplante Frames bei Antwortwechsel oder Entfernen der Ansicht sauber beenden.

## Tests und Prüfung
- Kurze, lange und den sichtbaren Bereich überschreitende Antworten.
- Follow unten, manuelles Hochscrollen, erneutes Aktivieren am Ende und mehrere Antworten nacheinander.
- Exakte Endausgabe sowie unveränderte bestehende Nachrichten.
- Bestehende Scroll-, Composer- und ORB-Tests ausführen.
- Vollständige Tests, Typecheck, Lint und Build ausführen.
- Kein Deployment.

## Technische Grenze
Der Effekt ist ausschließlich lokales Rendering des bereits empfangenen Textes. Es entstehen keine zusätzlichen Modellaufrufe, Datenbankabfragen oder Speicherungen.
