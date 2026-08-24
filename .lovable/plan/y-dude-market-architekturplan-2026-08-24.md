# Y-Dude Market – Architekturplan

## Ausgangslage (analysiert)

- Einen Market-Tab oder eine Coming-Soon-Karte gibt es im aktuellen Code **nicht** – Market wird komplett neu angelegt (Navigation heute: Feed `/dev`, Channels, Arena, Globe, Creator, Profil).
- Wiederverwendbar und **unverändert** bleibend:
  - Auth/Rechte: `_authenticated`-Layout, `requireSupabaseAuth`, RLS + GRANT-Muster.
  - Bilder: `uploadPostImage`, `signPaths`, Varianten-Kette (`__t`/`__m`) aus `src/lib/media.ts` inkl. Backstop.
  - SlangTags: `slang_tags`, `SlangTagChip`, `SlangTagRecorderPanel`, Audio-Transkript-Pipeline.
  - Messenger: `conversations`/`messages`, `openDirectChat`, Push-Bündelung.
  - Channels: `channels`, `channel_categories`, `searchChannels`.
  - Standort: `profiles.location` + `locationVisibility`, `src/lib/geo.ts`.
  - Moderation: `reports`, `content_moderation_log`, Admin-Cockpit.
- Kein Konflikt oder Inkompatibilität erkannt; Market lässt sich additiv einhängen.

## Datenmodell (neue Tabellen, alle mit GRANT + RLS)

- `market_categories` (Baum via `parent_id`, Slug, i18n-Namen, `sort`, `active`) – administrativ pflegbar, nie hardcodiert.
- `market_items` – Verkäufer, Titel, Beschreibung, Preis (Cent), Währung, Kategorie, Zustand (Enum), Versand/Abholung (Enum), Status-Enum (`active|reserved|sold|disabled|deleted`), PLZ/Ort, gerundete `lat/lon` (~1 km Raster, nie exakte Adresse), `search_tsv`, Zähler.
- `market_images` – `item_id`, `path`, `sort`, `is_primary`.
- `market_item_slang_tags` / `market_item_channels` – reine Verknüpfungstabellen zu bestehenden `slang_tags` / `channels`.
- `market_favorites`, `market_offers` (Preisangebot mit Status `open|accepted|declined|withdrawn`, referenziert `conversations`), `market_searches` (gespeicherte Suchaufträge).
- Indizes: GIN auf `search_tsv`, Composite auf `(status, created_at, id)` (Keyset-Pagination), `(category_id, status)`, `(lat, lon)` für Bounding-Box-Vorfilter + Haversine-Feinsortierung.
- Attribute (Marke, Größe, Farbe …) als `attributes jsonb` – keine Schemaänderung pro Kategorie.

## Server-Schicht

Neu: `src/lib/market.functions.ts` (+ `market.server.ts`, `market.shared.ts`), Muster wie `channels.functions.ts`:
`listMarketHome`, `searchMarketItems` (Keyset, 20er-Seiten), `getMarketItem`, `createMarketItem`, `updateMarketItem`, `setMarketItemStatus`, `deleteMarketItem`, `toggleMarketFavorite`, `listMyMarketItems`, `suggestChannelsForItem`, `createMarketOffer`, `respondMarketOffer`, `parseMarketQuery`, `saveMarketSearch`.
Rechte immer serverseitig (Owner-Check + RLS), Uploads über bestehende Bildpipeline validiert.

## Suche

- Basis: Postgres-Volltext (`search_tsv`) + Filter (Kategorie, Preis von/bis, Radius, Zustand, Versand/Abholung) + Sortierung (Relevanz, neu, Preis auf/ab, Entfernung).
- Freitext-/Sprachsuche: `parseMarketQuery` extrahiert regelbasiert Produkt, Preisgrenze, Zoll/Größe, Ort, Radius; Spracheingabe nutzt die bestehende Transkriptions-Pipeline. Kein neues KI-System.
- Ergebnisse gruppiert: Market-Artikel, passende Channels, passende SlangTags – über bestehende Suchfunktionen aufgerufen, nicht neu gebaut.
- Ranking als eine `scoreItem`-Funktion in `market.shared.ts` (Text-Match, Kategorie, Entfernung, SlangTag-Treffer, Frische) – später erweiterbar.

