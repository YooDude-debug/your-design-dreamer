# Backend-Optimierung Stufe 2 – Analyse, Änderungen, Messwerte (14.08.2026)

Design, Funktionen, Datenlogik und Datenstruktur unverändert. Keine neue
Infrastruktur, keine Architekturänderung. Jede Änderung basiert auf einer
vorherigen Analyse der bestehenden Implementierung.

## 1. Analyse der bestehenden Architektur

| Bereich                      | Befund                                                                                                                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request-Verarbeitung         | Y-Dude läuft auf einer Edge-Worker-Plattform. Lastverteilung, TLS-Terminierung, Keep-Alive und Instanz-Skalierung übernimmt die Plattform; ein eigener Reverse Proxy oder Load Balancer existiert nicht und wäre zusätzliche Infrastruktur ohne Nutzen. **Nicht verändert.**            |
| Verbindungen zur Datenbank   | Der Zugriff läuft nicht über rohe Postgres-Verbindungen, sondern über die HTTPS-Datenschnittstelle (PostgREST) hinter PgBouncer. Es gibt daher **keinen Pool im App-Code**, den man dimensionieren könnte – Poolgröße, Idle- und Connection-Timeouts liegen serverseitig bei PgBouncer. |
| Client-Erzeugung pro Request | Der Server-Client (`supabaseAdmin`) ist bereits ein **Singleton** (Lazy Proxy) pro Instanz → HTTP/2-Verbindungen zur Datenbank-Schnittstelle werden wiederverwendet, keine neue TCP-/TLS-Verbindung pro Request. **Kein Connection Leak gefunden.**                                     |
| Auth-Client pro Request      | Für angemeldete Aufrufe wird pro Request ein Client mit dem Bearer-Token erzeugt (systemgenerierte Datei, nicht änderbar). Er nutzt dieselbe `fetch`-Schicht und damit dieselben wiederverwendeten Verbindungen.                                                                        |
| Blockierende Operationen     | Keine synchronen DB- oder Dateizugriffe, keine CPU-Schleifen im Request-Pfad. Gefunden wurden dagegen **unnötig sequentielle await-Ketten** und ein Schleifenpfad mit vielen Einzelabfragen (siehe 2).                                                                                  |
| Hintergrundarbeit            | Moderation, Push, Zähler und Aufräumarbeiten liegen bereits in Warteschlangen/Jobs und nicht im Request-Pfad. **Unverändert gelassen.**                                                                                                                                                 |

## 2. Durchgeführte Optimierungen

### a) Öffentlicher Beitrag (`src/lib/public-post.functions.ts`)

Vorher: Beitrag → **dann** Profil → **dann** signierte Bild-URL (3 Runden hintereinander).
Jetzt: Beitrag → Profil **und** Bild-URL gleichzeitig (`Promise.all`).
Beide hängen nur am Beitrag und sind voneinander unabhängig → keine Race Condition,
identisches Ergebnis, eine Wartezeit weniger pro Cache-Miss.

### b) Feed-Signale gebündelt (`src/lib/feed-ranking/engine.server.ts`, `feed.functions.ts`)

Vorher: `recordFeedSignals` verarbeitete bis zu 50 Signale **in einer Schleife**,
jedes mit eigenem INSERT + SELECT + UPSERT → bis zu **150 Datenbankabfragen** pro Aufruf.
Jetzt: ein neues `recordSignals` schreibt alle Rohsignale mit **einem INSERT**, fasst
die Gewichtsänderungen je Schlüssel im Speicher zusammen und speichert sie mit
**einem UPSERT** → **maximal 3 Abfragen** pro Aufruf.
Nebeneffekt: Zwei Änderungen am selben Schlüssel innerhalb eines Aufrufs
überschreiben sich nicht mehr, sondern werden korrekt addiert. Die Lernregeln
(`deltasForSignal`, `applyDelta`, Deckelung) sind unverändert.

### c) Push-Versand (`src/lib/push.server.ts`)

- Empfänger-Einstellung, Geräteliste und Name des Auslösers werden jetzt
  gleichzeitig geholt statt in drei Schritten.
- Die Zustellung an die Geräte eines Nutzers (max. 10) läuft parallel, weil jedes
  Gerät ausschließlich seine eigene Zeile betrifft. Vorher summierten sich die
  Wartezeiten langsamer Push-Dienste auf.
- Die Auftragsübernahme (`pending → sending`) bleibt bewusst **sequentiell und
  atomar**, damit keine Doppelzustellung entstehen kann.

