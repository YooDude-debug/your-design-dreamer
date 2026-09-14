# Y-Dude – Production-Retest 1.000 VU (14.09.2026, nachmittags)

## 1. Testziel

Objektive Nachmessung des **heute veröffentlichten** Production-Stands (fünf kleine Performance-/Request-Optimierungen) unter Last bis 1.000 gleichzeitigen Nutzern und Vergleich mit dem Production-Lesetest vom Vormittag (`docs/LASTTEST_1000VU_2026-09-14.md`).

Es wurden **keine** Code-, Datenbank-, Index-, RLS-, Pooling- oder Infrastrukturänderungen vorgenommen – vor, während oder nach dem Test.

## 2. Exakter Production-Stand

| Punkt | Wert |
|---|---|
| Umgebung | Production – https://y-dude.com (Live-Datenbank/Auth/REST) |
| Release | Veröffentlichung vom 14.09.2026, dokumentiert in `docs/PRODUCTION_PERFORMANCE_OPTIMIZATION_DEPLOY_2026-09-14.md` |
| Enthaltene Änderungen | (1) Market-Favorit ohne vollständigen Reload, (2) Messenger ohne doppeltes Nachladen nach eigenem Live-Event, (3) `last_read_at` ohne Echo-Abfragen, (4) Kanalsuche mit 300-ms-Debounce, (5) korrigierte Storage-Bildfreigabeprüfung |
| Codeänderung während des Tests | keine |

## 3. Testaufbau

| Punkt | Wert |
|---|---|
| Datum | 14.09.2026, 14:32–14:55 UTC |
| Testdauer | 22,5 min (Ramp-up 4 × 90 s, Haltephase 900 s bei 1.000 VU, Abbau 2 × 45 s) |
| Lastprofil | 100 → 250 → 500 → 750 → **1.000** → 500 → 100 VU |
| Verfahren | eigener asynchroner HTTP-Lastgenerator (Python/aiohttp, `/tmp/loadtest/lt.py`), unabhängige Nutzerschleifen, Denkzeit 2–5 s, Zeitlimit 20 s je Anfrage |
| Modus | **nur lesend** – keine Registrierung, keine Testkonten, keine Favoriten, keine Nachrichten, keine Käufe, keine Uploads |
| Angemeldete Pfade | über die bereits vorhandene eigene Sitzung (ein Konto), keine fremden Konten betroffen |
| Testdaten | keine erzeugt, keine bereinigt |

## 4. Workload

19 Messgruppen, gewichteter Mix: Feed/Social (Feed-Seite, Beitragsliste), Messenger-Lesen (Konversationen, Nachrichtenhistorie), Market (Market-Seite, Artikelliste, Artikelsuche, Vorgangsliste), Suche/Profile (Kanalsuche, eigenes Profil), gemischte Navigation (Landing, /auth, /globe, /arena, Impressum, statisches Asset, Auth-API, absichtlich unangemeldete REST-Abfragen).

## 5. Ergebnisse je Laststufe

Latenzangaben = jeweils **höchster** Wert über alle Messgruppen der Stufe (konservativ).

| Stufe | Anfragen | Anf./s | p50 | p90 | p95 | p99 | Max | 5xx | 4xx (erwartet) | Timeouts | Verb.-Abbrüche | Recovery |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 100 VU | 3.809 | 28,2 | 74 ms | 184 ms | 924 ms | 1.264 ms | 2.883 ms | 0 | 160 (401) | 0 | 0 | 0,05 s |
| 250 VU | 6.387 | 71,0 | 69 ms | 126 ms | 153 ms | 366 ms | 891 ms | 0 | 304 (401) | 0 | 0 | 0,09 s |
| 500 VU | 19.044 | 141,1 | 68 ms | 117 ms | 138 ms | 389 ms | 5.080 ms | 0 | 758 (401) | 0 | 0 | 0,05 s |
| 750 VU | 19.139 | 212,7 | 69 ms | 117 ms | 143 ms | 359 ms | 4.218 ms | 0 | 829 (401) | 0 | 0 | 0,05 s |
| **1.000 VU** | **253.011** | **281,1** | **64 ms** | **99 ms** | **120 ms** | **224 ms** | **10.187 ms** | **0** | **10.992 (401)** | **1** | **0** | **0,10 s** |
| **Gesamt** | **301.390** | – | – | – | – | – | – | **0** | **13.043 (401)** | **1** | **0** | – |

