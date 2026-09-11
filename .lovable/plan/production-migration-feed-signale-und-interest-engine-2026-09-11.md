# Production-Migration: Feed-Signale und Interest Engine

## Ziel
Den in Staging geprüften Feed-/Interest-Stand selektiv auf die aktuelle Production-Basis übertragen und anschließend veröffentlichen. Keine fachlichen oder visuellen Änderungen außerhalb dieses freigegebenen Umfangs.

## Umfang
- Den gemeinsamen Feed-Signalbus mit 2,5-Sekunden-Bündelung übernehmen.
- Die bestehenden Aktionen Like, Kommentar, Teilen, Merken, Folgen, Verweildauer, View Complete und Melden an diesen Signalbus anbinden.
- Die vorhandene Fast-Scroll-Auswertung unverändert belassen.
- Den bestehenden Server-Batchpfad so anbinden, dass Feed Learning und Interest Learning innerhalb desselben Serveraufrufs verarbeitet werden.
- Die geprüfte Feed-zu-Interest-Abbildung und die vorhandene Jugendschutzprüfung unverändert übernehmen.
- `docs/SIGNAL_CONTRACT.md` als reine Dokumentation übernehmen.
- Die zugehörigen geprüften Signal-Mapping-Tests übernehmen.

## Abgrenzung
- Keine Staging-UI-, Layout-, Rollen-, SlangTag- oder sonstigen Nebenänderungen übernehmen.
- Keine Änderungen an Ranking-Gewichten, Decay, Confidence, Lernraten oder Signalbedeutung.
- Keine negativen Interest-Signale, neue Kategorisierung, Idempotenz, Retry, Retention, Cache- oder Embedding-Arbeiten.
- Keine Testdaten übernehmen.

## Datenbank und Sicherheit
- Vor dem Code-Transfer Tabellen, Funktionen, Grants und Policies im Production-Kontext vollständig gegen den geprüften Stand vergleichen.
- Eine Datenbankmigration nur dann übernehmen, wenn sie im getesteten Staging-Stand für diesen Signalpfad vorhanden und in Production tatsächlich noch nicht wirksam ist.
- Nutzerzuordnung bleibt serverseitig über die authentifizierte Sitzung; bestehende Zugriffskontrollen und Jugendschutz bleiben unverändert.

## Verifikation
- Exakten Dateidiff prüfen und nur freigegebene Hunk-Änderungen übernehmen.
- Typecheck, gezielten Lint, Signal-/Ranking-/Interest-Tests, vollständige Tests und Build ausführen.
- Lokal Feed, Scrollen, Nachladen, Bilder, Ranking/Diversity/Exploration und UI-Regressionsfreiheit prüfen.
- Signalbus prüfen: ein gemeinsamer Batch, keine Einzelrequests pro Interaktion, keine doppelte Client-Erfassung.
- Nach Veröffentlichung Production-Smoke für Feed sowie kontrollierte Like-, Save-, Comment-, Share-, Follow-, View- und Dwell-Signale durchführen, ohne fremde Daten zu berühren.
- Interest-Verarbeitung, Confidence, serverseitige User-Zuordnung, Zugriffstrennung, Jugendschutz und nicht blockierendes Fehlerverhalten kontrollieren.

## Rollback
- Aktuellen Production-Commit als Rückkehrpunkt sichern.
- Da der erwartete Umfang additiv im Code ist, kann bei Problemen auf diesen Commit zurückveröffentlicht werden.
- Falls wider Erwarten eine getestete Datenbankmigration nötig ist, vor Anwendung deren vorhandenen Rollback-Pfad verifizieren; ohne reversiblen Pfad wird nicht migriert.

## Abschluss
Ein strukturierter Bericht nennt Migrationsergebnis, vollständige Dateiliste, Datenbankänderungen, Smoke-/Signal-/Interest-/Security-Ergebnisse, Regressionen und geprüften Rollback-Punkt. Danach keine weiteren Änderungen.