### d) Messbarkeit (`src/lib/runtime-metrics.server.ts`, `src/start.ts`, `/api/public/cache-metrics`)

Neue, rein aggregierte Kennzahlen: Anzahl Anfragen, gleichzeitig laufende Anfragen
(Spitze), Fehler, Ø/Max-Dauer, Event-Loop-Lag, CPU-Zeit, RAM. Keine Inhalte, keine
Nutzerdaten, keine Adressen. Der Zähler läuft neben der Anfrage und kann die
Antwort nicht verändern.

### Bewusst **nicht** geändert

Kein eigener Connection Pool (existiert plattformseitig), kein Reverse Proxy, keine
Keep-Alive-Timeouts im App-Code (von der Plattform gesetzt), keine Parallelisierung
von Job-Übernahmen, Moderationsschritten oder Zählerverrechnung – dort würden
Doppelschreibungen bzw. inkonsistente Zähler entstehen.

## 3. Messwerte (alle Werte gemessen, nichts geschätzt)

Methodik wie beim Cache-Test: identische öffentliche Route `/post/<id>` (SSR +
Datenabfrage), lokale Umgebung, N gleichzeitige Anfragen, Timeout 20 s.
„mit Cache" = dieselbe Ressource, „ohne Cache" = jede Anfrage erzeugt einen
Cache-Miss und damit echte Datenbankarbeit.

### Mit Cache (nach Optimierung)

| Nutzer | Requests | erfolgreich | Fehler | Timeouts | P50      | P90      | P95      | Max      | Anfragen/s | DB-Abfragen | Cache-Treffer | gleichz. max. | Event-Loop-Lag | RAM     | CPU im Lauf |
| ------ | -------- | ----------- | ------ | -------- | -------- | -------- | -------- | -------- | ---------- | ----------- | ------------- | ------------- | -------------- | ------- | ----------- |
| 250    | 250      | 250         | 0      | 0        | 871 ms   | 1604 ms  | 1683 ms  | 1733 ms  | 143,4      | 0           | 250           | 40            | 2 ms           | 1385 MB | 2,17 s      |
| 500    | 500      | 500         | 0      | 0        | 1134 ms  | 2193 ms  | 2511 ms  | 2741 ms  | 182,0      | 0           | 500           | 102           | 2 ms           | 1455 MB | 3,31 s      |
| 750    | 750      | 750         | 0      | 0        | 1938 ms  | 3184 ms  | 3305 ms  | 3621 ms  | 206,9      | 0           | 750           | 131           | 2 ms           | 1500 MB | 4,69 s      |
| 1000   | 1000     | 1000        | 0      | 0        | 2326 ms  | 4244 ms  | 4368 ms  | 4756 ms  | 210,1      | 0           | 1000          | 169           | 2 ms           | 1523 MB | 5,67 s      |
| 2000   | 2000     | 2000        | 0      | 0        | 4631 ms  | 6918 ms  | 6921 ms  | 7169 ms  | 277,8      | 1           | 1882          | 256           | 2 ms           | 1749 MB | 8,34 s      |
| 5000   | 5000     | 5000        | 0      | 0        | 8627 ms  | 14729 ms | 15222 ms | 15803 ms | 315,1      | 0           | 5000          | 256           | 2 ms           | 2005 MB | 17,93 s     |
| 10000  | 10000    | 6802        | 3198   | 3198     | 14858 ms | 20011 ms | 20012 ms | 20017 ms | 496,4      | 0           | 7058          | 256           | 2 ms           | 2005 MB | 22,95 s     |

### Ohne Cache (nach Optimierung, gleiche Codepfade)

| Nutzer | erfolgreich | Fehler | Timeouts | P50     | P90     | P95     | Max     | Anfragen/s | DB-Abfragen | RAM     |
| ------ | ----------- | ------ | -------- | ------- | ------- | ------- | ------- | ---------- | ----------- | ------- |
| 250    | 250         | 0      | 0        | 1501 ms | 2342 ms | 2477 ms | 2598 ms | 96,0       | 250         | 1539 MB |
| 500    | 500         | 0      | 0        | 2594 ms | 4136 ms | 4261 ms | 4470 ms | 111,7      | 500         | 1593 MB |
| 750    | 750         | 0      | 0        | 3035 ms | 5095 ms | 5268 ms | 5559 ms | 134,8      | 750         | 1672 MB |
| 1000   | 1000        | 0      | 0        | 4359 ms | 7348 ms | 7645 ms | 8026 ms | 124,5      | 1000        | 1749 MB |

### Datenbank-Seite während der Läufe (Health-Snapshot)