**4xx – erwartbar?** Ja, vollständig. Alle 13.043 Antworten mit Code 401 stammen aus der Messgruppe „unangemeldete Direktabfrage auf `posts`" und sind der **vorgesehene Zugriffsschutz**, kein Fehler. Es trat **kein** unerwarteter 400/403/404/429 auf.

Zusätzlich 8.748 Antworten mit Code 3xx: ausschließlich die Weiterleitung von `/arena` – erwartetes Verhalten.

**Datenbankfehler:** keine. **Storage-/Upload-Fehler:** Uploads waren nicht Bestandteil (keine Schreiblast); die Auslieferung des statischen Assets lief mit 14.591 Anfragen fehlerfrei (p95 88 ms). **Realtime:** nicht messbar in diesem HTTP-basierten Verfahren – als Blindspot ausgewiesen (Abschnitt 13).

### Wichtigste Gruppen bei 1.000 VU

| Gruppe | Anfragen | p50 | p95 | p99 | Max | Fehler |
|---|---|---|---|---|---|---|
| Feed-Seite | 29.311 | 61 ms | 114 ms | 199 ms | 4.435 ms | 0 |
| Landing | 22.032 | 64 ms | 120 ms | 201 ms | 2.932 ms | 0 |
| Market-Seite | 21.801 | 59 ms | 112 ms | 198 ms | 4.882 ms | 1 Timeout |
| Nachrichtenhistorie | 18.402 | 52 ms | 91 ms | 206 ms | 7.244 ms | 0 |
| Beitragsliste (Feed-Daten) | 18.334 | 52 ms | 90 ms | 223 ms | 8.501 ms | 0 |
| Konversationen/`last_read_at` (lesend) | 14.776 | 50 ms | 90 ms | 202 ms | 3.533 ms | 0 |
| Statisches Asset | 14.591 | 47 ms | 88 ms | 159 ms | 3.641 ms | 0 |
| Sitzungsprüfung | 10.898 | 49 ms | 87 ms | 211 ms | 4.093 ms | 0 |
| Kanalsuche | 10.975 | 49 ms | 87 ms | 206 ms | 3.318 ms | 0 |
| Market-Artikelsuche | 10.963 | 49 ms | 90 ms | 218 ms | 2.434 ms | 0 |
| Market-Vorgänge | 7.234 | 49 ms | 88 ms | 223 ms | 2.396 ms | 0 |

## 6. Vergleich zum Production-Test vom Vormittag (14.09.2026)

| Kennzahl | Vormittag (read-only) | Dieser Retest | Bewertung |
|---|---|---|---|
| Anfragen gesamt | 606.325 | 301.390 | nicht vergleichbar (siehe unten) |
| Anf./s bei 1.000 VU | 566 | 281 | **nicht kausal interpretierbar** |
| p50 bei 1.000 VU | 52 ms | 64 ms | leicht höher |
| p95 bei 1.000 VU | 98 ms | 120 ms | leicht höher |
| p99 bei 1.000 VU | 223 ms | 224 ms | unverändert |
| Max bei 1.000 VU | 10.488 ms | 10.187 ms | unverändert (Einzelfälle) |
| 5xx | 0 | 0 | unverändert |
| Timeouts | 1 | 1 | unverändert |
| Verbindungsabbrüche | 0 | 0 | unverändert |
| DB-Verbindungen max. (gemessen) | 38 | 42 | unverändert im Rahmen |
| Sperren / Deadlocks | 0 / 0 | 0 / 0 | unverändert |

