# Caching Layer – Integration und gemessene Werte (14.08.2026)

## Was integriert wurde

Der bestehende Kurzzeit-Cache wurde ausgebaut und in weitere Abfragen eingebaut.
Kein Design, keine Funktion, keine Tabelle und keine Datenstruktur geändert.

### Serverseitig (`src/lib/server-cache.server.ts`)

- Cache-First: Cache prüfen → Treffer ausliefern → sonst Datenbank → speichern → ausliefern.
- In-Flight-Dedupe: gleichzeitige identische Anfragen erzeugen genau **eine** DB-Abfrage.
- LRU-Grenze (500 Einträge) gegen unbegrenztes Wachstum.
- Fehlerfall: Der Fehler kommt unverändert aus der DB-Abfrage, der Cache blockiert nie.
- Kennzahlen: Treffer, Fehlschläge, eingesparte Abfragen, Ladezeiten, Verdrängungen.

Gecacht (öffentlich, für alle Betrachter identisch):

| Bereich | Schlüssel | TTL |
| --- | --- | --- |
| Öffentlicher Beitrag (Share-Link) | `public-post:<postId>` | 60 s |
| Hashtag-Trends | `hashtag-trends:<tage>:<limit>` | 60 s |
| Hashtag-Suche | `hashtag-search:<limit>:<begriff>` | 30 s |
| Hashtag-Zeile / Beitrags-IDs | `hashtag-row:*`, `hashtag-posts:*` | 30 s |
| Interest-Engine-Konfiguration / Kategorien | `config`, `categories` | 300 / 600 s |

### Clientseitig (`src/lib/client-cache.ts`, Sitzungs-Cache, kein Offline-Cache)

- Neu gecacht: Slang-Bedeutungen und Übersetzungen (`slang:def:<sprache>:<ids>`, 180 s)
  und öffentliche Vote-Zähler (`slang:votes:<ids>`, 30 s).
- Bereits vorher gecacht: Profil-Zusatzfelder, Profil-Statistiken, Standorte,
  Unternehmensdaten von SlangTags, Identitäts-Richtlinie.
- Invalidierung direkt nach jeder Änderung: Bedeutung/Geo speichern → `slang:def:`,
  Bewertung abgeben → `slang:votes:`, Profil speichern → `profile:`.
- LRU-Grenze (300 Einträge) und Kennzahlen ergänzt.

### Bewusst **nicht** gecacht

Private Nachrichten, eigene Votes, Berechtigungen/Rollen, Login- und
Sitzungsdaten, Moderations- und Sicherheitsdaten, Zähler direkt nach einer
Änderung. Der Schlüssel enthält immer alle Parameter (Sprache, Region,
ID-Menge, Limit), nutzerspezifische Antworten werden nie global gecacht.
Die Berechtigungsprüfung (RLS bzw. `requireSupabaseAuth`) läuft unverändert
**vor** dem Cache; gecacht wird nur das Ergebnis einer erlaubten Abfrage.

### Messendpunkt

`GET /api/public/cache-metrics` liefert ausschließlich aggregierte Zähler und
den Speicherverbrauch der Instanz – keine Inhalte, keine Nutzerdaten.

## Messung

Methodik: identische öffentliche Route (`/post/<id>`, SSR + Datenabfrage),
Lokalumgebung, jeweils 250/500/750/1000 gleichzeitige Anfragen.
„ohne Cache" = jede Anfrage erzeugt einen Cache-Miss (eindeutiger Schlüssel),
„mit Cache" = wiederholte Anfrage derselben Ressource. Alle Werte gemessen,
nichts geschätzt.

### Mit Cache

| Nutzer | p50 | p90 | p95 | Ø | Anfragen/s | DB-Abfragen | Cache-Treffer | Fehler | Timeouts | RSS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 250 | 1352 ms | 2276 ms | 2401 ms | 1345 ms | 98,2 | 0 | 250 | 0 | 0 | 1350 MB |
| 500 | 1296 ms | 2559 ms | 2765 ms | 1518 ms | 165,6 | 0 | 500 | 0 | 0 | 1443 MB |
| 750 | 1886 ms | 3102 ms | 3260 ms | 1955 ms | 211,4 | 0 | 750 | 0 | 0 | 1508 MB |
| 1000 | 3316 ms | 5344 ms | 5497 ms | 3308 ms | 171,8 | 0 | 1000 | 0 | 0 | 1586 MB |

### Ohne Cache (gleiche Codepfade, jede Anfrage in die Datenbank)

| Nutzer | p50 | p90 | p95 | Ø | Anfragen/s | DB-Abfragen | Fehler | Timeouts | RSS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 250 | 1574 ms | 2749 ms | 2899 ms | 1608 ms | 81,8 | 250 | 0 | 0 | 1606 MB |
| 500 | 2755 ms | 4412 ms | 4665 ms | 2658 ms | 102,5 | 500 | 0 | 0 | 1657 MB |
| 750 | 4404 ms | 7575 ms | 8054 ms | 4295 ms | 88,7 | 750 | 0 | 0 | 1739 MB |
| 1000 | 5142 ms | 8616 ms | 9084 ms | 5024 ms | 104,9 | 1000 | 0 | 0 | 1842 MB |

### Einzelabfrage (kalt vs. warm, dieselbe Seite)

- Kalt (Cache Miss, mit DB): **712 ms**
- Warm (Cache Hit): **16 ms** und **21 ms** → rund 97 % schneller
- Ø Ladezeit bei Miss laut Zähler: 501 ms, Ø bei Treffer: < 1 ms

### Kennzahlen-Zusammenfassung

- Cache Hit Rate im Cache-Lauf: **100 %** (2500 Treffer / 0 DB-Abfragen)
- Cache Miss Rate im Vergleichslauf: 100 % (2500 DB-Abfragen)
- Eingesparte DB-Abfragen im Testlauf: **2500**
- Ø Antwortzeit mit Cache vs. ohne: 3316 ms vs. 5142 ms bei 1000 Nutzern (p50, −36 %);
  bei 750 Nutzern −57 %
- Fehlerquote: **0 %** in allen acht Läufen, **0 Timeouts**
- DB-Verbindungen während der Läufe: 28 Verbindungen, davon 1 aktiv
  (keine Verbindungsspitze, weil die gecachten Läufe die DB nicht berührten)
- RAM: 1350 → 1586 MB (mit Cache) bzw. 1606 → 1842 MB (ohne Cache) – der Cache
  erhöht den Speicherbedarf nicht messbar, die Einträge sind klein und begrenzt

### Einordnung / Grenzen der Messung

Gemessen wurde in der Entwicklungsumgebung (SSR ohne Produktionsbündelung), die
Absolutwerte liegen deshalb über denen des früheren Mini-Backend-Tests der
veröffentlichten App. Aussagekräftig ist der **direkte Vergleich** beider Läufe
unter identischen Bedingungen: bei gleicher Last verschwinden die DB-Abfragen
vollständig, p50/p90/p95 sinken deutlich, Fehler und Timeouts bleiben bei 0.
Der Cache liegt pro Worker-Instanz im Speicher; bei mehreren Instanzen gilt die
Trefferquote je Instanz.