## UI (Mobile First, bestehendes Dark/Grün-Theme, bestehende UI-Komponenten)

Neue Routen unter `src/routes/_authenticated/`:
`market.index.tsx` (Home: Header „Y-Dude Market / Buy. Sell. Speak Local.“, Suchfeld mit Mikrofon, Kategorie-Chips, Nähe-Karten), `market.search.tsx`, `market.$itemId.tsx`, `market.new.tsx`, `market.mine.tsx` (Meine Artikel / Favoriten / Suchaufträge / Angebote).
Komponenten in `src/components/market/`: `MarketItemCard`, `MarketFilterSheet`, `MarketImageManager` (Mehrfach-Upload, Hauptbild, Reihenfolge, Löschen), `MarketItemForm`, `MarketVoiceDescribe`, `MarketOfferBubble`, `MarketMatchStrip`.
Navigation: Market wird als zusätzlicher Eintrag in die bestehende Navigation aufgenommen – keine neue Hauptnavigation.

## Integrationen

- **Messenger**: „💬 Verkäufer anschreiben“ nutzt `openDirectChat` und sendet eine Kontextnachricht mit Artikelbezug (`messages.market_item_id`, additive Spalte). SlangTag-Verhandlung nutzt die vorhandenen Chat-SlangTags; optional strukturiertes Angebot über `market_offers`, gerendert als Angebots-Bubble.
- **Channels**: Artikelanlage schlägt passende Channels vor (`suggestChannelsForItem`, Auswahl durch Verkäufer, Limit gegen Spam). Channel-Detail erhält einen zusätzlichen Market-Tab; unter suchähnlichen Channel-Beiträgen erscheint ein „🛒 Passende Market-Angebote“-Streifen.
- **Moderation**: `⋯ → Melden` nutzt `ReportDialog`/`reports` mit neuem Zieltyp `market_item`; Admin-Cockpit erhält eine Market-Liste.
- **Benachrichtigungen**: gespeicherte Suchen und Favoriten-Events laufen über `notifications`/Push-Bündelung – nur wenn sie ohne Umbau passen (Phase 3).

## Umsetzungsreihenfolge

1. **Phase 1** – Migration (Kategorien + Artikel + Bilder), Server-Funktionen, Market Home, Kategorien, Artikel erstellen inkl. Bilder & Standort, Detailseite, Suche + Basisfilter, Status.
2. **Phase 2** – Messenger-Verknüpfung mit Artikelkontext, SlangTags am Artikel, Preisverhandlung/Angebote, Favoriten, Channel-Verknüpfung.
3. **Phase 3** – Query-Parsing/Sprachsuche, Channel↔Market-Matching, gespeicherte Suchen + Benachrichtigungen, ähnliche Artikel.
4. **Phase 4** – nur Vorbereitung: Felder für Hervorhebung/Premium (`promoted_until`), keine Bezahllogik.

## Performance & Sicherheit

Keyset-Pagination (20), Lazy Loading, Bildvarianten statt Originale, Bounding-Box vor Distanzrechnung, gerundete Koordinaten, Owner-scoped RLS für Bearbeiten/Löschen, Angebotsstatus nur durch berechtigte Seite änderbar, Standort nie exakt öffentlich.

## Abschluss

Nach jeder Phase: Build, Lint, Playwright-Test (Mobile-Viewport) für Anlegen/Suche/Detail/Chat, Regressionstest von Feed, Channels, Arena, Messenger. Zum Schluss Vorher/Nachher-Bericht (neu, geändert, wiederverwendet, Risiken, fertig vs. vorbereitet).

## Rückfrage zum Umfang

Der Gesamtumfang ist sehr groß. Vorschlag: In diesem Durchgang **Phase 1 vollständig** liefern (Datenmodell, Server-Funktionen, Home, Kategorien, Anlegen mit Bildern, Detailseite, Suche/Filter, Status) und Phase 2–4 in Folgeschritten – so bleibt jede Stufe testbar.