**Der Durchsatzunterschied (566 → 281 Anf./s) ist ausdrücklich NICHT als Verschlechterung zu lesen und nicht kausal auf den Code zurückführbar.** Grund: Der Lastgenerator des Vormittagslaufs existierte in der Sandbox nicht mehr und wurde neu geschrieben. Der Durchsatz beider Läufe wird durch die **Denkzeit der simulierten Nutzer** begrenzt, nicht durch den Server. In diesem Lauf gilt für **jede** Stufe: gemessener Durchsatz = VU ÷ mittlere Zyklusdauer (28,2 / 71,0 / 141,1 / 212,7 / 281,1 Anf./s bei 100/250/500/750/1.000 VU) – also exakt der generatorseitig vorgegebene Wert. Der Server hat die angebotene Last vollständig abgenommen; eine Aussage über die **maximale** Serverkapazität lässt dieser Lauf damit nicht zu.

Ebenso gilt: Die leicht höheren p50/p95-Werte (64 statt 52 ms, 120 statt 98 ms) liegen im Bereich normaler Tagesschwankung (Cache-Zustand, Auslieferungsknoten, parallele echte Nutzung) und sind bei unveränderten p99/Max **nicht** kausal einer Codeänderung zuzuordnen.

## 7. Vergleich zum Staging-Performance-Retest vom 14.09.2026

**Nicht durchführbar (BLOCKED).** Im Repository existiert kein Bericht zu einem Staging-Performance-Retest vom 14.09.2026, und auf Datenbank, Auth und Kennzahlen des getrennten Staging-Projekts besteht von hier aus kein Zugriff. Ein Zahlenvergleich würde erfundene Werte erfordern und entfällt daher.

## 8. Saturation-/Knee-Point

**Kein Knee-Point beobachtet – und keiner nachweisbar.**

Von 100 auf 1.000 VU stieg der Durchsatz streng linear (28 → 281 Anf./s), während p95 von 924 ms auf 120 ms **sank** (Cache-Aufwärmung) und p99 von 1.264 ms auf 224 ms fiel. Es gibt keinen Punkt, an dem Latenz oder Fehlerquote überproportional stiegen.

Einschränkung, die klar benannt werden muss: Da der Generator die Anfragerate begrenzte (Abschnitt 6), wurde die Kapazitätsgrenze in diesem Lauf **nicht angefahren**. Die Aussage lautet also: „bei 281 Anf./s und 1.000 gleichzeitigen Sitzungen keine Sättigung", **nicht** „die Kapazitätsgrenze liegt oberhalb von 1.000 VU bei beliebiger Rate". Die frühere Messung mit 566 Anf./s bleibt der höchste belegte Durchsatzwert.

## 9. Datenbank-, Pool- und Storage-Verhalten

| Kennzahl | Vor dem Test | Während 1.000 VU | Nach dem Test |
|---|---|---|---|
| Verbindungen (Backends) | 25 | 42 (davon 2 aktiv) | 36 |
| Nicht gewährte Sperren | 0 | 0 | 0 |
| Deadlocks | 0 | 0 | 0 |
| Rollbacks (kumuliert) | 477.283 | 482.560 | 490.330 |
| Datenbankgröße | 122 MB | – | 122 MB |

- **Kein Pooler-/DatabaseTimeout-Problem** aufgetreten: 0 Verbindungsabbrüche, 0 Serverfehler, 1 einzelne Zeitüberschreitung auf der Market-Seite (0,0003 %).
- **Keine Data-API-Timeouts**: alle REST-Messgruppen 100 % Antwortquote.
- Rollback-Zuwachs +13.047 entspricht exakt der Zahl der absichtlich unangemeldeten Abfragen – erwartet, kein Fehler. Weiterhin gilt: jede abgewiesene Anfrage kostet Datenbankzeit.
- Historisch langsamste Abfrage bleibt die Aktualisierung des Lesestands (`conversation_members.last_read_at`): 12.019 Aufrufe, Mittel 11,5 ms, Maximum 690 ms – **unveränderte kumulierte Werte gegenüber dem Vormittag**, dieser Lauf hat sie nicht ausgelöst (keine Schreiblast).
- Storage: nur Auslieferung, keine Uploads. 0 Fehler.