- Datenbank: läuft, PgBouncer: läuft, Neustarts: 0, OOM-Kills: 0
- **Verbindungen: 21 von 60 (niedrig)**, **Pool-Clients: 1 von 200 (niedrig)**
  → kein Pool-Engpass, keine Pool-Erschöpfung, keine messbare Wartezeit auf
  Verbindungen; bei Cache-Treffern wurde die Datenbank gar nicht berührt (0 Abfragen)
- Arbeitsspeicher der Datenbank: 46 %, Datenträger: 18 %, Datenbankgröße 45,7 MB

## 4. Vorher/Nachher-Vergleich

Gleiche Methodik, gleiche Umgebung, gleiche Route (Werte „vorher" aus dem
Cache-Lauf vom selben Tag, vor dieser Optimierungsstufe):

| Kennzahl                          | vorher         | nachher                                 | Änderung                                      |
| --------------------------------- | -------------- | --------------------------------------- | --------------------------------------------- |
| P50 bei 250 Nutzern (Cache)       | 1352 ms        | 871 ms                                  | −36 %                                         |
| P50 bei 500 Nutzern (Cache)       | 1296 ms        | 1134 ms                                 | −13 %                                         |
| P50 bei 1000 Nutzern (Cache)      | 3316 ms        | 2326 ms                                 | **−30 %**                                     |
| P95 bei 1000 Nutzern (Cache)      | 5497 ms        | 4368 ms                                 | −21 %                                         |
| Durchsatz bei 1000 Nutzern        | 171,8 Anfr./s  | 210,1 Anfr./s                           | +22 %                                         |
| P50 bei 1000 Nutzern (ohne Cache) | 5142 ms        | 4359 ms                                 | −15 %                                         |
| Fehlerquote bis 5000 Nutzern      | 0 %            | 0 %                                     | unverändert stabil                            |
| DB-Abfragen bei Cache-Treffern    | 0              | 0                                       | unverändert (Cache umgeht die DB vollständig) |
| Cache-Trefferquote im Lauf        | 100 %          | 100 % (bei 2000: 94 %, Rest Coalescing) | unverändert                                   |
| DB-Verbindungen unter Last        | 28 (1 aktiv)   | 21 von 60, Pool 1 von 200               | weiterhin unkritisch                          |
| RAM bei 1000 Nutzern              | 1586 MB        | 1523 MB                                 | leicht niedriger                              |
| Event-Loop-Lag                    | nicht gemessen | 1–2 ms bis 10.000 Anfragen              | Event Loop nie blockiert                      |
| DB-Abfragen für 50 Feed-Signale   | bis zu 150     | max. 3                                  | **−98 %**                                     |

Vergleich zum früheren Mini-Backend-Test der veröffentlichten App: dort war die
Datenbank-Instanz der begrenzende Faktor. Jetzt zeigt der Health-Snapshot unter
Last 21/60 Verbindungen und 1/200 Pool-Clients, und Cache-Treffer erzeugen
0 Datenbankabfragen – die Datenbank ist **nicht mehr der Engpass**.

## 5. Belastungsgrenze

- **Bis 1.000 gleichzeitig:** stabil, 0 Fehler, 0 Timeouts.
- **2.000 und 5.000 gleichzeitig:** noch 0 Fehler und 0 Timeouts; Antwortzeiten
  steigen deutlich (P95 15,2 s bei 5.000), weil die Anfragen sich stauen.
- **10.000 gleichzeitig:** erste Grenze erreicht – 6.802 erfolgreich,
  3.198 Timeouts (nach 20 s). Kein Absturz, kein Speicherüberlauf, Event-Loop-Lag
  bleibt bei 2 ms, die Datenbank bleibt unbelastet. Der Engpass ist die
  Rechenleistung des Renderings pro Instanz, nicht Cache oder Datenbank.

Begrenzung der Messung: gemessen in der Entwicklungsumgebung (SSR ohne
Produktionsbündelung) auf **einer** Instanz. In der veröffentlichten App
verteilt die Plattform die Last auf mehrere Instanzen, die Absolutwerte fallen
dort besser aus. Aussagekräftig ist der direkte Vorher/Nachher-Vergleich unter
identischen Bedingungen.

## 6. Empfehlung (keine Änderung durchgeführt)

Kein Grund für größere Datenbank-Hardware: Verbindungen und Pool sind niedrig
ausgelastet. Wenn dauerhaft mehr als etwa 2.000 gleichzeitige Seitenaufrufe
erwartet werden, ist die Renderleistung der Anwendungsinstanzen der nächste
Hebel – nicht die Datenbank.
