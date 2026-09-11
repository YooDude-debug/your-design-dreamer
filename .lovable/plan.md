# Marketplace-UX-Fix aus Staging übernehmen und veröffentlichen

## Ziel
Den geprüften Staging-Stand `ba9da751` ausschließlich für drei Marketplace-UX-Änderungen auf die aktuelle Production-Basis übertragen. Rollback-Punkt ist Production-Commit `00186875f5e9e78b2cc74cc9417761155bc8cd51`.

## Änderungen
1. **QuickBar (`src/components/QuickBar.tsx`)**
   - Am bestehenden Market-Link ausschließlich `preload="intent"` ergänzen.
   - Dadurch wird bei Hover oder Antippen nur das Market-Seitenmodul vorgeladen; keine Marketplace-Daten werden vorab abgefragt.

2. **Marktseite (`src/routes/_authenticated/market.index.tsx`)**
   - Die kleine Ladezeile samt Spinner durch das geprüfte Raster aus sechs Platzhalterkarten ersetzen.
   - Bestehende Spalten, Kartenform und Farben beibehalten.
   - In derselben bestehenden Ergebnisliste nur den ersten vier Karten `priority` übergeben.

3. **Artikelkarte (`src/components/market/MarketItemCard.tsx`)**
   - Den geprüften optionalen `priority`-Parameter ergänzen.
   - Bei den ersten vier Karten `loading="eager"` und `fetchPriority="high"`, ansonsten weiterhin `loading="lazy"` und normale Priorität verwenden.
   - Keine Änderungen an URLs, Signierung, Größen, Datenabfragen oder Marketplace-Funktionen.

## Verifikation vor Veröffentlichung
- Den finalen Diff auf genau diese drei Dateien und die freigegebenen Hunks begrenzen.
- Typecheck, gezielten Lint, relevante Marketplace-Tests, vollständige Tests und Build ausführen.
- Mit angemeldeter Testsitzung Desktop und Mobile prüfen: Feed/QuickBar → Market, erstes und erneutes Öffnen, Skeleton während verzögerter Antwort, Kartenraster sowie Bildattribute.
- Netzwerk prüfen: Hover/Touch darf nur das Seitenmodul laden und keine Marketplace-Datenabfrage auslösen; Navigation darf die bestehenden Datenabfragen nicht vermehren.
- Keine echte Registrierung, Transaktion oder schreibende Marketplace-Aktion ausführen.

## Veröffentlichung und Smoke-Test
- Nur bei bestandener Verifikation veröffentlichen.
- Anschließend Production einmal kontrolliert auf Desktop und Mobile prüfen: Einstieg, sichtbarer Ladeplatzhalter, Karten, Bildprioritäten, Lazy Loading, Navigation, Konsole und relevante Laufzeitfehler.
- Bei einer Regression auf den gesicherten Production-Commit zurückkehren; keine Datenbankmigration ist vorgesehen.