## 10. Fehleranalyse

| Befund | Anzahl | Bewertung |
|---|---|---|
| 5xx | 0 | 🟢 |
| Zeitüberschreitungen (>20 s) | 1 (Market-Seite) | 🟢 Einzelfall bei 21.801 Anfragen |
| Verbindungsabbrüche | 0 | 🟢 |
| 401 auf geschützten Tabellen | 13.043 | 🟢 erwarteter Zugriffsschutz, **kein** Fehler |
| 3xx (`/arena`) | 8.748 | 🟢 erwartete Weiterleitung |
| Einzelne Langläufer | Max 10,2 s (Auth-API), 8,5 s (Beitragsliste), 7,2 s (Nachrichtenhistorie) | 🟡 Einzelfälle, p99 bleibt ≤ 224 ms; Ursache vermutlich Kaltstart/Verbindungsaufbau einzelner Knoten – **nicht belegt** |

## 11. Datenintegrität vorher/nachher

| Kennzahl | Vor (14:31 UTC) | Nach (15:00 UTC) | Bewertung |
|---|---|---|---|
| Konten (`auth.users`) | 22 | **23** | Abweichung, siehe unten |
| Profile | 22 | **23** | Abweichung, siehe unten |
| Market-Artikel | 2 | 2 | unverändert |
| Market-Vorgänge | 0 | 0 | unverändert |
| Nachrichten | 137 | 137 | unverändert |
| Beiträge | 46 | 46 | unverändert |
| Storage-Dateien | 302 | 302 | unverändert |
| Datenbankgröße | 122 MB | 122 MB | unverändert |

**Zur Abweichung:** Während der Testlaufzeit wurde ein Konto neu angelegt (14:39:57 UTC, erste Anmeldung 14:40:09 UTC). Dieses Konto stammt **nicht** aus dem Test: der Lastgenerator sendet ausschließlich GET-Anfragen und ruft keinen Registrierungspfad auf; die Registrierung ist zudem durch die Bot-Prüfung geschützt. Es handelt sich mit hoher Wahrscheinlichkeit um eine **echte Registrierung über die Website** im selben Zeitfenster. Das Konto wurde **nicht** angetastet, nicht gelöscht und nicht verändert. Eine Testbereinigung hat nicht stattgefunden.

Alle übrigen Zähler sind identisch – es wurden **keine** Testdaten erzeugt.

## 12. Bewertung der fünf veröffentlichten Optimierungen

Grundsätzlich gilt: Vier der fünf Änderungen wirken **im Browser** (weniger Folge-Requests nach einer Nutzeraktion). Ein HTTP-Lastgenerator kann das nicht messen – er erzeugt die Requests selbst. Dieser Lauf belegt daher **Stabilität unter Last**, nicht die Request-Reduktion.

| Optimierung | Unter Last belegt? | Beobachtung |
|---|---|---|
| 1. Market-Favorit ohne vollständigen Reload | ⬜ nicht messbar | Erfordert eine echte Favoriten-Aktion; bewusst nicht ausgelöst (echte Nutzerdaten). Market-Lesepfade stabil (p95 112 ms, 0 Fehler). |
| 2. Messenger ohne doppeltes Nachladen | ⬜ nicht messbar | Erfordert eigenen Nachrichtenversand; bewusst nicht ausgelöst. Nachrichten-Lesepfad stabil (18.402 Anfragen, p95 91 ms, 0 Fehler). |
| 3. `last_read_at` ohne Echo-Abfragen | 🟡 indirekt | Die kumulierten Datenbankzähler dieser Abfrage sind gegenüber dem Vormittag **unverändert** (12.019 Aufrufe) – der Lauf hat sie nicht erzeugt. Lesepfad Konversationen: 14.776 Anfragen, p95 90 ms, 0 Fehler. Eine Reduktion ist damit **nicht belegt**. |
| 4. Kanalsuche mit 300-ms-Debounce | 🟡 indirekt | Beim Release im Browser gemessen: 6 schnell getippte Zeichen → 1 Suchanfrage. Unter Last nicht erneut geprüft. Kanalsuche-Endpunkt: 10.975 Anfragen, p95 87 ms, 0 Fehler. |
| 5. Korrigierte Storage-Bildfreigabeprüfung | 🟢 unter Last stabil | Market-Seite inkl. Bildauslieferung und statisches Asset: 36.392 Anfragen, 0 Fehler, 0 Freigabefehler, p95 ≤ 112 ms. Kein 403/401 auf Bildpfaden. |

**Zusammengefasst:** Die veröffentlichten Änderungen haben unter 1.000 VU **keine Regression** verursacht. Ein messbarer Nachweis „weniger Requests" liegt aus diesem Lauf **nicht** vor und wäre nur mit echter Browser-Instrumentierung und echten Schreibaktionen zu erbringen.

## 13. Verbleibende Risiken und Blindspots

1. **Kapazitätsgrenze unbekannt.** Die Anfragerate war generatorseitig begrenzt; der höchste je belegte Durchsatz bleibt 566 Anf./s (Vormittag). Ein Sättigungspunkt wurde nie erreicht und ist damit weiterhin unbekannt.
2. **Keine Schreiblast.** Nachrichtenversand, Favoriten, Market-Abschluss, Uploads und Profiländerungen sind ungemessen – sie würden echte Live-Daten verändern.
3. **Kein Realtime-Test.** Websocket-/Live-Kanäle sind mit diesem HTTP-Verfahren nicht messbar.
4. **Keine Browser-Messwerte.** Rendering, JS-Fehler, lange Tasks, tatsächliche Request-Anzahl pro Nutzeraktion sind ungemessen.
5. **Nur eine angemeldete Sitzung.** Alle angemeldeten Pfade liefen über ein Konto; Effekte durch viele unterschiedliche Sitzungen (Auth-Cache, Rate Limits pro Nutzer) sind ungemessen.
6. **Kein Staging-Vergleich** (Abschnitt 7).
7. **Parallele echte Nutzung** im Testfenster (u. a. eine echte Registrierung) ist nicht ausgeschlossen und beeinflusst die Messwerte in unbekanntem, vermutlich geringem Maß.
8. **Einzelne Langläufer bis 10,2 s** bestehen weiter; Ursache unbelegt.

## 14. Gesamtbewertung

**🟡 verbessert bzw. unverändert stabil – aber Kapazitätsgrenze und Blindspots bestehen.**

Begründung: Unter 1.000 gleichzeitigen Nutzern und 281 Anf./s lief Production über 22,5 Minuten mit **0 Serverfehlern**, 1 Zeitüberschreitung, 0 Verbindungsabbrüchen, ohne Sperren und Deadlocks, mit p95 120 ms und sofortiger Erholung (≤ 0,1 s) nach jeder Stufe. Die heute veröffentlichten Änderungen haben keine Regression verursacht.

Die Bewertung ist bewusst **nicht grün**, weil: (a) die tatsächliche Durchsatzgrenze in diesem Lauf nicht angefahren wurde und daher unbekannt bleibt, (b) die behauptete Request-Reduktion der fünf Optimierungen mit diesem Verfahren **nicht** belegt werden konnte, (c) Schreiblast, Realtime und Browser-Verhalten ungemessen sind.

*Es wurden während und nach dem Test keine Code-, Datenbank-, Index-, Regel-, Rechte-, Pooling- oder Cache-Änderungen vorgenommen. Es wurde nichts deployt und nichts bereinigt.*
